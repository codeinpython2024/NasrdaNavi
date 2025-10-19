from flask import Flask, render_template, jsonify, request
import geopandas as gpd
import networkx as nx
from shapely.geometry import LineString
from scipy.spatial import cKDTree
import math
import json
import os
import logging
from config import Config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(Config)
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# Load POI data
pois_data = {}
try:
    if os.path.exists(app.config['POIS_FILE']):
        with open(app.config['POIS_FILE'], 'r') as f:
            pois_data = json.load(f)
        logger.info(f"Loaded {len(pois_data.get('buildings', []))} buildings")
except Exception as e:
    logger.error(f"Error loading POIs: {e}")

# Define haversine_distance before using it
def haversine_distance(p1: tuple, p2: tuple) -> float:
    """
    Calculate accurate distance between two points using Haversine formula.
    
    Args:
        p1: (longitude, latitude) tuple for point 1
        p2: (longitude, latitude) tuple for point 2
    
    Returns:
        Distance in meters
    """
    lon1, lat1 = p1
    lon2, lat2 = p2
    
    # Earth's radius in meters
    R = 6371000
    
    # Convert to radians
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    # Haversine formula
    a = (math.sin(delta_lat / 2) ** 2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * 
         math.sin(delta_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

# Load roads
G = nx.DiGraph()  # Use directed graph for one-way roads
nodes = []
tree = None

try:
    roads = gpd.read_file(app.config['ROADS_FILE'])
    logger.info(f"Loaded {len(roads)} road segments")
    
    # Build network graph
    for _, row in roads.iterrows():
        if isinstance(row.geometry, LineString):
            coords = list(row.geometry.coords)
            road_name = row.get("name", "").strip()
            if not road_name or road_name == " ":
                road_name = f"Campus Path {row.get('OBJECTID', 'Unknown')}"
            
            oneway = row.get("oneway", "N")
            
            for i in range(len(coords) - 1):
                p1, p2 = coords[i], coords[i + 1]
                length_m = haversine_distance(p1, p2)
                
                # Add edges based on one-way restriction
                if oneway == "F":  # Forward direction only
                    G.add_edge(p1, p2, weight=length_m, road_name=road_name)
                elif oneway == "B":  # Backward direction only
                    G.add_edge(p2, p1, weight=length_m, road_name=road_name)
                else:  # "N" or any other value = bidirectional
                    G.add_edge(p1, p2, weight=length_m, road_name=road_name)
                    G.add_edge(p2, p1, weight=length_m, road_name=road_name)
                
                nodes.extend([p1, p2])
    
    if nodes:
        unique_nodes = list(set(nodes))
        tree = cKDTree(unique_nodes)
        logger.info(f"Built graph with {len(unique_nodes)} nodes")
    else:
        logger.warning("No nodes found in road network")
        unique_nodes = []
        
except Exception as e:
    logger.error(f"Error loading roads: {e}")
    unique_nodes = []

def snap_to_graph(lon, lat):
    if tree is None or not unique_nodes:
        return (lon, lat)
    _, idx = tree.query((lon, lat))
    return unique_nodes[idx]

def calculate_bearing(p1, p2):
    """Calculate compass bearing from p1 to p2 in degrees."""
    lon1, lat1 = p1
    lon2, lat2 = p2
    
    # Convert to radians
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lon = math.radians(lon2 - lon1)
    
    # Calculate bearing
    x = math.sin(delta_lon) * math.cos(lat2_rad)
    y = math.cos(lat1_rad) * math.sin(lat2_rad) - math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(delta_lon)
    bearing = math.degrees(math.atan2(x, y))
    
    # Normalize to 0-360
    return (bearing + 360) % 360

def bearing_to_direction(bearing):
    """Convert bearing to cardinal direction."""
    directions = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"]
    index = int((bearing + 22.5) / 45) % 8
    return directions[index]

def turn_direction(angle_diff):
    """Determine turn direction from angle difference."""
    abs_diff = abs(angle_diff)
    if abs_diff < 45:
        return "continue straight"
    elif abs_diff < 80:
        return "slight left" if angle_diff > 0 else "slight right"
    elif abs_diff < 135:
        return "turn left" if angle_diff > 0 else "turn right"
    elif abs_diff < 170:
        return "sharp left" if angle_diff > 0 else "sharp right"
    else:
        return "make a U-turn"

def generate_turn_instructions(path):
    """Produce clear, distance-aware turn-by-turn instructions with coordinate mapping."""
    instructions = []
    instruction_coords = []  # Track which coordinate each instruction corresponds to
    total_distance = 0.0
    segment_distance = 0.0

    if len(path) < 2:
        return ["You are already at your destination."], 0, [0]

    # Get initial road and bearing
    current_road = G.get_edge_data(path[0], path[1])["road_name"]
    initial_bearing = calculate_bearing(path[0], path[1])
    initial_direction = bearing_to_direction(initial_bearing)
    
    # Add initial instruction
    instructions.append(f"Head {initial_direction} on {current_road}.")
    instruction_coords.append(0)

    for i in range(len(path) - 1):
        edge_data = G.get_edge_data(path[i], path[i + 1])
        road_name = edge_data["road_name"] if edge_data else "Unnamed Road"
        dist = edge_data["weight"] if edge_data else 0
        segment_distance += dist
        total_distance += dist

        # If there's a next step, analyze turn
        if i < len(path) - 2:
            prev_bearing = calculate_bearing(path[i], path[i + 1])
            next_bearing = calculate_bearing(path[i + 1], path[i + 2])
            diff = (next_bearing - prev_bearing + 180) % 360 - 180  # normalize angle

            turn = turn_direction(diff)
            next_road = G.get_edge_data(path[i + 1], path[i + 2])["road_name"]

            # Add instruction if significant turn or road change
            should_add_instruction = False
            instruction_text = ""
            
            if turn != "continue straight":
                # Significant turn
                should_add_instruction = True
                if next_road != current_road:
                    instruction_text = f"In {int(segment_distance)} m, {turn} onto {next_road}."
                else:
                    instruction_text = f"In {int(segment_distance)} m, {turn} to stay on {current_road}."
            elif next_road != current_road:
                # Road name changes but going straight
                should_add_instruction = True
                instruction_text = f"In {int(segment_distance)} m, continue onto {next_road}."
            
            if should_add_instruction and segment_distance > 2:  # Lower threshold to 2m
                instructions.append(instruction_text)
                instruction_coords.append(i + 1)
                current_road = next_road
                segment_distance = 0.0

    # Final segment
    if segment_distance > 0:
        instructions.append(f"Continue for {int(segment_distance)} m to arrive at your destination.")
        instruction_coords.append(len(path) - 1)

    return instructions, total_distance, instruction_coords


@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/search")
def search():
    query = request.args.get("q", "").lower().strip()
    if not query:
        return jsonify({"results": []})
    
    results = []
    
    # Search buildings
    for building in pois_data.get("buildings", []):
        if (query in building["name"].lower() or 
            query in building.get("department", "").lower() or
            any(query in room.lower() for room in building.get("rooms", []))):
            results.append({
                "id": building["id"],
                "name": building["name"],
                "type": "building",
                "department": building.get("department"),
                "coordinates": building["entrance"],
                "description": building.get("description", "")
            })
    
    # Search amenities
    for amenity in pois_data.get("amenities", []):
        if query in amenity["name"].lower() or query in amenity["type"].lower():
            results.append({
                "id": amenity["id"],
                "name": amenity["name"],
                "type": amenity["type"],
                "coordinates": amenity["coordinates"]
            })
    
    return jsonify({"results": results[:10]})

@app.route("/api/pois")
def get_pois():
    return jsonify(pois_data)

@app.route("/route")
def route():
    try:
        start = tuple(map(float, request.args.get("start", "").split(",")))
        end = tuple(map(float, request.args.get("end", "").split(",")))
        accessible_only = request.args.get("accessible", "false").lower() == "true"
        
        if len(start) != 2 or len(end) != 2:
            return jsonify({"error": "Invalid coordinates"}), 400
    except (ValueError, AttributeError):
        return jsonify({"error": "Invalid coordinate format. Use: ?start=lon,lat&end=lon,lat"}), 400

    # Validate coordinates are within reasonable campus bounds
    campus_bounds = {
        'min_lon': 7.38, 'max_lon': 7.39,
        'min_lat': 8.98, 'max_lat': 9.00
    }
    
    if not (campus_bounds['min_lon'] <= start[0] <= campus_bounds['max_lon'] and
            campus_bounds['min_lat'] <= start[1] <= campus_bounds['max_lat']):
        return jsonify({"error": "Start point is outside campus area"}), 400
    
    if not (campus_bounds['min_lon'] <= end[0] <= campus_bounds['max_lon'] and
            campus_bounds['min_lat'] <= end[1] <= campus_bounds['max_lat']):
        return jsonify({"error": "End point is outside campus area"}), 400

    start_node = snap_to_graph(*start)
    end_node = snap_to_graph(*end)
    
    # Check if snapping moved points too far
    max_snap = app.config['MAX_SNAP_DISTANCE_M']
    if haversine_distance(start, start_node) > max_snap:
        return jsonify({"error": f"Start point is too far from any road (>{max_snap}m)"}), 400
    if haversine_distance(end, end_node) > max_snap:
        return jsonify({"error": f"End point is too far from any road (>{max_snap}m)"}), 400

    try:
        path = nx.shortest_path(G, source=start_node, target=end_node, weight="weight")
        route_geom = LineString(path)
        directions, total_distance, instruction_coords = generate_turn_instructions(path)
        
        # Calculate estimated time (average walking speed: 1.4 m/s)
        estimated_time_seconds = int(total_distance / 1.4)
        
        return jsonify({
            "route": {"type": "Feature", "geometry": route_geom.__geo_interface__},
            "directions": directions,
            "instruction_coords": instruction_coords,
            "total_distance_m": int(total_distance),
            "estimated_time_seconds": estimated_time_seconds
        })
    except nx.NetworkXNoPath:
        return jsonify({"error": "No path found between these points. They may be on disconnected road segments."}), 400
    except Exception as e:
        logger.error(f"Routing error: {e}")
        return jsonify({"error": "Routing calculation failed. Please try different points."}), 500

if __name__ == "__main__":
    port = int(os.getenv('PORT', 5001))
    app.run(debug=app.config['DEBUG'], host='0.0.0.0', port=port)
