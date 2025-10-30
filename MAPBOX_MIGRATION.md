# Mapbox Migration Guide

## Overview
This document describes the migration from Leaflet to Mapbox GL JS for the NasrdaNavi routing application.

## Changes Made

### 1. Environment Configuration
- **Created `.env.example`**: Template file for Mapbox access token
- **Updated `main.py`**: Added support for reading `MAPBOX_ACCESS_TOKEN` from environment variables using `python-dotenv`
- **Added `requirements.txt`**: Includes `python-dotenv` dependency

### 2. Frontend Updates

#### HTML Template (`templates/index.html`)
- Replaced Leaflet CSS with Mapbox GL JS CSS
- Replaced Leaflet JS with Mapbox GL JS library
- Added Turf.js library for distance calculations
- Added script to set Mapbox access token from Flask template variable

#### JavaScript (`static/map.js`)
Complete rewrite to use Mapbox GL JS API:

**Map Initialization:**
- `L.map()` → `new mapboxgl.Map()`
- Uses Mapbox Streets style instead of OpenStreetMap tiles

**Layers:**
- `L.geoJSON()` → `map.addSource()` + `map.addLayer()`
- GeoJSON data loaded as Mapbox sources
- Separate layers for roads, buildings, route, and highlights

**Markers:**
- `L.marker()` → `new mapboxgl.Marker()`
- Custom HTML elements for marker icons (Start, End, Step markers)
- Marker management: `.remove()` instead of `map.removeLayer()`

**Popups:**
- `L.popup()` → `new mapboxgl.Popup()`
- `.bindPopup()` → `.setPopup()`
- `.openPopup()` → `.togglePopup()`

**Map Methods:**
- `map.setView()` → `map.flyTo()` or `map.setCenter()`
- `map.fitBounds()` → `map.fitBounds()` (similar API)
- `map.zoomIn()` → `map.zoomIn()` (similar)
- `map.distance()` → Custom function using Turf.js `turf.distance()`

**Events:**
- `map.on('click')` → `map.on('click')` (similar API)
- Event coordinates: `e.latlng` → `e.lngLat` (note: Mapbox uses `lngLat` with `lat` and `lng` properties)

**Distance Calculations:**
- Replaced Leaflet's `map.distance()` with Turf.js `turf.distance()`
- All distance calculations now use Turf.js for consistency

## Setup Instructions

### 1. Install Dependencies
```bash
pip install python-dotenv
```

Or install all requirements:
```bash
pip install -r requirements.txt
```

### 2. Get Mapbox Access Token
1. Sign up at https://www.mapbox.com/
2. Navigate to https://account.mapbox.com/access-tokens/
3. Create a new access token or use the default public token

### 3. Configure Environment
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Mapbox access token:
   ```
   MAPBOX_ACCESS_TOKEN=your_actual_mapbox_access_token_here
   ```

### 4. Run the Application
```bash
python main.py
```

The application will automatically load the Mapbox token from the `.env` file and pass it to the frontend template.

## Key Differences: Leaflet vs Mapbox

| Feature | Leaflet | Mapbox GL JS |
|---------|---------|--------------|
| Map Style | Tile-based (raster) | Vector-based (GL) |
| Performance | Good | Excellent (GPU-accelerated) |
| 3D Support | Limited | Full 3D support |
| Customization | CSS-based | Style JSON-based |
| Markers | DOM elements | DOM or WebGL |
| Popups | Built-in | Built-in (similar) |
| Layers | `L.geoJSON()` | `addSource()` + `addLayer()` |
| Distance | `map.distance()` | Turf.js `turf.distance()` |

## Benefits of Mapbox

1. **Better Performance**: GPU-accelerated rendering with WebGL
2. **Vector Tiles**: Smooth zooming and scaling
3. **Modern UI**: Better default styling
4. **3D Capabilities**: Can add 3D buildings, terrain, etc.
5. **Advanced Features**: Better support for complex visualizations

## Notes

- The application maintains all existing functionality:
  - Turn-by-turn navigation
  - GPS tracking
  - Search functionality
  - Route calculation
  - Speech synthesis
  - Active instruction highlighting

- Mapbox requires an access token, but offers a generous free tier (50,000 map loads/month)

- All GeoJSON data handling remains the same (roads.geojson, buildings.geojson)

## Troubleshooting

### Map Not Loading
- Check that `MAPBOX_ACCESS_TOKEN` is set in `.env`
- Verify the token is valid at https://account.mapbox.com/access-tokens/
- Check browser console for error messages

### Layers Not Showing
- Ensure GeoJSON files are loaded correctly
- Check browser console for layer errors
- Verify map has finished loading before adding layers (using `map.on('load')`)

### Distance Calculations Off
- Turf.js distance returns kilometers by default; multiply by 1000 for meters
- Check coordinate order: Mapbox uses `[lng, lat]` format

