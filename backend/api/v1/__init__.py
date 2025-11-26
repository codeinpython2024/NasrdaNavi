from flask import Blueprint
from . import routes, health

bp = Blueprint('v1', __name__, url_prefix='/api/v1')
bp.register_blueprint(routes.bp)
bp.register_blueprint(health.bp)
