import networkx as nx
from scipy.spatial import cKDTree
from shapely.geometry import LineString, MultiLineString


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
                    length_m = LineString([p1, p2]).length * 111_139
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
