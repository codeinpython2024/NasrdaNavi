import networkx as nx
from shapely.geometry import LineString
from backend.exceptions import RouteNotFoundError
from backend.services.navigation_service import NavigationService
import logging

logger = logging.getLogger(__name__)


class RoutingService:
    def __init__(self, driving_graph_builder, walking_graph_builder=None):
        self.driving_graph_builder = driving_graph_builder
        self.driving_graph = driving_graph_builder.graph
        self.driving_nav_service = NavigationService(self.driving_graph)
        
        # Walking graph is optional for backward compatibility
        if walking_graph_builder:
            self.walking_graph_builder = walking_graph_builder
            self.walking_graph = walking_graph_builder.graph
            self.walking_nav_service = NavigationService(self.walking_graph)
            
            # Log graph stats for debugging
            logger.info(f"Walking graph: {self.walking_graph.number_of_nodes()} nodes, "
                       f"{self.walking_graph.number_of_edges()} edges")
            
            # Check connectivity
            if not nx.is_connected(self.walking_graph):
                components = list(nx.connected_components(self.walking_graph))
                logger.warning(f"Walking graph has {len(components)} disconnected components")
                # Store the largest component for fallback routing
                self.walking_largest_component = max(components, key=len)
                logger.info(f"Largest component has {len(self.walking_largest_component)} nodes")
            else:
                self.walking_largest_component = None
                logger.info("Walking graph is fully connected")
        else:
            self.walking_graph_builder = None
            self.walking_graph = None
            self.walking_nav_service = None
            self.walking_largest_component = None
        
        logger.info(f"Driving graph: {self.driving_graph.number_of_nodes()} nodes, "
                   f"{self.driving_graph.number_of_edges()} edges")

    def _find_nearest_in_component(self, graph_builder, coords, component):
        """Find the nearest node in a specific component."""
        from scipy.spatial import cKDTree
        
        component_nodes = list(component)
        if not component_nodes:
            return None
            
        tree = cKDTree(component_nodes)
        _, idx = tree.query(coords)
        return component_nodes[idx]

    def calculate_route(self, start_coords, end_coords, mode="driving"):
        """Calculate route between two coordinate pairs.
        
        Args:
            start_coords: Tuple of (longitude, latitude) for start point
            end_coords: Tuple of (longitude, latitude) for end point
            mode: 'driving' for roads only, 'walking' for roads + footpaths
        """
        # Select appropriate graph based on mode
        if mode == "walking" and self.walking_graph_builder:
            graph_builder = self.walking_graph_builder
            graph = self.walking_graph
            nav_service = self.walking_nav_service
        else:
            graph_builder = self.driving_graph_builder
            graph = self.driving_graph
            nav_service = self.driving_nav_service
            mode = "driving"  # Fallback if walking not available
        
        start_node = graph_builder.snap_to_graph(*start_coords)
        end_node = graph_builder.snap_to_graph(*end_coords)
        
        logger.debug(f"Mode: {mode}, Start: {start_coords} -> {start_node}, End: {end_coords} -> {end_node}")

        if start_node == end_node:
            directions, total_distance = nav_service.generate_turn_instructions([start_node])
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
                "mode": mode,
            }

        try:
            path = nx.shortest_path(graph, source=start_node, target=end_node, weight="weight")
            route_geom = LineString(path)
            directions, total_distance = nav_service.generate_turn_instructions(path)
            
            return {
                "route": {"type": "Feature", "geometry": route_geom.__geo_interface__},
                "directions": directions,
                "total_distance_m": int(total_distance),
                "mode": mode,
            }
        except nx.NetworkXNoPath as exc:
            # For walking mode, try to find route in the largest connected component
            if mode == "walking" and self.walking_largest_component:
                logger.warning(f"No path found between {start_node} and {end_node}, "
                             "attempting fallback to largest component")
                
                # Check if nodes are in the largest component
                start_in_largest = start_node in self.walking_largest_component
                end_in_largest = end_node in self.walking_largest_component
                
                if not start_in_largest:
                    start_node = self._find_nearest_in_component(
                        graph_builder, start_coords, self.walking_largest_component)
                if not end_in_largest:
                    end_node = self._find_nearest_in_component(
                        graph_builder, end_coords, self.walking_largest_component)
                
                if start_node and end_node and start_node != end_node:
                    try:
                        path = nx.shortest_path(graph, source=start_node, target=end_node, weight="weight")
                        route_geom = LineString(path)
                        directions, total_distance = nav_service.generate_turn_instructions(path)
                        
                        return {
                            "route": {"type": "Feature", "geometry": route_geom.__geo_interface__},
                            "directions": directions,
                            "total_distance_m": int(total_distance),
                            "mode": mode,
                        }
                    except nx.NetworkXNoPath:
                        pass
            
            # If walking fails, try driving as fallback
            if mode == "walking":
                logger.info("Walking route failed, falling back to driving mode")
                try:
                    return self.calculate_route(start_coords, end_coords, mode="driving")
                except RouteNotFoundError:
                    pass
            
            error_msg = "No connected path found. Try selecting points closer to roads or paths."
            raise RouteNotFoundError(error_msg) from exc
