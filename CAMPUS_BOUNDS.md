# Campus Bounding Box

## Calculated from GeoJSON Data

The campus bounding box has been calculated from the actual GeoJSON data files to ensure accurate map positioning.

### Coordinates

**Southwest Corner:** `[7.383311885048632, 8.986260622829548]`  
**Northeast Corner:** `[7.389412099633819, 8.992891300009468]`  
**Center:** `[7.386361992341225, 8.989575961419508]`

### Data Summary

- **Roads:** 28 features (all named)
- **Buildings:** 63 features (all named)
- **Total Features:** 91 features

### Geographic Extent

- **Longitude Range:** 7.383311885048632 to 7.389412099633819 (≈0.0061 degrees)
- **Latitude Range:** 8.986260622829548 to 8.992891300009468 (≈0.0066 degrees)
- **Approximate Size:** ~680m × ~730m

### Sample Features

- **National Space Research and Development Agency** (main building)
- **Centre for Atmospheric Research**
- **Space Museum**
- **Strategic Space Application (SSA)**
- **MPSDM** (with departments: MPSDM, CSTD, IT)

### Implementation

The campus bounds are now used as:
1. Initial map center and zoom level
2. Default fallback when GeoJSON data is unavailable
3. Default center for feature calculations
4. Fallback bounds for map fitting

### Location

This appears to be in Nigeria (based on coordinates 7.38°N, 8.98°E), likely the NASRDA (National Space Research and Development Agency) campus.

