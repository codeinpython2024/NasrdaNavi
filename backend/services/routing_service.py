import networkx as nx
from shapely.geometry import LineString
from backend.exceptions import RouteNotFoundError
from backend.services.navigation_service import NavigationService


class RoutingService:
    def __init__(self, graph_builder):
        self.graph_builder = graph_builder
        self.graph = graph_builder.graph
        self.nav_service = NavigationService(self.graph)

    def calculate_route(self, start_coords, end_coords):
        """Calculate route between two coordinate pairs."""
        start_node = self.graph_builder.snap_to_graph(*start_coords)
        end_node = self.graph_builder.snap_to_graph(*end_coords)

        if start_node == end_node:
            directions, total_distance = self.nav_service.generate_turn_instructions([start_node])
            route_feature = {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [start_node, end_node],
                },
            }
            return {
                "route": route_feature,
                "directions": directions,
                "total_distance_m": int(total_distance),
            }

        try:
            path = nx.shortest_path(self.graph, source=start_node, target=end_node, weight="weight")
            route_geom = LineString(path)
            directions, total_distance = self.nav_service.generate_turn_instructions(path)
            
            return {
                "route": {"type": "Feature", "geometry": route_geom.__geo_interface__},
                "directions": directions,
                "total_distance_m": int(total_distance)
            }
        except nx.NetworkXNoPath:
            raise RouteNotFoundError("No connected road path found")
