# Get Directions Button Fix

## Issue
When a user clicked the "Get Directions" button on a building popup without setting a start point first, the button appeared to do nothing. The popup remained open with no visible notification, making it unclear that any action had occurred.

## Root Cause
The `routeToBuilding()` function correctly showed an error toast message ("Please set a start point first") when no start point was set, but:
1. The popup didn't close, leaving the user staring at the same screen
2. The toast notification styles were present in the HTML but Flask was serving a cached template version

## Solution

### 1. Close Popup After Error
Added `map.closePopup()` with a 100ms delay to close the building popup after showing the error message.

**File:** `static/map.js`

```javascript
// Global routing function
window.routeToBuilding = function (lon, lat, name) {
  if (!startPoint) {
    showToast('Please set a start point first', 'error');
    // Close any open popups
    setTimeout(() => {
      map.closePopup();
    }, 100);
    updateModeUI();
    return;
  }

  const endPoint = { lng: lon, lat: lat };
  if (endMarker) map.removeLayer(endMarker);
  endMarker = L.marker([lat, lon]).addTo(map).bindPopup(`End: ${name}`).openPopup();

  calculateRoute(startPoint, endPoint);
};
```

### 2. Disable Flask Template Caching
Added configuration to prevent Flask from caching templates in development.

**File:** `main.py`

```python
app = Flask(__name__)
app.config.from_object(Config)
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
```

## Testing Results
✅ **Without start point:** Clicking "Get Directions" shows red error toast notification and closes popup  
✅ **With start point:** Clicking "Get Directions" calculates route and displays directions  
✅ Toast notification is visible at bottom center of screen for 3 seconds  
✅ No JavaScript errors or console warnings

## User Experience Improvement
- Clear visual feedback with red error toast notification
- Error message is prominent and understandable: "Please set a start point first"
- Popup closes automatically, reducing confusion
- User can immediately see the navigation panel prompting them to set a start point
- Toast auto-dismisses after 3 seconds
