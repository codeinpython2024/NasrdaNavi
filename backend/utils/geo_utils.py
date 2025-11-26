import math


def calculate_bearing(p1, p2):
    """Calculate bearing between two points (lon, lat)."""
    lon1, lat1 = p1
    lon2, lat2 = p2
    return math.degrees(math.atan2(lat2 - lat1, lon2 - lon1))


def turn_direction(angle_diff):
    """Determine turn direction from angle difference."""
    if abs(angle_diff) < 20:
        return "Continue straight"
    elif angle_diff > 20:
        return "Turn left"
    else:
        return "Turn right"
