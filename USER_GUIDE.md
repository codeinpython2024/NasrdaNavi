# NasrdaNavi User Guide

## Getting Started

### Setting Your Start Point

When you first open the app, you'll see two options:

1. **Set Start Point** - Click this button, then click anywhere on the map
2. **Use My Location** - Automatically use your current GPS location

**Tip:** The start point will be marked with a 📍 pin and will persist until you change it.

---

## Finding Directions

### Method 1: Click a Building

1. Click any building marker (🏢) on the map
2. A popup will appear with the building name
3. Click the **"Get Directions"** button
4. Turn-by-turn directions will appear in the panel

### Method 2: Search for a Building

1. Type the building name in the search box (top left)
2. Click the search result
3. The map will zoom to that building
4. Click the building marker
5. Click **"Get Directions"**

### Method 3: Click Any Point on Map

1. After setting your start point
2. Click anywhere on the map
3. Directions will be calculated to that point

---

## Understanding the Directions

### Direction Panel Shows:
- **Distance**: Total walking distance in meters
- **Time**: Estimated walking time (based on 1.4 m/s average speed)
- **Turn-by-turn instructions**: Numbered steps with road names

### Example:
```
Distance: 287m | Time: 3m 25s

1. Continue on Campus Path 12 for 53 m, then turn right onto Campus Path 5.
2. Continue on Campus Path 5 for 74 m, then continue straight onto Campus Path 1.
3. Continue on Campus Path 1 for 48 m, then make a u-turn onto Campus Path 4.
...
```

---

## Voice Guidance

- Directions are automatically read aloud when calculated
- Voice will announce each turn as you approach it (if GPS is enabled)
- Works best with headphones in noisy environments

---

## Accessibility Mode

Toggle **"Accessible routes only"** (left side) to:
- Prioritize wheelchair-accessible paths
- Avoid stairs and steep inclines
- Use ramps and elevators

**Note:** Requires accessibility data in road network (coming soon)

---

## Changing Your Route

### Change Start Point
1. Click **"Change Start"** button in directions panel
2. Set a new start point
3. Click a building again for new directions

### Clear Route
1. Click **"Clear Route"** button (red)
2. Route and directions will be removed
3. Start point remains set

---

## GPS Tracking (Live Navigation)

If you enable location services:
- Your current position shows as a green circle
- Map follows you as you walk
- Voice announces next turn when you're 20m away
- Automatically progresses through directions

---

## Search Tips

### Search by:
- **Building name**: "NASRDA", "Museum", "Research"
- **Department**: "Administration", "Research Division"
- **Partial names**: "Space", "Centre"

### Search is case-insensitive and matches partial words

---

## Map Features

### Markers:
- 🏢 **Buildings** - Click for info and directions
- 🅿️ **Parking** - Parking lots
- 🚻 **Restrooms** - Public facilities
- 📍 **Start Point** - Your starting location
- 📌 **Destination** - Where you're going
- 🟢 **Your Location** - Live GPS position (if enabled)

### Colors:
- **Blue lines** - Roads and paths
- **Red polygons** - Building footprints
- **Blue route** - Your calculated path

---

## Keyboard Shortcuts

- **Escape** - Close search results
- **Enter** in search - Select first result

---

## Troubleshooting

### "Please set a start point first"
- You tried to get directions without setting where you're starting from
- Click **"Set Start Point"** or **"Use My Location"**

### "Start point is outside campus area"
- Your selected point is not on the NASRDA campus
- Click within the campus boundaries

### "Start point is too far from any road"
- You clicked in an area with no nearby paths
- Click closer to a road or building entrance

### "No path found between these points"
- The two points are on disconnected road segments
- Try selecting points on the main road network

### Voice not working
- Check browser permissions for audio
- Ensure volume is not muted
- Try refreshing the page

### GPS not working
- Enable location services in browser
- Grant permission when prompted
- Works best outdoors with clear sky view

---

## Best Practices

### For Accurate Directions:
1. Set start point at a building entrance or road
2. Click building markers (not random map points)
3. Use search to find specific buildings
4. Enable GPS for live tracking

### For Accessibility:
1. Toggle "Accessible routes only"
2. Check building accessibility info in popup
3. Plan extra time for accessible routes

### For Visitors:
1. Use "Use My Location" at campus entrance
2. Search for your destination building
3. Follow voice guidance
4. Keep phone charged for GPS

---

## Campus Buildings

### Key Locations:
- **NASRDA Headquarters** - Main administrative building
- **Centre for Atmospheric Research** - Research facilities
- **Space Museum** - Public exhibits and tours
- **Strategic Space Application (SSA)** - Strategic planning
- **MPSDM** - Mission Planning and Space Data Management

### Total: 63 buildings on campus

---

## Technical Details

### Routing Algorithm:
- Uses Dijkstra's shortest path algorithm
- Calculates based on actual road network
- Considers walking distance and time

### Distance Calculation:
- Accurate to within 1% at campus latitude
- Accounts for Earth's curvature
- Based on Haversine formula

### GPS Accuracy:
- Typically ±5-10 meters
- Better outdoors than indoors
- Improves with clear sky view

---

## Privacy & Data

### What We Track:
- Nothing! All routing is done locally in your browser
- No personal data is stored or transmitted
- GPS location is only used for navigation (not saved)

### Permissions Needed:
- **Location** (optional) - For "Use My Location" and GPS tracking
- **Audio** (optional) - For voice guidance

---

## Support

### Need Help?
- Contact: IT Department
- Email: [support email]
- Phone: [support phone]

### Report Issues:
- Missing buildings
- Incorrect directions
- Accessibility concerns
- Technical problems

---

## Updates & Roadmap

### Coming Soon:
- Indoor navigation for multi-story buildings
- Real-time building status (open/closed)
- Parking availability
- Event locations
- Shuttle schedules
- Mobile app (PWA)

### Recent Updates:
- ✅ Improved routing workflow
- ✅ Building click-to-route
- ✅ Better error handling
- ✅ Accessibility mode
- ✅ Voice guidance
- ✅ GPS tracking

---

## Quick Reference

| Action | How To |
|--------|--------|
| Set start | Click "Set Start Point" → Click map |
| Use GPS | Click "Use My Location" |
| Get directions | Click building → "Get Directions" |
| Search | Type in search box (top left) |
| Clear route | Click "Clear Route" (red button) |
| Change start | Click "Change Start" |
| Accessibility | Toggle checkbox (left side) |
| Voice on/off | Browser audio settings |

---

**Version:** 1.0  
**Last Updated:** October 18, 2025  
**Campus:** NASRDA Headquarters
