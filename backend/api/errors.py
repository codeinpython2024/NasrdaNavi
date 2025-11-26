from flask import jsonify
from backend.exceptions import RouteNotFoundError, ValidationError, DataLoadError


def register_error_handlers(app):
    @app.errorhandler(RouteNotFoundError)
    def handle_route_not_found(e):
        return jsonify({"error": str(e)}), 400

    @app.errorhandler(ValidationError)
    def handle_validation_error(e):
        return jsonify({"error": str(e)}), 400

    @app.errorhandler(DataLoadError)
    def handle_data_load_error(e):
        return jsonify({"error": str(e)}), 500
