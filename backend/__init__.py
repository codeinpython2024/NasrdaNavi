import os
import stat
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


def check_cache_file_security(filepath):
    """
    Check that a cache file has secure permissions before deserializing.
    
    Returns True if the file is safe to load, False otherwise.
    
    Security checks:
    - File must be owned by the current user (or root if running as root)
    - File must not be world-writable
    - File must not be group-writable
    
    Note: On Windows, this function returns True as POSIX permissions don't apply.
    """
    if os.name != 'posix':
        # Windows doesn't use POSIX permissions; skip check
        logger.debug(f"Skipping permission check on non-POSIX system: {filepath}")
        return True
    
    try:
        file_stat = os.stat(filepath)
        file_mode = file_stat.st_mode
        file_uid = file_stat.st_uid
        current_uid = os.getuid()
        
        # Check ownership: file must be owned by current user or root
        if file_uid != current_uid and file_uid != 0:
            logger.warning(
                f"Cache file {filepath} is owned by UID {file_uid}, "
                f"but current process is UID {current_uid}. Skipping cache."
            )
            return False
        
        # Check for group-write permission (S_IWGRP = 0o020)
        if file_mode & stat.S_IWGRP:
            logger.warning(
                f"Cache file {filepath} has group-write permission (mode {oct(file_mode)}). "
                "Skipping cache for security reasons."
            )
            return False
        
        # Check for world-write permission (S_IWOTH = 0o002)
        if file_mode & stat.S_IWOTH:
            logger.warning(
                f"Cache file {filepath} has world-write permission (mode {oct(file_mode)}). "
                "Skipping cache for security reasons."
            )
            return False
        
        return True
        
    except OSError as e:
        logger.warning(f"Failed to check permissions for {filepath}: {e}")
        return False

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
        # SECURITY: pickle.load() deserializes arbitrary Python objects and can execute
        # arbitrary code if the cache file has been tampered with. Ensure cache files:
        #   1. Are owned by the application user (verified by check_cache_file_security)
        #   2. Have restrictive permissions - no group/world write (mode 0o644 or stricter)
        #   3. Are stored in a directory with restricted access (CACHE_DIR)
        #
        # If higher security is required, consider replacing pickle with:
        #   - JSON for simple data structures (but loses Python object support)
        #   - msgpack with explicit schema validation
        #   - Protocol Buffers or FlatBuffers for typed serialization
        #   - cloudpickle + cryptographic signing (HMAC) to verify integrity
        #
        # For this application, the cache contains NetworkX graph objects which require
        # pickle or a pickle-compatible serializer. The permission checks below mitigate
        # the risk by ensuring only trusted users can modify cache files.
        
        if not check_cache_file_security(cache_file):
            logger.warning(f"Skipping cache due to security check failure: {cache_key}")
            # Fall through to rebuild the graph
        else:
            try:
                logger.info(f"Loading cached graph: {cache_key}")
                with open(cache_file, 'rb') as f:
                    return pickle.load(f)
            except Exception as e:
                logger.warning(f"Failed to load cached graph: {e}")
    
    # Build graph
    logger.info(f"Building graph: {cache_key}")
    graph_builder = builder_func()
    
    # Save to cache with restrictive permissions
    try:
        with open(cache_file, 'wb') as f:
            pickle.dump(graph_builder, f)
        hash_file.write_text(current_hash)
        
        # Set restrictive permissions on cache files (owner read/write only)
        # This mitigates pickle deserialization attacks by preventing tampering
        if os.name == 'posix':
            os.chmod(cache_file, stat.S_IRUSR | stat.S_IWUSR)  # 0o600
            os.chmod(hash_file, stat.S_IRUSR | stat.S_IWUSR)  # 0o600
        
        logger.info(f"Cached graph: {cache_key}")
    except Exception as e:
        logger.warning(f"Failed to cache graph: {e}")
    
    return graph_builder


def create_app():
    """Application factory for Flask app."""
    app = Flask(__name__, 
                template_folder='../templates',
                static_folder='../frontend')
    app.config.from_object(Config)

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
