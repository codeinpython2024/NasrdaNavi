"""Client error logging endpoint."""

from flask import Blueprint, jsonify, request
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import logging

bp = Blueprint('logging', __name__)
logger = logging.getLogger(__name__)

# Query parameter keys that should have their values redacted
SENSITIVE_QUERY_KEYS = frozenset({
    'access_token', 'token', 'api_key', 'apikey', 'password', 'passwd',
    'email', 'secret', 'key', 'auth', 'authorization', 'credential'
})


def sanitize_control_chars(value: str) -> str:
    """Remove control characters to prevent log injection.
    
    Strips ASCII control characters (0x00-0x1F) including newlines,
    carriage returns, tabs, and other non-printables.
    
    Args:
        value: The string to sanitize.
        
    Returns:
        String with control characters removed.
    """
    return ''.join(c for c in value if ord(c) >= 0x20)


def sanitize_url(raw_url: str, max_length: int = 500) -> str:
    """Parse and sanitize a URL to remove PII and sensitive tokens.
    
    Args:
        raw_url: The raw URL string to sanitize.
        max_length: Maximum length of the returned URL.
        
    Returns:
        A sanitized URL with sensitive query parameters redacted,
        truncated to max_length. Returns empty string for empty/malformed input.
    """
    if not raw_url or not isinstance(raw_url, str):
        return ''
    
    try:
        parsed = urlparse(raw_url.strip())
        
        # If no scheme or netloc, it's likely malformed or relative
        if not parsed.scheme or not parsed.netloc:
            # For relative URLs, just return the path truncated
            safe_path = parsed.path[:max_length] if parsed.path else ''
            return safe_path
        
        # Parse query string and redact sensitive keys
        query_params = parse_qs(parsed.query, keep_blank_values=True)
        sanitized_params = {}
        for key, values in query_params.items():
            if key.lower() in SENSITIVE_QUERY_KEYS:
                sanitized_params[key] = ['[REDACTED]']
            else:
                sanitized_params[key] = values
        
        # Rebuild query string (flatten single-value lists)
        sanitized_query = urlencode(
            {k: v[0] if len(v) == 1 else v for k, v in sanitized_params.items()},
            doseq=True
        )
        
        # Reconstruct URL without fragment (fragments can contain sensitive data)
        sanitized_url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            '',  # params (rarely used, omit for safety)
            sanitized_query,
            ''   # fragment removed
        ))
        
        return sanitized_url[:max_length]
        
    except Exception:
        # For any parsing errors, return empty string
        return ''


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
    
    # Sanitize control characters and limit input length
    message = sanitize_control_chars(str(data.get('message', 'Unknown error')))[:1000]
    context = sanitize_control_chars(str(data.get('context', '')))[:200]
    url = sanitize_url(sanitize_control_chars(str(data.get('url', ''))))
    stack = sanitize_control_chars(str(data.get('stack', '')))[:5000] if data.get('stack') else None
    platform = sanitize_control_chars(str(data.get('platform', 'unknown')))[:100]
    timestamp = sanitize_control_chars(str(data.get('timestamp', '')))[:50]
    
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
