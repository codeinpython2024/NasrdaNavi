class NasrdaNaviException(Exception):
    """Base exception for NasrdaNavi"""
    pass


class RouteNotFoundError(NasrdaNaviException):
    """Raised when no route can be found between points"""
    pass


class DataLoadError(NasrdaNaviException):
    """Raised when GeoJSON data fails to load"""
    pass


class ValidationError(NasrdaNaviException):
    """Raised when input validation fails"""
    pass
