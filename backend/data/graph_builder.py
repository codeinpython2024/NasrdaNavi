import math
import networkx as nx
from scipy.spatial import cKDTree
from shapely.geometry import LineString, MultiLineString


def haversine_distance(lon1, lat1, lon2, lat2):
    """Calculate distance in meters between two points using Haversine formula."""
    R = 6371000  # Earth's radius in meters
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat / 2) ** 2 + \
        math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


class GraphBuilder:
    def __init__(self):
        self.graph = nx.Graph()
        self.nodes = []
        self.tree = None

    def _meters_per_degree_lon(self, nodes):
        """Calculate meters per degree longitude based on average latitude of nodes.
        
        At the equator, 1 degree longitude ≈ 111.32 km.
        At latitude φ, 1 degree longitude ≈ 111.32 * cos(φ) km.
        
        Args:
            nodes: List of (lon, lat) tuples
            
        Returns:
            Meters per degree of longitude for the average latitude
        """
        if not nodes:
            return 111320  # Default to equator value
        avg_lat = sum(node[1] for node in nodes) / len(nodes)
        return 111320 * math.cos(math.radians(avg_lat))

    def _line_geometries(self, geometry):
        """Yield LineString geometries from LineString or MultiLineString inputs."""
        if isinstance(geometry, LineString):
            yield geometry
        elif isinstance(geometry, MultiLineString):
            for line in geometry.geoms:
                if isinstance(line, LineString):
                    yield line

    def build_from_roads(self, roads_gdf):
        """Build graph from roads GeoDataFrame."""
        for _, row in roads_gdf.iterrows():
            geometry = row.geometry
            if geometry is None:
                continue

            road_name = row.get("name", "Unnamed Road")
            for line in self._line_geometries(geometry):
                coords = list(line.coords)
                for i in range(len(coords) - 1):
                    p1, p2 = coords[i], coords[i + 1]
                    # Use Haversine for accurate distance (coords are lon, lat)
                    length_m = haversine_distance(p1[0], p1[1], p2[0], p2[1])
                    self.graph.add_edge(p1, p2, weight=length_m, road_name=road_name, path_type="road")
                    self.nodes.extend([p1, p2])

        unique_nodes = list(set(self.nodes))
        self.tree = cKDTree(unique_nodes)
        self.nodes = unique_nodes
        return self

    def build_from_footpaths(self, footpaths_gdf):
        """Build graph from footpaths GeoDataFrame."""
        for _, row in footpaths_gdf.iterrows():
            geometry = row.geometry
            if geometry is None:
                continue

            # Handle different property names for footpath name
            path_name = row.get("WNAME", row.get("Name", row.get("name", "Footpath")))
            if path_name and path_name.strip():
                path_name = path_name.strip()
            else:
                path_name = "Footpath"
                
            for line in self._line_geometries(geometry):
                coords = list(line.coords)
                for i in range(len(coords) - 1):
                    p1, p2 = coords[i], coords[i + 1]
                    length_m = haversine_distance(p1[0], p1[1], p2[0], p2[1])
                    self.graph.add_edge(p1, p2, weight=length_m, road_name=path_name, path_type="footpath")
                    self.nodes.extend([p1, p2])

        unique_nodes = list(set(self.nodes))
        self.tree = cKDTree(unique_nodes)
        self.nodes = unique_nodes
        return self

    def build_combined(self, roads_gdf, footpaths_gdf, connection_threshold=30.0):
        """Build graph from both roads and footpaths for walking mode.
        
        Args:
            roads_gdf: GeoDataFrame of roads
            footpaths_gdf: GeoDataFrame of footpaths
            connection_threshold: Maximum distance in meters to connect nearby nodes (reduced from 50m to 30m)
        """
        # Add roads first
        road_nodes = []
        for _, row in roads_gdf.iterrows():
            geometry = row.geometry
            if geometry is None:
                continue

            road_name = row.get("name", "Unnamed Road")
            for line in self._line_geometries(geometry):
                coords = list(line.coords)
                for i in range(len(coords) - 1):
                    p1, p2 = coords[i], coords[i + 1]
                    length_m = haversine_distance(p1[0], p1[1], p2[0], p2[1])
                    self.graph.add_edge(p1, p2, weight=length_m, road_name=road_name, path_type="road")
                    self.nodes.extend([p1, p2])
                    road_nodes.extend([p1, p2])

        # Add footpaths
        footpath_nodes = []
        for _, row in footpaths_gdf.iterrows():
            geometry = row.geometry
            if geometry is None:
                continue

            # Handle different property names for footpath name
            path_name = row.get("WNAME", row.get("Name", row.get("name", "Footpath")))
            if path_name and path_name.strip():
                path_name = path_name.strip()
            else:
                path_name = "Footpath"
                
            for line in self._line_geometries(geometry):
                coords = list(line.coords)
                for i in range(len(coords) - 1):
                    p1, p2 = coords[i], coords[i + 1]
                    length_m = haversine_distance(p1[0], p1[1], p2[0], p2[1])
                    self.graph.add_edge(p1, p2, weight=length_m, road_name=path_name, path_type="footpath")
                    self.nodes.extend([p1, p2])
                    footpath_nodes.extend([p1, p2])

        unique_road_nodes = list(set(road_nodes))
        unique_footpath_nodes = list(set(footpath_nodes))
        
        # Convert threshold from meters to degrees for KD-tree radius query
        # Calculate dynamically based on actual latitude of the data for portability
        all_collected_nodes = road_nodes + footpath_nodes
        meters_per_deg_lon = self._meters_per_degree_lon(all_collected_nodes)
        threshold_deg = connection_threshold / meters_per_deg_lon
        
        # Connect footpaths to nearby roads
        if unique_road_nodes and unique_footpath_nodes:
            road_tree = cKDTree(unique_road_nodes)
            
            for fp_node in unique_footpath_nodes:
                # Find all road nodes within threshold (radius query)
                nearby_indices = road_tree.query_ball_point(fp_node, threshold_deg)
                
                for idx in nearby_indices:
                    road_node = unique_road_nodes[idx]
                    dist_m = haversine_distance(fp_node[0], fp_node[1], 
                                               road_node[0], road_node[1])
                    
                    if dist_m <= connection_threshold and not self.graph.has_edge(fp_node, road_node):
                        self.graph.add_edge(fp_node, road_node, weight=dist_m, 
                                          road_name="Connection", path_type="connection")
        
        # Connect nearby footpath nodes to each other (to bridge small gaps)
        # Increased threshold to 40m to improve connectivity
        footpath_connection_threshold = 40.0
        footpath_threshold_deg = footpath_connection_threshold / meters_per_deg_lon
        
        if len(unique_footpath_nodes) > 1:
            footpath_tree = cKDTree(unique_footpath_nodes)
            
            for i, fp_node in enumerate(unique_footpath_nodes):
                # Find nearby footpath nodes (excluding self)
                nearby_indices = footpath_tree.query_ball_point(fp_node, footpath_threshold_deg)
                
                for idx in nearby_indices:
                    if idx == i:
                        continue
                    other_node = unique_footpath_nodes[idx]
                    dist_m = haversine_distance(fp_node[0], fp_node[1],
                                               other_node[0], other_node[1])
                    
                    # Use increased threshold for footpath-footpath connections (40m)
                    if dist_m <= footpath_connection_threshold and not self.graph.has_edge(fp_node, other_node):
                        self.graph.add_edge(fp_node, other_node, weight=dist_m,
                                          road_name="Connection", path_type="connection")
        
        # Also connect road nodes that are close but not connected (to fix road network gaps)
        # Increased threshold to 25m to help bridge road gaps
        road_connection_threshold = 25.0
        road_threshold_deg = road_connection_threshold / meters_per_deg_lon
        
        if len(unique_road_nodes) > 1:
            all_road_tree = cKDTree(unique_road_nodes)
            
            for i, road_node in enumerate(unique_road_nodes):
                nearby_indices = all_road_tree.query_ball_point(road_node, road_threshold_deg)
                
                for idx in nearby_indices:
                    if idx == i:
                        continue
                    other_node = unique_road_nodes[idx]
                    dist_m = haversine_distance(road_node[0], road_node[1],
                                               other_node[0], other_node[1])
                    
                    # Use increased threshold for road-road connections (25m)
                    if dist_m <= road_connection_threshold and not self.graph.has_edge(road_node, other_node):
                        self.graph.add_edge(road_node, other_node, weight=dist_m,
                                          road_name="Connection", path_type="connection")

        unique_nodes = list(set(self.nodes))
        self.tree = cKDTree(unique_nodes)
        self.nodes = unique_nodes
        return self

    def snap_to_graph(self, lon, lat):
        """Snap coordinates to nearest graph node."""
        _, idx = self.tree.query((lon, lat))
        return self.nodes[idx]
