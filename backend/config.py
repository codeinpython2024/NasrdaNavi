import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / 'static' / 'data'


class Config:
    ROADS_FILE = os.getenv('ROADS_FILE', str(DATA_DIR / 'roads.geojson'))
    BUILDINGS_FILE = os.getenv('BUILDINGS_FILE', str(DATA_DIR / 'buildings.geojson'))
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    MAPBOX_ACCESS_TOKEN = os.getenv('MAPBOX_ACCESS_TOKEN', '')
