# NasrdaNavi

Campus Navigation System for NASRDA (National Space Research and Development Agency of Nigeria)

NasrdaNavi is an interactive map-based navigation application that helps users navigate the NASRDA campus with turn-by-turn directions, voice assistance, and both walking and driving route options.

## Features

- **Interactive Map** - Powered by Mapbox GL JS with 3D building support
- **Route Planning** - Calculate routes between any two points on campus
- **Walking & Driving Modes** - Separate routing graphs for pedestrian and vehicle navigation
- **Voice Assistant** - Text-to-speech navigation with Nigerian English voice support
- **Fuzzy Search** - Find buildings, roads, departments, and sports facilities
- **Layer Controls** - Toggle visibility of buildings, roads, footpaths, green areas, and sport arenas
- **Responsive Design** - Works on desktop, tablet, and mobile devices
- **Accessibility** - ARIA labels, keyboard navigation, and screen reader support

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- A Mapbox account with an access token

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd NasrdaNavi
   ```

2. **Create a virtual environment** (recommended)

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

   If `requirements.txt` doesn't exist, install the core dependencies:

   ```bash
   pip install flask python-dotenv networkx scipy shapely geopandas flask-limiter
   ```

4. **Set up environment variables**

   Copy the example environment file and add your Mapbox token:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Mapbox access token:

   ```
   MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
   ```

## Running the Application

1. **Start the development server**

   ```bash
   python main.py
   ```

2. **Open in browser**

   Navigate to [http://localhost:5001](http://localhost:5001)

## Project Structure

```
NasrdaNavi/
├── backend/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── routes.py      # API route endpoints
│   │   │   ├── map.py         # Map configuration endpoint
│   │   │   └── logging.py     # Error logging endpoint
│   │   └── errors.py          # Error handlers
│   ├── data/
│   │   ├── geojson_loader.py  # GeoJSON data loading
│   │   └── graph_builder.py   # Navigation graph construction
│   ├── services/
│   │   ├── routing_service.py # Route calculation
│   │   └── navigation_service.py # Turn-by-turn directions
│   ├── cache/                  # Cached graph data
│   └── config.py              # Application configuration
├── frontend/
│   ├── css/
│   │   ├── variables.css      # CSS custom properties
│   │   ├── main.css           # Global styles
│   │   ├── components.css     # UI component styles
│   │   ├── map.css            # Map-specific styles
│   │   ├── splash.css         # Splash screen styles
│   │   ├── voice.css          # Voice assistant styles
│   │   └── mobile.css         # Responsive styles
│   └── js/
│       ├── config.js          # Frontend configuration
│       ├── main.js            # Application entry point
│       └── modules/
│           ├── map/           # Map management
│           ├── navigation/    # Route navigation
│           ├── ui/            # UI management
│           ├── voice/         # Voice assistant
│           ├── mascot/        # Mascot animations
│           ├── splash/        # Splash screen
│           └── utils/         # Utilities
├── static/
│   └── data/                  # GeoJSON data files
├── templates/
│   └── index.html             # Main HTML template
├── main.py                    # Application entry point
└── README.md
```

## API Endpoints

### Route Calculation

```
GET /api/v1/route
```

**Parameters:**

- `start` - Start coordinates (lng,lat)
- `end` - End coordinates (lng,lat)
- `mode` - Transport mode (`driving` or `walking`)

**Response:**

```json
{
  "route": { "type": "Feature", "geometry": {...} },
  "directions": [
    { "text": "Continue on Main Road for 50 meters...", "location": [...] }
  ],
  "total_distance_m": 250,
  "mode": "walking"
}
```

### Map Configuration

```
GET /api/v1/map-config
```

Returns the Mapbox access token for client-side map initialization.

## Configuration

Environment variables can be set in the `.env` file:

| Variable              | Description               | Default                         |
| --------------------- | ------------------------- | ------------------------------- |
| `MAPBOX_ACCESS_TOKEN` | Mapbox API access token   | (required)                      |
| `FLASK_DEBUG`         | Enable debug mode         | `False`                         |
| `LOG_LEVEL`           | Logging level             | `INFO`                          |
| `ROADS_FILE`          | Path to roads GeoJSON     | `static/data/roads.geojson`     |
| `BUILDINGS_FILE`      | Path to buildings GeoJSON | `static/data/buildings.geojson` |
| `FOOTPATH_FILE`       | Path to footpaths GeoJSON | `static/data/Footpath.geojson`  |

## Development

### Adding New GeoJSON Data

1. Place your GeoJSON file in `static/data/`
2. Update the loader in `backend/data/geojson_loader.py`
3. Delete cached graphs in `backend/cache/` to rebuild

### Clearing the Graph Cache

```bash
rm backend/cache/*.pkl backend/cache/*.hash
```

The cache will be automatically rebuilt on the next application start.

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## License

This project is developed for NASRDA (National Space Research and Development Agency of Nigeria).

## Acknowledgments

- Map tiles and services by [Mapbox](https://www.mapbox.com/)
- Routing powered by [NetworkX](https://networkx.org/)
- Search powered by [Fuse.js](https://fusejs.io/)
- Animations by [GSAP](https://greensock.com/gsap/)
