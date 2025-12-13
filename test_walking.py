from backend.data import GeoJSONLoader, GraphBuilder
import networkx as nx

# Load data
roads = GeoJSONLoader.load_roads()
footpaths = GeoJSONLoader.load_footpaths()

print(f"Roads features: {len(roads)}")
print(f"Footpaths features: {len(footpaths)}")

# Build graphs
driving_graph = GraphBuilder().build_from_roads(roads)
walking_graph = GraphBuilder().build_combined(roads, footpaths)

print(f"\nDriving graph nodes: {len(driving_graph.graph.nodes())}")
print(f"Driving graph edges: {len(driving_graph.graph.edges())}")

print(f"\nWalking graph nodes: {len(walking_graph.graph.nodes())}")
print(f"Walking graph edges: {len(walking_graph.graph.edges())}")

# Test connectivity
print(f"\nDriving graph connected: {nx.is_connected(driving_graph.graph)}")
print(f"Walking graph connected: {nx.is_connected(walking_graph.graph)}")

# Count connected components
driving_components = list(nx.connected_components(driving_graph.graph))
walking_components = list(nx.connected_components(walking_graph.graph))

print(f"\nDriving graph components: {len(driving_components)}")
print(f"Walking graph components: {len(walking_components)}")

if len(walking_components) > 1:
    print("\nComponent sizes:")
    for i, comp in enumerate(sorted(walking_components, key=len, reverse=True)[:5]):
        print(f"  Component {i+1}: {len(comp)} nodes")

# Test specific coordinates from the log
start_coords = (7.388424442978476, 8.9886192826649)
end_coords = (7.387004751112897, 8.989825815125513)

start_node = walking_graph.snap_to_graph(*start_coords)
end_node = walking_graph.snap_to_graph(*end_coords)

print(f"\nStart node: {start_node}")
print(f"End node: {end_node}")

# Check if nodes are in same component
for i, comp in enumerate(walking_components):
    if start_node in comp:
        print(f"Start node in component {i+1} (size: {len(comp)})")
    if end_node in comp:
        print(f"End node in component {i+1} (size: {len(comp)})")
