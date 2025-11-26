from flask import Blueprint, jsonify, request, current_app
from backend.exceptions import ValidationError

bp = Blueprint('routes', __name__)


def get_routing_service():
    return current_app.config['ROUTING_SERVICE']


def _parse_coords(value, label):
    if not value:
        raise ValidationError(f"Missing {label} coordinates")

    parts = value.split(',')
    if len(parts) != 2:
        raise ValidationError(f"{label.capitalize()} must contain exactly two comma-separated values")

    try:
        return tuple(map(float, parts))
    except ValueError:
        raise ValidationError(f"Invalid {label} coordinate format")


@bp.route('/route')
def get_route():
    start = request.args.get('start')
    end = request.args.get('end')

    if not start or not end:
        raise ValidationError("Missing start or end coordinates")

    start_coords = _parse_coords(start, "start")
    end_coords = _parse_coords(end, "end")

    result = get_routing_service().calculate_route(start_coords, end_coords)
    return jsonify(result)
