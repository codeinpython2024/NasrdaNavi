from flask import Flask, render_template
from backend.config import Config
from backend.data import GeoJSONLoader, GraphBuilder
from backend.services import RoutingService
from backend.api.errors import register_error_handlers
from backend.api.v1 import bp as v1_bp


def create_app():
    app = Flask(__name__, template_folder='../templates', static_folder='../static')
    app.config.from_object(Config)

    # Load GeoJSON data
    roads = GeoJSONLoader.load_roads()
    footpaths = GeoJSONLoader.load_footpaths()
    
    # Build driving graph (roads only)
    driving_graph_builder = GraphBuilder().build_from_roads(roads)
    
    # Build walking graph (roads + footpaths)
    walking_graph_builder = GraphBuilder().build_combined(roads, footpaths)
    
    # Initialize routing service with both graphs
    routing_service = RoutingService(driving_graph_builder, walking_graph_builder)
    
    # Store service in app config
    app.config['ROUTING_SERVICE'] = routing_service

    # Register blueprints
    app.register_blueprint(v1_bp)

    # Register error handlers
    register_error_handlers(app)

    # Legacy route endpoint (for backward compatibility)
    @app.route('/route')
    def legacy_route():
        from flask import request, jsonify
        start = request.args.get('start')
        end = request.args.get('end')
        mode = request.args.get('mode', 'driving')
        start_coords = tuple(map(float, start.split(',')))
        end_coords = tuple(map(float, end.split(',')))
        result = routing_service.calculate_route(start_coords, end_coords, mode)
        return jsonify(result)

    @app.route('/')
    def index():
        return render_template('index.html')

    return app
