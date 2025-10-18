# NasrdaNavi - NASRDA HQ Campus Navigation System

A web-based navigation system for NASRDA headquarters campus with turn-by-turn directions, POI search, and GPS tracking.

## Features

- 🗺️ Interactive campus map with building and amenity markers
- 🔍 Search for buildings, departments, and rooms
- 🧭 Turn-by-turn navigation with voice guidance
- 📍 Real-time GPS tracking
- ⏱️ Distance and time estimates
- ♿ Accessibility information for buildings

## Setup

### Prerequisites

- Python 3.8+
- pip

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd NasrdaNavi
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the application:
```bash
python main.py
```

4. Open browser to `http://localhost:5000`

## Configuration

Set environment variables:

```bash
export FLASK_DEBUG=true  # Enable debug mode (development only)
export SECRET_KEY=your-secret-key  # Change in production
```

## Usage

### Navigation
1. Click on the map to set start point
2. Click again to set destination
3. View turn-by-turn directions in the panel
4. Follow voice guidance and GPS tracking

### Search
- Type building name, department, or room number in search box
- Click result to view location on map
- Use location as navigation destination

## Data Files

- `static/roads.geojson` - Campus road network
- `static/buildings.geojson` - Building footprints
- `static/pois.json` - Points of interest (buildings, amenities)

## API Endpoints

- `GET /` - Main application
- `GET /api/search?q=query` - Search POIs
- `GET /api/pois` - Get all POIs
- `GET /route?start=lon,lat&end=lon,lat` - Calculate route

## Development

### Adding New Buildings

Edit `static/pois.json`:

```json
{
  "id": "unique-id",
  "name": "Building Name",
  "department": "Department Name",
  "type": "office|lab|amenity",
  "coordinates": [longitude, latitude],
  "entrance": [longitude, latitude],
  "accessible": true,
  "hours": "8:00-17:00",
  "rooms": ["101", "102"],
  "description": "Description"
}
```

### Updating Road Network

1. Export GeoJSON from mapping tool
2. Replace `static/roads.geojson`
3. Restart application

## Production Deployment

1. Set `FLASK_DEBUG=false`
2. Use production WSGI server (gunicorn):
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 main:app
```

3. Set up reverse proxy (nginx)
4. Enable HTTPS

## Roadmap

- [ ] Indoor navigation for multi-story buildings
- [ ] Accessibility routing mode
- [ ] Real-time building status (open/closed)
- [ ] User accounts and favorites
- [ ] Mobile app (PWA)
- [ ] Admin dashboard

## License

Internal use - NASRDA

## Support

Contact: IT Department
