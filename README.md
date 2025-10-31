# NasrdaNavi

A Flask-based web application for campus navigation and routing. This application provides turn-by-turn navigation instructions using graph-based pathfinding algorithms on road network data. It features an interactive map interface powered by Mapbox and calculates optimal routes between points on campus.

## Description

NasrdaNavi is a navigation system that uses GeoPandas to process road network data (GeoJSON format) and NetworkX to build a graph representation of the road network. The application calculates shortest paths between locations and generates detailed turn-by-turn navigation instructions with distances and road names.

## How to Run

To run the `main.py` script, execute the following command in your terminal:

```bash
python main.py
```

The application will start a Flask development server on `http://localhost:5001`. Open your web browser and navigate to this URL to access the application.

**Note:** Make sure you have:
1. Installed all required dependencies from `requirements.txt`:
   ```bash
   pip install -r requirements.txt
   ```
2. Set up your Mapbox access token in a `.env` file:
   ```
   MAPBOX_ACCESS_TOKEN=your_token_here
   ```
3. Ensured that the required GeoJSON files (`static/roads.geojson` and `static/buildings.geojson`) are present in the `static/` directory.

## How to Test

To run the tests for this project, execute the following command in your terminal:

```bash
pytest test_main.py
```

This will run all test cases defined in `test_main.py` and display the test results.

