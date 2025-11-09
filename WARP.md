# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

### Running the Application
```bash
python main.py
```
Starts the Flask development server on `http://localhost:5001`

### Installing Dependencies
```bash
pip install -r requirements.txt
```

### Running Tests
```bash
pytest test_main.py
```
Note: Test file may need to be created - no test files currently exist in the project root.

### Environment Setup
Create a `.env` file with:
```
MAPBOX_ACCESS_TOKEN=your_token_here
```

## Architecture Overview

### Backend (Flask)
**File:** `main.py`

The backend is a straightforward Flask application that:
- Loads GeoJSON road network data from `static/roads.geojson`
- Builds a NetworkX graph representation of the road network
- Uses NetworkX shortest path algorithms to calculate routes
- Generates turn-by-turn navigation instructions with distance calculations
- Returns route data as GeoJSON with instruction metadata

**Key Components:**
- **Graph Construction:** Roads are converted to graph edges with coordinates as nodes. Edge weights are calculated as meters using degree-to-meter conversion (1° ≈ 111,139m)
- **Snap to Graph:** Uses scipy's cKDTree for efficient nearest-node lookups to snap arbitrary coordinates to the road network
- **Turn Instructions:** Calculates bearings between segments to determine turn direction (straight, left, right) and generates human-readable instructions with road names and distances
- **Instruction Format:** Returns list of objects with `text` (instruction string) and `location` (coordinate where turn occurs) for frontend visualization

**Routes:**
- `/` - Serves the main HTML interface with Mapbox token injection
- `/route?start=lng,lat&end=lng,lat` - Returns route GeoJSON, turn-by-turn directions, and total distance

### Frontend (Mapbox GL JS)
**File:** `static/map.js` (~2000+ lines)

A comprehensive Mapbox GL JS application with extensive 3D visualization and navigation features.

**Map Initialization:**
- Campus-centered map (Nasarawa State University campus bounds)
- Initial 80° pitch for dramatic 3D tilted view
- 20° bearing for better orientation
- Max bounds restriction to campus area
- Mapbox Standard style with 3D terrain enabled by default

**Core Systems:**

1. **Camera Management (Lines ~70-90):**
   - `INITIAL_CAMERA` object stores desired camera state
   - `style.load` event handler prevents style from resetting camera
   - Uses `jumpTo()` for instant, atomic camera positioning
   - Conditional pitch animation only when transitioning from flat (< 10°) view

2. **3D Terrain System:**
   - Raster DEM with 1.2x exaggeration for campus-scale terrain
   - Sky layer for atmospheric effects
   - Hillshade for subtle depth perception
   - Contour lines at zoom 16+
   - Controlled fog for depth without obscuring features

3. **Route Visualization:**
   - Gradient route line: green (start) → yellow (middle) → red (end)
   - Animated dashed overlay for visual feedback
   - Line metrics enabled for gradient effects
   - Uses `requestAnimationFrame` for smooth animation

4. **Layer Management:**
   - Custom GeoJSON layers for roads and buildings
   - Layer visibility toggles
   - Layer persistence across style changes
   - Proper z-index ordering

**Important Patterns:**

- **Camera Operations:** Always use `jumpTo()` for instant positioning, `easeTo()` for user-initiated animations
- **Style Changes:** Camera state must be preserved when switching map styles
- **Event Handling:** Uses `style.load` and `map.on('load')` for initialization checkpoints
- **Animation Cleanup:** Proper event listener removal and null checks to prevent memory leaks

### Data Files
- `static/roads.geojson` - Road network data with names and geometry
- `static/buildings.geojson` - Building footprints
- Both files are required for the application to function

### Templates
- `templates/index.html` - Single-page application with Bootstrap 5.3.3, Font Awesome 6.4.0, and Mapbox GL JS v3.0.1

## Key Implementation Details

### Coordinate System
All coordinates use `[longitude, latitude]` order (GeoJSON/Mapbox convention), NOT `[lat, lng]`

### Distance Calculations
- Backend: Degree-to-meter conversion using LineString length * 111,139
- Frontend: Uses Turf.js for haversine distance calculations

### Camera Persistence Pattern
The application uses a two-checkpoint system to maintain the dramatic 80° pitch:
1. `style.load` event immediately restores camera after style loads
2. `map.on('load')` event reinforces camera position before adding layers
3. Terrain animation conditionally applies only when pitch < 10°

This prevents unwanted camera movement during page load and style changes while allowing smooth transitions when manually enabling 3D features.

### Route Animation Best Practices
- Duration proportional to segment distance
- Dynamic zoom based on route scale
- Progress feedback for user orientation
- Bearing validation for very short segments
- Proper cleanup of animation state and event listeners

## Known Issues & Design Decisions

### Campus Bounds Restriction
Map is restricted to campus bounds (`maxBounds`) for better performance. When working with routes outside the campus area, this restriction may need adjustment.

### Test Coverage
Referenced `test_main.py` in README but no tests currently exist. When creating tests, use pytest and consider testing:
- Graph construction from GeoJSON
- Shortest path calculation
- Turn instruction generation
- API endpoint responses
- Error handling for invalid coordinates

### 3D Terrain Defaults
Terrain is enabled by default with an 80° pitch. This provides dramatic visualization but may not be suitable for all users. The initial pitch can be adjusted via `INITIAL_TILT_PITCH` constant in `map.js`.

### Documentation Files
Two detailed markdown files document specific fixes:
- `CAMERA_PERSISTENCE_FIX.md` - Camera state management patterns
- `PITCH_ANIMATION_FIX.md` - Conditional animation logic

These files contain valuable context for understanding implementation decisions and should be preserved.
