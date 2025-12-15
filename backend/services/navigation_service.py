from backend.utils import calculate_bearing, turn_direction


class NavigationService:
    def __init__(self, graph):
        self.graph = graph

    def generate_turn_instructions(self, path):
        """Generate turn-by-turn instructions with locations."""
        instructions = []
        total_distance = 0.0
        segment_distance = 0.0

        if len(path) < 2:
            return [], 0

        edge_data = self.graph.get_edge_data(path[0], path[1])
        if edge_data is None:
            raise ValueError(f"Invalid path: edge from {path[0]} to {path[1]} does not exist in graph")
        current_road = edge_data.get("road_name", "Unnamed Road")

        for i in range(len(path) - 1):
            edge_data = self.graph.get_edge_data(path[i], path[i + 1])
            if edge_data is None:
                raise ValueError(f"Invalid path: edge from {path[i]} to {path[i + 1]} does not exist in graph")
            road_name = edge_data.get("road_name", "Unnamed Road")
            dist = edge_data.get("weight", 0)
            segment_distance += dist
            total_distance += dist

            if i < len(path) - 2:
                next_edge = self.graph.get_edge_data(path[i + 1], path[i + 2])
                if not next_edge:
                    continue
                    
                prev_bearing = calculate_bearing(path[i], path[i + 1])
                next_bearing = calculate_bearing(path[i + 1], path[i + 2])
                diff = (next_bearing - prev_bearing + 180) % 360 - 180

                turn = turn_direction(diff)
                next_road = next_edge.get("road_name", "Unnamed Road")

                if turn != "Continue straight":
                    instructions.append({
                        "text": f"Continue on {current_road} for {int(segment_distance)} meters, then {turn.lower()} onto {next_road}.",
                        "location": path[i + 1]
                    })
                    current_road = next_road
                    segment_distance = 0.0
                elif next_road != current_road:
                    # Road changed while continuing straight - update current_road and reset distance
                    current_road = next_road
                    segment_distance = 0.0

        instructions.append({
            "text": f"Continue on {current_road} for {int(segment_distance)} meters and arrive at your destination.",
            "location": path[-1]
        })

        return instructions, total_distance
