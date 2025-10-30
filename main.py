from flask import Flask, render_template, jsonify, request
import geopandas as gpd
import networkx as nx
from shapely.geometry import LineString
from scipy.spatial import cKDTree
import math
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Get Mapbox access token from environment
MAPBOX_ACCESS_TOKEN = os.getenv('MAPBOX_ACCESS_TOKEN', '')

# Load your GeoJSON roads file
roads = gpd.read_file("static/roads.geojson")

# Build a network graph
G = nx.Graph()
nodes = []

for _, row in roads.iterrows():
    if isinstance(row.geometry, LineString):
        coords = list(row.geometry.coords)
        road_name = row.get("name", "Unnamed Road")
        for i in range(len(coords) - 1):
            p1, p2 = coords[i], coords[i + 1]
            length_m = LineString([p1, p2]).length * 111_139  # deg → meters
            G.add_edge(p1, p2, weight=length_m, road_name=road_name)
            nodes.extend([p1, p2])

unique_nodes = list(set(nodes))
tree = cKDTree(unique_nodes)

def snap_to_graph(lon, lat):
    _, idx = tree.query((lon, lat))
    return unique_nodes[idx]

def calculate_bearing(p1, p2):
    lon1, lat1 = p1
    lon2, lat2 = p2
    return math.degrees(math.atan2(lat2 - lat1, lon2 - lon1))

def turn_direction(angle_diff):
    if abs(angle_diff) < 20:
        return "Continue straight"
    elif angle_diff > 20:
        return "Turn left"
    else:
        return "Turn right"

# In your app.py
def generate_turn_instructions(path):
    """Produce clear, distance-aware turn-by-turn instructions with locations."""
    instructions_data = []  # <-- Changed from 'instructions'
    total_distance = 0.0
    segment_distance = 0.0

    if len(path) < 2:
        return [], 0  # <-- Return empty list

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

            if turn != "Continue straight":
                instruction_text = (
                    f"Continue on {current_road} for {int(segment_distance)} meters, then {turn.lower()} onto {next_road}."
                )
                # --- THIS IS THE KEY CHANGE ---
                # Add the instruction text AND the coordinate where the turn happens
                turn_location = path[i + 1]  # The node where the turn occurs
                instructions_data.append({
                    "text": instruction_text,
                    "location": turn_location
                })
                # ------------------------------
                current_road = next_road
                segment_distance = 0.0

    # Final segment
    final_text = (
        f"Continue on {current_road} for {int(segment_distance)} meters and arrive at your destination."
    )
    # --- ALSO ADD LOCATION FOR FINAL STEP ---
    instructions_data.append({
        "text": final_text,
        "location": path[-1]  # The final destination node
    })

    return instructions_data, total_distance  # <-- Return the new list of objects

@app.route("/")
def index():
    return render_template("index.html", mapbox_token=MAPBOX_ACCESS_TOKEN)

@app.route("/route")
def route():
    start = tuple(map(float, request.args.get("start").split(",")))
    end = tuple(map(float, request.args.get("end").split(",")))

    start_node = snap_to_graph(*start)
    end_node = snap_to_graph(*end)

    try:
        path = nx.shortest_path(G, source=start_node, target=end_node, weight="weight")
        route_geom = LineString(path)
        directions, total_distance = generate_turn_instructions(path)
        return jsonify({
            "route": {"type": "Feature", "geometry": route_geom.__geo_interface__},
            "directions": directions,
            "total_distance_m": int(total_distance)
        })
    except nx.NetworkXNoPath:
        return jsonify({"error": "No connected road path found — showing direct line."}), 400

if __name__ == "__main__":
    app.run(debug=True)

