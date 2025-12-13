from flask import Blueprint, jsonify, current_app

bp = Blueprint('map', __name__)


@bp.route('/map-config')
def get_map_config():
    """
    Return map configuration including the Mapbox token.
    This endpoint serves the token server-side instead of exposing it in HTML.
    """
    from backend.config import Config
    
    return jsonify({
        'mapboxToken': Config.MAPBOX_ACCESS_TOKEN,
    })
