import os
import logging
import pickle
import hashlib
from pathlib import Path
from flask import Flask, render_template, jsonify
from backend.config import Config
from backend.data import GeoJSONLoader, GraphBuilder
from backend.services import RoutingService
from backend.api.errors import register_error_handlers
from backend.api.v1 import bp as v1_bp

logger = logging.getLogger(__name__)

# Cache directory for graph data
CACHE_DIR = Path(__file__).parent / 'cache'
CACHE_DIR.mkdir(exist_ok=True)

# Try to import Flask-Limiter for rate limiting
try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
    LIMITER_AVAILABLE = True
except ImportError:
    LIMITER_AVAILABLE = False
    logger.warning("Flask-Limiter not installed. Rate limiting disabled.")


def get_file_hash(filepath):
    """Get MD5 hash of a file for cache invalidation."""
    try:
        with open(filepath, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()
    except Exception:
        return None


def load_or_build_graph(cache_key, builder_func, data_files):
    """
    Load graph from cache if available and valid, otherwise build and cache it.
    
    Args:
        cache_key: Unique identifier for this graph
        builder_func: Function to build the graph if cache miss
        data_files: List of data file paths to check for changes
    
    Returns:
        Built or cached graph builder
    """
    cache_file = CACHE_DIR / f'{cache_key}.pkl'
    hash_file = CACHE_DIR / f'{cache_key}.hash'
    
    # Calculate current hash of data files
    current_hash = ''
    for filepath in data_files:
        file_hash = get_file_hash(filepath)
        if file_hash:
            current_hash += file_hash
    current_hash = hashlib.md5(current_hash.encode()).hexdigest()
    
    # Check if cache is valid
    cache_valid = False
    if cache_file.exists() and hash_file.exists():
        try:
            stored_hash = hash_file.read_text().strip()
            if stored_hash == current_hash:
                cache_valid = True
        except Exception:
            pass
    
    if cache_valid:
        try:
            logger.info(f"Loading cached graph: {cache_key}")
            with open(cache_file, 'rb') as f:
                return pickle.load(f)
        except Exception as e:
            logger.warning(f"Failed to load cached graph: {e}")
    
    # Build graph
    logger.info(f"Building graph: {cache_key}")
    graph_builder = builder_func()
    
    # Save to cache
    try:
        with open(cache_file, 'wb') as f:
            pickle.dump(graph_builder, f)
        hash_file.write_text(current_hash)
        logger.info(f"Cached graph: {cache_key}")
    except Exception as e:
        logger.warning(f"Failed to cache graph: {e}")
    
    return graph_builder


def create_app():
    app = Flask(__name__, template_folder='../templates', static_folder='../static')
    app.config.from_object(Config)
    
    # Security configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', os.urandom(32).hex())
    
    # Initialize rate limiter if available
    if LIMITER_AVAILABLE:
        limiter = Limiter(
            key_func=get_remote_address,
            app=app,
            default_limits=["200 per day", "50 per hour"],
            storage_uri="memory://",
        )
        app.config['LIMITER'] = limiter
        
        # Custom error handler for rate limiting
        @app.errorhandler(429)
        def rate_limit_exceeded(e):
            return jsonify({
                "error": "Rate limit exceeded. Please try again later.",
                "retry_after": e.description
            }), 429
    
    # Add security headers
    @app.after_request
    def add_security_headers(response):
        # Prevent clickjacking
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        # Prevent MIME type sniffing
        response.headers['X-Content-Type-Options'] = 'nosniff'
        # XSS protection
        response.headers['X-XSS-Protection'] = '1; mode=block'
        # Referrer policy
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        return response

    # Load GeoJSON data
    roads = GeoJSONLoader.load_roads()
    footpaths = GeoJSONLoader.load_footpaths()
    
    # Data file paths for cache invalidation
    roads_file = Config.ROADS_FILE
    footpath_file = Config.FOOTPATH_FILE
    
    # Build driving graph (roads only) with caching
    driving_graph_builder = load_or_build_graph(
        cache_key='driving_graph',
        builder_func=lambda: GraphBuilder().build_from_roads(roads),
        data_files=[roads_file]
    )
    
    # Build walking graph (roads + footpaths) with caching
    walking_graph_builder = load_or_build_graph(
        cache_key='walking_graph',
        builder_func=lambda: GraphBuilder().build_combined(roads, footpaths),
        data_files=[roads_file, footpath_file]
    )
    
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
        
        if not start or not end:
            return jsonify({"error": "Missing start or end coordinates"}), 400
        
        try:
            start_coords = tuple(map(float, start.split(',')))
            end_coords = tuple(map(float, end.split(',')))
        except ValueError:
            return jsonify({"error": "Invalid coordinate format"}), 400
        
        result = routing_service.calculate_route(start_coords, end_coords, mode)
        return jsonify(result)

    @app.route('/')
    def index():
        return render_template('index.html')

    return app
