# Navigation & Routing Review - NasrdaNavi

**Date:** October 18, 2025  
**Campus:** NASRDA HQ  
**Review Status:** ⚠️ Issues Identified

---

## Current Implementation

### Routing Engine
- **Algorithm:** Dijkstra's shortest path (NetworkX)
- **Network:** 28 road segments, 138 nodes
- **Snapping:** cKDTree spatial indexing for point-to-road matching
- **Distance Calculation:** Haversine approximation (111,139 m/degree)

### Turn-by-Turn Directions
- **Bearing Calculation:** atan2-based angle between segments
- **Turn Detection:** ±20° threshold for straight/left/right
- **Voice Guidance:** Web Speech API
- **GPS Tracking:** Geolocation API with 30m proximity triggers

---

## Test Results

### ✅ Working Features

1. **Route Calculation**
   - Successfully finds paths between campus points
   - Example: HQ to Museum = 289m, ~3.5 min walk
   - Handles multiple waypoints correctly

2. **Distance & Time Estimates**
   - Distance: Accurate within road network
   - Time: Based on 1.4 m/s walking speed (reasonable)

3. **Interactive Map**
   - Click-to-route interface works
   - Route visualization displays correctly
   - Building markers show properly

4. **Search Integration**
   - Can search buildings and use as destinations
   - POI markers clickable for routing

---

## ⚠️ Critical Issues

### 1. **All Roads Are Unnamed**
**Problem:** All 28 road segments have empty/blank names
```
Road names: "  " (28 roads)
```

**Impact:**
- Directions show: "Continue on   for 54 m, then turn right onto  ."
- Impossible to follow without visual reference
- Voice guidance is meaningless

**Solution Required:**
- Name roads based on campus layout (e.g., "Main Drive", "East Path")
- Or use building references (e.g., "Road near HQ", "Museum Access")
- Update roads.geojson with proper names

---

### 2. **Poor Turn Detection**
**Problem:** Generates too many turn instructions for simple routes
```
289m route = 6 turn instructions (every 48m average)
```

**Issues:**
- Overly sensitive to minor angle changes
- Doesn't consolidate straight segments
- Creates confusion with frequent instructions

**Recommendations:**
- Increase straight threshold from 20° to 30°
- Merge consecutive straight segments on same road
- Only announce turns >45° as significant
- Add "slight left/right" for 20-45° turns

---

### 3. **No Error Handling for Disconnected Points**
**Problem:** Points outside road network cause 500 errors
```
Test: start=7.0,8.0 end=7.1,8.1
Result: 500 Internal Server Error
```

**Impact:**
- App crashes when clicking outside campus
- No user-friendly error message
- Poor UX for accidental clicks

**Solution:**
- Check if snapped points are within reasonable distance
- Return 400 with clear message: "Point too far from roads"
- Add visual boundary indicator on map

---

### 4. **Inaccurate Distance Calculation**
**Problem:** Uses fixed 111,139 m/degree for all directions
```python
length_m = LineString([p1, p2]).length * 111_139
```

**Issue:**
- Only accurate at equator
- At latitude 8.99°N, longitude distances should be ~110,000 m/degree
- Error: ~1% overestimation

**Fix:**
```python
lat_avg = (p1[1] + p2[1]) / 2
lon_scale = 111_139 * math.cos(math.radians(lat_avg))
lat_scale = 111_139
dx = (p2[0] - p1[0]) * lon_scale
dy = (p2[1] - p1[1]) * lat_scale
length_m = math.sqrt(dx**2 + dy**2)
```

---

### 5. **No Accessibility Routing**
**Problem:** Single routing mode for all users
- No wheelchair-accessible path option
- No consideration for stairs/ramps
- Accessibility data in POIs not used

**Recommendation:**
- Add `accessible=true` parameter to route endpoint
- Filter roads/paths by accessibility
- Mark accessible entrances in building data

---

### 6. **Limited Road Network**
**Observation:** Only 28 road segments for 63 buildings
- Average: 2.25 buildings per road segment
- Likely missing pedestrian paths
- May not reach all building entrances

**Action Needed:**
- Survey campus for missing paths
- Add pedestrian walkways
- Verify all buildings are reachable

---

### 7. **GPS Tracking Issues**
**Problems:**
- Creates new marker on every position update (memory leak)
- No cleanup of old position markers
- 30m trigger distance may be too large for campus

**Code Issue:**
```javascript
userMarker = L.circleMarker(userLatLng, ...).addTo(map);
// Never removes previous userMarker
```

**Fix:** Remove old marker before adding new one

---

## 🔧 Recommended Improvements

### High Priority

1. **Name All Roads**
   - Manual survey and naming
   - Use building references if no official names
   - Update roads.geojson

2. **Fix Turn Instructions**
   - Reduce instruction frequency
   - Add road names to directions
   - Improve turn angle thresholds

3. **Better Error Handling**
   - Validate input coordinates
   - Check point-to-road distance
   - User-friendly error messages

4. **Fix GPS Marker Cleanup**
   - Remove old position markers
   - Optimize update frequency

### Medium Priority

5. **Accurate Distance Calculation**
   - Implement proper Haversine formula
   - Account for latitude

6. **Accessibility Mode**
   - Add accessible routing option
   - Filter by accessibility features

7. **Route Alternatives**
   - Shortest vs. most accessible
   - Scenic route option

### Low Priority

8. **Indoor Navigation**
   - Multi-floor routing for buildings
   - Room-to-room directions

9. **Landmark-Based Directions**
   - "Pass the museum on your left"
   - More natural language

10. **Route Optimization**
    - Multi-stop routing
    - Waypoint optimization

---

## Performance Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Route calculation | <500ms | <200ms |
| Instruction clarity | 2/10 | 8/10 |
| GPS accuracy | ±10m | ±5m |
| Error handling | 3/10 | 9/10 |
| Accessibility | 0/10 | 7/10 |

---

## Conclusion

**Overall Assessment:** Functional but needs significant improvements

**Strengths:**
- Core routing algorithm works
- Good UI/UX foundation
- Proper data structure

**Critical Blockers:**
- Unnamed roads make directions unusable
- Poor error handling
- No accessibility support

**Recommendation:** Address high-priority issues before deployment. The app is technically sound but not user-ready without road names and better turn instructions.

---

## Next Steps

1. Survey campus and name all roads (1-2 days)
2. Implement fixes for high-priority issues (2-3 days)
3. User testing with staff (1 week)
4. Iterate based on feedback
5. Deploy beta version
