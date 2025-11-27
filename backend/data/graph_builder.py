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
                    self.graph.add_edge(p1, p2, weight=length_m, road_name=road_name)
                    self.nodes.extend([p1, p2])

        unique_nodes = list(set(self.nodes))
        self.tree = cKDTree(unique_nodes)
        self.nodes = unique_nodes
        return self

    def snap_to_graph(self, lon, lat):
        """Snap coordinates to nearest graph node."""
        _, idx = self.tree.query((lon, lat))
        return self.nodes[idx]
