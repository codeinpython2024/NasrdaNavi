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

# Load POI data
pois_data = {}
try:
    if os.path.exists(app.config['POIS_FILE']):
        with open(app.config['POIS_FILE'], 'r') as f:
            pois_data = json.load(f)
        logger.info(f"Loaded {len(pois_data.get('buildings', []))} buildings")
except Exception as e:
    logger.error(f"Error loading POIs: {e}")

# Load roads
G = nx.Graph()
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
            
            for i in range(len(coords) - 1):
                p1, p2 = coords[i], coords[i + 1]
                # Accurate distance calculation accounting for latitude
                lat_avg = (p1[1] + p2[1]) / 2
                lon_scale = 111_139 * math.cos(math.radians(lat_avg))
                lat_scale = 111_139
                dx = (p2[0] - p1[0]) * lon_scale
                dy = (p2[1] - p1[1]) * lat_scale
                length_m = math.sqrt(dx**2 + dy**2)
                G.add_edge(p1, p2, weight=length_m, road_name=road_name)
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
    lon1, lat1 = p1
    lon2, lat2 = p2
    return math.degrees(math.atan2(lat2 - lat1, lon2 - lon1))

def turn_direction(angle_diff):
    abs_diff = abs(angle_diff)
    if abs_diff < 30:
        return "Continue straight"
    elif abs_diff < 45:
        return "Slight left" if angle_diff > 0 else "Slight right"
    elif abs_diff < 135:
        return "Turn left" if angle_diff > 0 else "Turn right"
    else:
        return "Make a U-turn"

def generate_turn_instructions(path):
    """Produce clear, distance-aware turn-by-turn instructions."""
    instructions = []
    total_distance = 0.0
    segment_distance = 0.0

    if len(path) < 2:
        return ["You are already at your destination."], 0

    current_road = G.get_edge_data(path[0], path[1])["road_name"]

    for i in range(len(path) - 1):
        edge_data = G.get_edge_data(path[i], path[i + 1])
        road_name = edge_data["road_name"] if edge_data else "Unnamed Road"
        dist = edge_data["weight"] if edge_data else 0
        segment_distance += dist
        total_distance += dist

        # If there’s a next step, analyze turn
        if i < len(path) - 2:
            prev_bearing = calculate_bearing(path[i], path[i + 1])
            next_bearing = calculate_bearing(path[i + 1], path[i + 2])
            diff = (next_bearing - prev_bearing + 180) % 360 - 180  # normalize angle

            turn = turn_direction(diff)
            next_road = G.get_edge_data(path[i + 1], path[i + 2])["road_name"]

            # Only add instruction if road changes or significant turn
            if turn != "Continue straight" or next_road != current_road:
                if segment_distance > 5:  # Only if segment is meaningful
                    instructions.append(
                        f"Continue on {current_road} for {int(segment_distance)} m, then {turn.lower()} onto {next_road}."
                    )
                    current_road = next_road
                    segment_distance = 0.0

    # Final segment
    if segment_distance > 0:
        instructions.append(
            f"Continue on {current_road} for {int(segment_distance)} m and arrive at your destination."
        )

    return instructions, total_distance


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
    
    # Check if snapping moved points too far (>100m)
    def distance_m(p1, p2):
        lat_avg = (p1[1] + p2[1]) / 2
        lon_scale = 111_139 * math.cos(math.radians(lat_avg))
        dx = (p2[0] - p1[0]) * lon_scale
        dy = (p2[1] - p1[1]) * 111_139
        return math.sqrt(dx**2 + dy**2)
    
    if distance_m(start, start_node) > 100:
        return jsonify({"error": "Start point is too far from any road (>100m)"}), 400
    if distance_m(end, end_node) > 100:
        return jsonify({"error": "End point is too far from any road (>100m)"}), 400

    try:
        path = nx.shortest_path(G, source=start_node, target=end_node, weight="weight")
        route_geom = LineString(path)
        directions, total_distance = generate_turn_instructions(path)
        
        # Calculate estimated time (average walking speed: 1.4 m/s)
        estimated_time_seconds = int(total_distance / 1.4)
        
        return jsonify({
            "route": {"type": "Feature", "geometry": route_geom.__geo_interface__},
            "directions": directions,
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

