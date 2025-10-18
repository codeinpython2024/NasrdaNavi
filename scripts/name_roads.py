#!/usr/bin/env python3
"""
Automatic Road Naming System for NASRDA Campus

This script generates meaningful names for unnamed roads based on:
1. Nearby buildings and landmarks
2. Road direction (North-South, East-West)
3. Road position relative to campus center
"""

import json
import math
from shapely.geometry import LineString, Point
from typing import List, Tuple, Dict

def load_geojson(filepath: str) -> dict:
    """Load GeoJSON file."""
    with open(filepath, 'r') as f:
        return json.load(f)

def save_geojson(filepath: str, data: dict):
    """Save GeoJSON file."""
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)

def get_road_center(coordinates: List[List[float]]) -> Tuple[float, float]:
    """Get the center point of a road."""
    lons = [coord[0] for coord in coordinates]
    lats = [coord[1] for coord in coordinates]
    return (sum(lons) / len(lons), sum(lats) / len(lats))

def get_road_direction(coordinates: List[List[float]]) -> str:
    """Determine if road is primarily North-South or East-West."""
    start = coordinates[0]
    end = coordinates[-1]
    
    lon_diff = abs(end[0] - start[0])
    lat_diff = abs(end[1] - start[1])
    
    if lon_diff > lat_diff:
        return "East-West"
    else:
        return "North-South"

def distance_to_point(road_coords: List[List[float]], point: Tuple[float, float]) -> float:
    """Calculate minimum distance from road to a point."""
    road_line = LineString(road_coords)
    point_geom = Point(point)
    return road_line.distance(point_geom)

def find_nearest_buildings(road_coords: List[List[float]], buildings: List[dict], max_distance: float = 0.0005) -> List[dict]:
    """Find buildings near a road."""
    road_center = get_road_center(road_coords)
    nearby = []
    
    for building in buildings:
        coords = building['coordinates']
        dist = distance_to_point(road_coords, coords)
        
        if dist < max_distance:
            nearby.append({
                'building': building,
                'distance': dist
            })
    
    # Sort by distance
    nearby.sort(key=lambda x: x['distance'])
    return nearby

def generate_road_name(road_id: int, road_coords: List[List[float]], buildings: List[dict], 
                      campus_center: Tuple[float, float]) -> str:
    """Generate a meaningful name for a road."""
    
    # Find nearby buildings
    nearby = find_nearest_buildings(road_coords, buildings, max_distance=0.0003)
    
    # If there are named buildings nearby, use them
    if nearby:
        for item in nearby[:3]:  # Check top 3 nearest
            building = item['building']
            name = building.get('name', '')
            dept = building.get('department', '')
            
            # Use buildings with meaningful names
            if name and name not in ['Building ' + str(i) for i in range(1, 100)]:
                if 'NASRDA' in name or 'Headquarters' in name:
                    return "Main Drive"
                elif 'Museum' in name:
                    return "Museum Road"
                elif 'Centre for Atmospheric Research' in name:
                    return "Research Centre Road"
                elif 'Strategic Space Application' in name or 'SSA' in name:
                    return "SSA Access Road"
                elif 'MPSDM' in name:
                    return "MPSDM Road"
    
    # Determine position relative to campus center
    road_center = get_road_center(road_coords)
    direction = get_road_direction(road_coords)
    
    # Determine if road is in north, south, east, or west section
    if road_center[1] > campus_center[1]:  # North
        if road_center[0] > campus_center[0]:  # East
            section = "Northeast"
        else:
            section = "Northwest"
    else:  # South
        if road_center[0] > campus_center[0]:  # East
            section = "Southeast"
        else:
            section = "Southwest"
    
    # Generate name based on direction and section
    if direction == "East-West":
        return f"{section} Path {road_id}"
    else:
        return f"{section} Lane {road_id}"

def main():
    """Main function to name all roads."""
    print("Loading data...")
    roads_data = load_geojson('static/roads.geojson')
    pois_data = load_geojson('static/pois.json')
    
    buildings = pois_data.get('buildings', [])
    
    # Calculate campus center
    all_coords = []
    for building in buildings:
        all_coords.append(building['coordinates'])
    
    campus_center = (
        sum(c[0] for c in all_coords) / len(all_coords),
        sum(c[1] for c in all_coords) / len(all_coords)
    )
    
    print(f"Campus center: {campus_center}")
    print(f"Processing {len(roads_data['features'])} roads...")
    
    # Name each road
    named_count = 0
    for feature in roads_data['features']:
        road_id = feature['id']
        current_name = feature['properties'].get('name', '').strip()
        
        # Only rename if currently unnamed
        if not current_name or current_name == ' ':
            coords = feature['geometry']['coordinates']
            
            # Handle MultiLineString
            if feature['geometry']['type'] == 'MultiLineString':
                # Use first linestring for naming
                coords = coords[0]
            
            new_name = generate_road_name(road_id, coords, buildings, campus_center)
            feature['properties']['name'] = new_name
            named_count += 1
            print(f"  Road {road_id}: '{new_name}'")
        else:
            print(f"  Road {road_id}: Keeping existing name '{current_name}'")
    
    # Save updated roads
    print(f"\nNamed {named_count} roads")
    save_geojson('static/roads.geojson', roads_data)
    print("✓ Roads updated successfully!")
    
    # Print summary
    print("\n=== Road Names Summary ===")
    for feature in roads_data['features']:
        road_id = feature['id']
        name = feature['properties']['name']
        print(f"Road {road_id}: {name}")

if __name__ == '__main__':
    main()
