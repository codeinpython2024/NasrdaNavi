import threading

from flask import Blueprint, jsonify, request, current_app
from backend.exceptions import ValidationError

bp = Blueprint('routes', __name__)

VALID_MODES = {'driving', 'walking'}


def get_routing_service():
    return current_app.config['ROUTING_SERVICE']


def get_limiter():
    """Get the rate limiter if available."""
    return current_app.config.get('LIMITER')


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


def apply_rate_limit(limit_string="30 per minute"):
    """Decorator to apply rate limiting if available.
    
    Rate limiting is checked at request time within the Flask app context.
    The decorated function is cached to avoid re-wrapping on every request.
    
    Thread Safety:
        Uses a lock to prevent race conditions when multiple threads
        concurrently attempt to create the cached wrapped function.
    
    Flask-Limiter Compatibility:
        This approach dynamically wraps the function at first request time
        rather than at import time. This works correctly with Flask-Limiter
        because limiter.limit() returns a decorator that checks rate limits
        when the wrapped function is invoked, not when the decorator is applied.
        The wrapped function is cached and reused for all subsequent requests,
        ensuring consistent rate limit tracking per endpoint.
    """
    from functools import wraps
    
    def decorator(func):
        # Cache for the rate-limited version of the function
        _rate_limited_func = {}
        _rate_limit_lock = threading.Lock()
        
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Check limiter at request time (inside app context)
            limiter = current_app.config.get('LIMITER')
            if limiter:
                # Cache the decorated version to avoid re-wrapping on every request
                # Use lock to prevent race condition on first request
                with _rate_limit_lock:
                    if 'func' not in _rate_limited_func:
                        _rate_limited_func['func'] = limiter.limit(limit_string)(func)
                return _rate_limited_func['func'](*args, **kwargs)
            return func(*args, **kwargs)
        return wrapper
    return decorator


@bp.route('/route')
@apply_rate_limit("30 per minute")
def get_route():
    start = request.args.get('start')
    end = request.args.get('end')
    mode = request.args.get('mode', 'driving')

    if not start or not end:
        raise ValidationError("Missing start or end coordinates")
    
    if mode not in VALID_MODES:
        raise ValidationError(f"Invalid mode. Must be one of: {', '.join(VALID_MODES)}")

    start_coords = _parse_coords(start, "start")
    end_coords = _parse_coords(end, "end")

    result = get_routing_service().calculate_route(start_coords, end_coords, mode)
    return jsonify(result)
