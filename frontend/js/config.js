export const CONFIG = {
  map: {
    defaultCenter: [7.3837, 8.9919], // Campus center from buildings data
    defaultZoom: 16,
    maxBounds: [
      [7.37, 8.98],
      [7.4, 9.01],
    ], // Restrict panning
    campusBounds: [
      [7.3779, 8.9839],
      [7.3894, 8.9998],
    ], // Actual campus extent
    minZoom: 15,
    style: "mapbox://styles/mapbox/standard",
    lightPreset: "day",
    theme: "default",
    styles: [
      {
        id: "standard",
        name: "Standard",
        url: "mapbox://styles/mapbox/standard",
      },
      {
        id: "satellite",
        name: "Satellite",
        url: "mapbox://styles/mapbox/satellite-streets-v12",
      },
      {
        id: "terrain",
        name: "Terrain",
        url: "mapbox://styles/mapbox/outdoors-v12",
      },
    ],
  },
  api: {
    route: "/api/v1/route",
    roads: "/static/data/roads.geojson",
    buildings: "/static/data/buildings.geojson",
    footpath: "/static/data/Footpath.geojson",
    grass: "/static/data/Grass.geojson",
    greenArea: "/static/data/Green_area.geojson",
    sportArena: "/static/data/Sport_arena.geojson",
  },
  colors: {
    road: "#B8C8D8",
    building: "#FF8C00",
    buildingOutline: "#FFA500",
    route: "#FF8C00",
    routeGlow: "rgba(255, 140, 0, 0.4)",
    routeWalking: "#22C55E",
    routeWalkingGlow: "rgba(34, 197, 94, 0.4)",
    highlight: "#008751",
    markerStart: "#008751",
    markerEnd: "#E15B4F",
    footpath: "#8B4513",
    grass: "#7CFC00", // Lawn green - brighter
    grassOutline: "#32CD32",
    greenArea: "#2E8B57", // Sea green - darker/more muted
    greenAreaOutline: "#006400",
    sportArena: "#FFA07A",
    sportArenaOutline: "#FF6347",
    // Sport-specific colors
    sports: {
      football: { fill: "#22C55E", outline: "#16A34A", icon: "⚽" }, // Green
      basketball: { fill: "#F97316", outline: "#EA580C", icon: "🏀" }, // Orange
      volleyball: { fill: "#EAB308", outline: "#CA8A04", icon: "🏐" }, // Yellow
      badminton: { fill: "#3B82F6", outline: "#2563EB", icon: "🏸" }, // Blue
    },
  },
}
