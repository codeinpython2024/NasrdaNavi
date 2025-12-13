"""Client error logging endpoint."""

from flask import Blueprint, jsonify, request
import logging

bp = Blueprint('logging', __name__)
logger = logging.getLogger(__name__)


@bp.route('/log-error', methods=['POST'])
def log_error():
    """Log client-side errors for debugging.
    
    Accepts JSON payload with:
    - message: Error message
    - stack: Stack trace (optional)
    - context: Error context (optional)
    - url: Page URL where error occurred (optional)
    - platform: Client platform (optional)
    - timestamp: When error occurred (optional)
    """
    data = request.get_json(silent=True) or {}
    
    # Sanitize and limit input
    message = str(data.get('message', 'Unknown error'))[:1000]
    context = str(data.get('context', ''))[:200]
    url = str(data.get('url', ''))[:500]
    stack = str(data.get('stack', ''))[:5000] if data.get('stack') else None
    platform = str(data.get('platform', 'unknown'))[:100]
    timestamp = str(data.get('timestamp', ''))[:50]
    
    logger.error(
        "Client error: %s",
        message,
        extra={
            'client_context': context,
            'client_url': url,
            'client_stack': stack,
            'client_platform': platform,
            'client_timestamp': timestamp
        }
    )
    
    return jsonify({"status": "logged"}), 200
