import os

class Config:
    DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    ROADS_FILE = 'static/roads.geojson'
    BUILDINGS_FILE = 'static/buildings.geojson'
    POIS_FILE = 'static/pois.json'
    MAX_SNAP_DISTANCE_M = 100  # Maximum distance to snap point to road
