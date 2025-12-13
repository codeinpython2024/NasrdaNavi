import geopandas as gpd
from backend.config import Config
from backend.exceptions import DataLoadError


class GeoJSONLoader:
    @staticmethod
    def load_roads():
        try:
            return gpd.read_file(Config.ROADS_FILE)
        except Exception as e:
            raise DataLoadError(f"Failed to load roads: {e}")

    @staticmethod
    def load_buildings():
        try:
            return gpd.read_file(Config.BUILDINGS_FILE)
        except Exception as e:
            raise DataLoadError(f"Failed to load buildings: {e}")

    @staticmethod
    def load_footpaths():
        try:
            return gpd.read_file(Config.FOOTPATH_FILE)
        except Exception as e:
            raise DataLoadError(f"Failed to load footpaths: {e}")
