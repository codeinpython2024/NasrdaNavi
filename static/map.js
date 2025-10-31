/**
 * Enhanced Mapbox GL JS Navigation System
 * 
 * MAPBOX FEATURES IMPLEMENTED:
 * 
 * 1. BUILT-IN CONTROLS:
 *    - NavigationControl: Zoom and rotation controls with pitch visualization
 *    - GeolocateControl: User location tracking with high accuracy
 *    - ScaleControl: Metric scale bar
 *    - FullscreenControl: Full-screen map mode
 *    - AttributionControl: Compact attribution display
 * 
 * 2. CUSTOM CONTROLS:
 *    - Style Switcher: Switch between 6 map styles (streets, satellite, outdoors, light, dark, navigation)
 *    - 3D Terrain Toggle: Enable/disable 3D terrain with elevation data and sky atmosphere
 *    - Layer Toggle: Show/hide roads, buildings, road labels, and route layers
 *    - Pitch/Bearing Control: Adjust camera angle and reset view
 * 
 * 3. MAP STYLES:
 *    - Mapbox Standard (modern 3D style), Streets (default), Satellite Streets, Outdoors, Light, Dark, Navigation Day
 *    - Preserves custom layers (roads, buildings, routes) when switching styles
 * 
 * 4. 3D FEATURES:
 *    - Terrain: Raster DEM with 1.2x exaggeration (optimized for campus-scale terrain)
 *    - Sky Layer: Atmospheric rendering for 3D effect
 *    - Hillshade: Subtle terrain shading for depth perception
 *    - Contour Lines: Topographic lines at zoom 16+ for campus detail
 *    - Subtle Fog: Depth perception without obscuring campus features
 *    - Pitch Control: 0-60 degrees camera tilt
 *    - Bearing Control: 360-degree rotation
 * 
 * 5. ROUTE VISUALIZATION:
 *    - Gradient route line: Green (start) → Yellow (middle) → Red (end)
 *    - Animated dashed overlay: Moving dashes for visual feedback
 *    - Line metrics enabled for gradient effects
 *    - Smooth animations with requestAnimationFrame
 * 
 * 6. LAYER MANAGEMENT:
 *    - Dynamic layer visibility toggling
 *    - Custom GeoJSON layers (roads, buildings)
 *    - Layer persistence across style changes
 *    - Proper layer ordering and z-index
 * 
 * 7. INTERACTIONS:
 *    - Hover effects on roads with popups
 *    - Smooth flyTo animations
 *    - EaseTo transitions for pitch/bearing
 *    - Interactive markers with scale effects
 * 
 * 8. PERFORMANCE:
 *    - Antialiasing enabled for smooth rendering
 *    - RequestAnimationFrame for efficient animations
 *    - Proper layer cleanup and memory management
 *    - Optimized GeoJSON rendering
 *    - MaxBounds restriction to campus area for better performance
 *    - Emissive strength on all custom layers for proper GL JS v3 lighting
 */

// --- Initialize Map with Mapbox GL JS ---
// Campus bounds calculated from GeoJSON data:
// Bounds: [7.383311885048632, 8.986260622829548] to [7.389412099633819, 8.992891300009468]
// Center: [7.386361992341225, 8.989575961419508]
const CAMPUS_CENTER = [7.386361992341225, 8.989575961419508]; // [lng, lat]
const CAMPUS_BOUNDS = [
    [7.383311885048632, 8.986260622829548], // Southwest corner
    [7.389412099633819, 8.992891300009468]  // Northeast corner
];

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/standard', // Modern standard style with 3D features
    center: CAMPUS_CENTER, // [lng, lat] - Campus center
    zoom: 16, // Higher zoom to see campus details
    pitch: 70, // Slanted 3D view - maximum tilt for dramatic perspective (0-85 degrees)
    bearing: 20, // Initial bearing (0-360 degrees)
    antialias: true, // Enable antialiasing for smoother rendering
    maxBounds: CAMPUS_BOUNDS // Restrict panning to campus area for better performance
});

// Add Mapbox Controls
// 1. Navigation Control (zoom and rotation)
const nav = new mapboxgl.NavigationControl({
    visualizePitch: true,
    showZoom: true,
    showCompass: true
});
map.addControl(nav, 'top-left');

// 2. Geolocate Control (find user location)
const geolocate = new mapboxgl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true
    },
    trackUserLocation: true,
    showUserHeading: true,
    showUserLocation: true
});
map.addControl(geolocate, 'top-left');

// 3. Scale Control
const scale = new mapboxgl.ScaleControl({
    maxWidth: 100,
    unit: 'metric'
});
map.addControl(scale, 'bottom-left');

// 4. Fullscreen Control
const fullscreen = new mapboxgl.FullscreenControl();
map.addControl(fullscreen, 'top-right');

// 5. Attribution Control (already default, but customizing)
map.addControl(new mapboxgl.AttributionControl({
    compact: true
}));

// Map Styles Configuration
const MAP_STYLES = {
    standard: 'mapbox://styles/mapbox/standard',  // Modern default style with 3D features
    streets: 'mapbox://styles/mapbox/streets-v12',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    outdoors: 'mapbox://styles/mapbox/outdoors-v12',
    light: 'mapbox://styles/mapbox/light-v11',
    dark: 'mapbox://styles/mapbox/dark-v11',
    navigation: 'mapbox://styles/mapbox/navigation-day-v1'
};

let currentStyle = 'standard';
let terrain3DEnabled = true; // Enable 3D terrain by default

// Custom Map Style Switcher Control
class StyleSwitcherControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        this._container.innerHTML = `
            <button type="button" title="Change Map Style" aria-label="Change map style" style="position: relative;">
                <i class="fas fa-layer-group"></i>
            </button>
        `;

        const button = this._container.querySelector('button');
        const dropdown = document.createElement('div');
        dropdown.className = 'style-dropdown';
        dropdown.style.cssText = 'padding: 8px; min-width: 150px;';
        dropdown.style.display = 'none';  // Initialize as hidden

        Object.keys(MAP_STYLES).forEach(styleName => {
            const styleBtn = document.createElement('button');
            styleBtn.className = 'style-option';
            styleBtn.textContent = styleName.charAt(0).toUpperCase() + styleName.slice(1);
            styleBtn.style.cssText = 'display: block; width: 100%; padding: 8px; margin: 4px 0; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; text-align: left;';
            styleBtn.onclick = () => {
                switchMapStyle(styleName);
                dropdown.style.display = 'none';
            };

            styleBtn.onmouseenter = () => {
                styleBtn.style.backgroundColor = '#f0f0f0';
            };
            styleBtn.onmouseleave = () => {
                styleBtn.style.backgroundColor = 'white';
            };

            dropdown.appendChild(styleBtn);
        });

        this._container.appendChild(dropdown);

        button.onclick = (e) => {
            e.stopPropagation();
            dropdown.style.display = (dropdown.style.display === 'none' || dropdown.style.display === '') ? 'block' : 'none';
        };

        // Prevent dropdown clicks from closing it
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        document.addEventListener('click', () => {
            dropdown.style.display = 'none';
        });

        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

// Custom 3D Terrain Toggle Control with exaggeration slider
class Terrain3DControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        this._container.innerHTML = `
            <button type="button" id="terrain3DBtn" title="Toggle 3D Terrain" aria-label="Toggle 3D terrain" style="position: relative;">
                <i class="fas fa-mountain"></i>
            </button>
        `;

        const button = this._container.querySelector('button');
        const dropdown = document.createElement('div');
        dropdown.className = 'terrain-dropdown';
        dropdown.style.cssText = 'padding: 12px; min-width: 200px;';
        dropdown.style.display = 'none';  // Initialize as hidden
        dropdown.innerHTML = `
            <div style="margin-bottom: 8px; font-weight: bold; font-size: 12px; color: #333;">Terrain Settings</div>
            <label style="display: block; margin: 8px 0; cursor: pointer;">
                <input type="checkbox" id="terrain3DToggle" ${terrain3DEnabled ? 'checked' : ''}> Enable 3D Terrain
            </label>
            <div id="terrainExaggerationControl" style="margin-top: 12px; ${terrain3DEnabled ? '' : 'display: none;'}">
                <label style="display: block; font-size: 11px; color: #666; margin-bottom: 4px;">
                    Exaggeration: <span id="exaggerationValue">1.2</span>x
                </label>
                <input type="range" id="exaggerationSlider" min="0.5" max="5" step="0.1" value="1.2" 
                       style="width: 100%; cursor: pointer;">
            </div>
        `;

        this._container.appendChild(dropdown);

        button.onclick = (e) => {
            e.stopPropagation();
            dropdown.style.display = (dropdown.style.display === 'none' || dropdown.style.display === '') ? 'block' : 'none';
        };

        // Prevent dropdown clicks from closing it
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        document.addEventListener('click', () => {
            dropdown.style.display = 'none';
        });

        // Setup terrain toggle
        setTimeout(() => {
            const terrainToggle = document.getElementById('terrain3DToggle');
            const exaggerationControl = document.getElementById('terrainExaggerationControl');
            const exaggerationSlider = document.getElementById('exaggerationSlider');
            const exaggerationValue = document.getElementById('exaggerationValue');

            if (terrainToggle) {
                terrainToggle.addEventListener('change', (e) => {
                    e.stopPropagation();
                    toggle3DTerrain();
                    if (exaggerationControl) {
                        exaggerationControl.style.display = terrain3DEnabled ? 'block' : 'none';
                    }
                });
            }

            if (exaggerationSlider && exaggerationValue) {
                exaggerationSlider.addEventListener('input', (e) => {
                    e.stopPropagation();
                    const value = parseFloat(e.target.value);
                    exaggerationValue.textContent = value.toFixed(1);
                    if (terrain3DEnabled && map.getTerrain()) {
                        map.setTerrain({ source: 'mapbox-dem', exaggeration: value });
                    }
                });
            }
        }, 100);

        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

// Custom Layer Toggle Control
class LayerToggleControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        this._container.innerHTML = `
            <button type="button" title="Toggle Layers" aria-label="Toggle map layers" style="position: relative;">
                <i class="fas fa-list"></i>
            </button>
        `;

        const button = this._container.querySelector('button');
        const dropdown = document.createElement('div');
        dropdown.className = 'layer-dropdown';
        dropdown.style.cssText = 'padding: 12px; min-width: 180px;';
        dropdown.style.display = 'none';  // Initialize as hidden
        dropdown.innerHTML = `
            <div style="margin-bottom: 8px; font-weight: bold; font-size: 12px; color: #333;">Map Layers</div>
            <label style="display: block; margin: 8px 0; cursor: pointer;">
                <input type="checkbox" id="roadsLayerToggle" checked> Roads
            </label>
            <label style="display: block; margin: 8px 0; cursor: pointer;">
                <input type="checkbox" id="buildingsLayerToggle" checked> Buildings
            </label>
            <label style="display: block; margin: 8px 0; cursor: pointer;">
                <input type="checkbox" id="roadLabelsToggle" checked> Road Labels
            </label>
            <label style="display: block; margin: 8px 0; cursor: pointer;">
                <input type="checkbox" id="routeLayerToggle" checked> Route
            </label>
        `;

        this._container.appendChild(dropdown);

        button.onclick = (e) => {
            e.stopPropagation();
            dropdown.style.display = (dropdown.style.display === 'none' || dropdown.style.display === '') ? 'block' : 'none';
        };

        // Prevent dropdown clicks from closing it
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        document.addEventListener('click', () => {
            dropdown.style.display = 'none';
        });

        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

// Custom Pitch and Bearing Control with enhanced features
class PitchBearingControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        this._container.innerHTML = `
            <button type="button" id="pitchUpBtn" title="Increase Pitch (Tilt Up)" aria-label="Increase pitch">
                <i class="fas fa-angle-up"></i>
            </button>
            <button type="button" id="pitchDownBtn" title="Decrease Pitch (Tilt Down)" aria-label="Decrease pitch">
                <i class="fas fa-angle-down"></i>
            </button>
            <button type="button" id="rotateLeftBtn" title="Rotate Left" aria-label="Rotate map left">
                <i class="fas fa-undo"></i>
            </button>
            <button type="button" id="rotateRightBtn" title="Rotate Right" aria-label="Rotate map right">
                <i class="fas fa-redo"></i>
            </button>
            <button type="button" id="resetViewBtn" title="Reset View (North Up, Level)" aria-label="Reset camera view">
                <i class="fas fa-compass"></i>
            </button>
        `;

        const pitchUpBtn = this._container.querySelector('#pitchUpBtn');
        const pitchDownBtn = this._container.querySelector('#pitchDownBtn');
        const rotateLeftBtn = this._container.querySelector('#rotateLeftBtn');
        const rotateRightBtn = this._container.querySelector('#rotateRightBtn');
        const resetViewBtn = this._container.querySelector('#resetViewBtn');

        pitchUpBtn.onclick = () => {
            const currentPitch = map.getPitch();
            map.easeTo({ pitch: Math.min(currentPitch + 15, 85), duration: 300 });
        };

        pitchDownBtn.onclick = () => {
            const currentPitch = map.getPitch();
            map.easeTo({ pitch: Math.max(currentPitch - 15, 0), duration: 300 });
        };

        rotateLeftBtn.onclick = () => {
            const currentBearing = map.getBearing();
            map.easeTo({ bearing: currentBearing - 45, duration: 400 });
        };

        rotateRightBtn.onclick = () => {
            const currentBearing = map.getBearing();
            map.easeTo({ bearing: currentBearing + 45, duration: 400 });
        };

        resetViewBtn.onclick = () => {
            map.easeTo({
                pitch: 0,
                bearing: 0,
                duration: 800,
                easing: (t) => t * (2 - t)
            });
        };

        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

// Add custom controls
map.addControl(new StyleSwitcherControl(), 'top-right');
map.addControl(new Terrain3DControl(), 'top-right');
map.addControl(new LayerToggleControl(), 'top-right');
map.addControl(new PitchBearingControl(), 'top-right');

// Switch map style function
function switchMapStyle(styleName) {
    if (!MAP_STYLES[styleName]) return;

    currentStyle = styleName;
    const currentLayers = {};
    const currentSources = {};

    // Save current custom layers and sources
    if (map.getSource('roads-source')) {
        currentSources['roads-source'] = map.getSource('roads-source').serialize();
    }
    if (map.getSource('buildings-source')) {
        currentSources['buildings-source'] = map.getSource('buildings-source').serialize();
    }
    if (map.getSource('route-source')) {
        currentSources['route-source'] = map.getSource('route-source').serialize();
    }

    // Change style
    map.setStyle(MAP_STYLES[styleName]);

    // Re-add custom layers after style loads
    map.once('style.load', () => {
        // Re-add sources and layers
        if (currentSources['roads-source']) {
            map.addSource('roads-source', currentSources['roads-source']);
            addRoadsLayers();
        }
        if (currentSources['buildings-source']) {
            map.addSource('buildings-source', currentSources['buildings-source']);
            addBuildingsLayers();
        }
        if (currentSources['route-source']) {
            map.addSource('route-source', currentSources['route-source']);
            addRouteLayer();
        }

        // Re-enable terrain if it was enabled
        if (terrain3DEnabled) {
            enable3DTerrain();
        }

        showStatus(`Map style changed to ${styleName}`, 'info', 2000);
    });
}

// Toggle 3D terrain
function toggle3DTerrain() {
    terrain3DEnabled = !terrain3DEnabled;
    const btn = document.getElementById('terrain3DBtn');

    if (terrain3DEnabled) {
        enable3DTerrain();
        if (btn) {
            btn.style.backgroundColor = '#007bff';
            btn.style.color = 'white';
        }
        showStatus('3D terrain enabled', 'info', 2000);
    } else {
        disable3DTerrain();
        if (btn) {
            btn.style.backgroundColor = '';
            btn.style.color = '';
        }
        showStatus('3D terrain disabled', 'info', 2000);
    }
}

// Enable 3D terrain with enhanced visual effects
function enable3DTerrain() {
    // Add terrain source with high-resolution DEM
    if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 512,
            maxzoom: 14
        });
    }

    // Set terrain with realistic exaggeration for campus-scale terrain
    map.setTerrain({
        source: 'mapbox-dem',
        exaggeration: 1.2  // Realistic campus terrain (campuses have minimal elevation changes)
    });

    // Add enhanced sky layer with dynamic atmosphere
    if (!map.getLayer('sky')) {
        map.addLayer({
            id: 'sky',
            type: 'sky',
            paint: {
                'sky-type': 'atmosphere',
                'sky-atmosphere-sun': [0.0, 90.0],  // Sun position for better lighting
                'sky-atmosphere-sun-intensity': 20,  // Increased intensity
                'sky-atmosphere-halo-color': 'rgba(135, 206, 235, 0.8)',  // Sky blue halo
                'sky-atmosphere-color': 'rgba(135, 206, 250, 0.5)',  // Light sky blue
                'sky-gradient-center': [0, 0],
                'sky-gradient-radius': 90,
                'sky-opacity': [
                    'interpolate',
                    ['exponential', 0.1],
                    ['zoom'],
                    5, 0.3,
                    10, 0.7,
                    15, 1
                ]
            }
        });
    }

    // Add hillshade layer for enhanced terrain visualization
    if (!map.getLayer('hillshade')) {
        map.addLayer({
            id: 'hillshade',
            type: 'hillshade',
            source: 'mapbox-dem',
            layout: {},
            paint: {
                'hillshade-exaggeration': 0.5,  // Subtle for campus terrain
                'hillshade-shadow-color': '#473B24',
                'hillshade-highlight-color': '#FFFFFF',
                'hillshade-accent-color': '#F0E68C',
                'hillshade-illumination-direction': 315,  // Northwest lighting
                'hillshade-illumination-anchor': 'viewport'
            }
        }, 'waterway-label');  // Place below labels
    }

    // Add contour lines for topographic effect (if available)
    if (!map.getLayer('contours')) {
        map.addLayer({
            id: 'contours',
            type: 'line',
            source: {
                type: 'vector',
                url: 'mapbox://mapbox.mapbox-terrain-v2'
            },
            'source-layer': 'contour',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#877b59',
                'line-width': [
                    'interpolate',
                    ['exponential', 1.5],
                    ['zoom'],
                    14, 0.5,
                    18, 1.5
                ],
                'line-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14, 0.3,
                    16, 0.6,
                    18, 0.8
                ]
            },
            minzoom: 16  // Campus-level detail visibility
        });
    }

    // Animate pitch for better 3D view with smooth transition
    map.easeTo({
        pitch: 60,
        bearing: map.getBearing() || 0,
        duration: 1500,
        easing: (t) => t * (2 - t)  // Ease-out quad for smooth animation
    });

    // Add subtle fog for depth perception without obscuring campus details
    map.setFog({
        'range': [1, 5],
        'color': 'rgba(200, 220, 240, 0.15)',  // Much more subtle for campus visibility
        'horizon-blend': 0.05
        // Removed high-color, space-color, star-intensity for campus-level simplicity
    });
}

// Disable 3D terrain and cleanup all related layers
function disable3DTerrain() {
    // Remove terrain
    map.setTerrain(null);

    // Remove fog
    map.setFog(null);

    // Remove sky layer
    if (map.getLayer('sky')) {
        map.removeLayer('sky');
    }

    // Remove hillshade layer
    if (map.getLayer('hillshade')) {
        map.removeLayer('hillshade');
    }

    // Remove contour layer
    if (map.getLayer('contours')) {
        map.removeLayer('contours');
    }

    // Remove contour lines
    if (map.getLayer('contours')) {
        map.removeLayer('contours');
    }

    // Reset pitch and bearing with smooth animation
    map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 1500,
        easing: (t) => t * (2 - t)  // Ease-out quad
    });
}

// Helper functions to add layers
function addRoadsLayers() {
    if (map.getLayer(LAYER_IDS.roads)) return;

    map.addLayer({
        id: LAYER_IDS.roads,
        type: 'line',
        source: 'roads-source',
        paint: {
            'line-color': '#000000',
            'line-width': 2,
            'line-emissive-strength': 0.5  // GL JS v3: Makes lines glow appropriately in 3D lighting
        }
    });

    map.addLayer({
        id: LAYER_IDS.roads + '-labels',
        type: 'symbol',
        source: 'roads-source',
        layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 11,
            'text-optional': true,
            'symbol-placement': 'line',
            'symbol-spacing': 300,
            'text-padding': 2,
            'text-allow-overlap': false,
            'text-ignore-placement': false
        },
        paint: {
            'text-color': '#333333',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
            'text-halo-blur': 1,
            'text-emissive-strength': 0.5  // GL JS v3: Proper text visibility in 3D lighting
        },
        minzoom: 15
    });
}

function addBuildingsLayers() {
    if (map.getLayer(LAYER_IDS.buildings)) return;

    map.addLayer({
        id: LAYER_IDS.buildings,
        type: 'fill',
        source: 'buildings-source',
        paint: {
            'fill-color': 'coral',
            'fill-opacity': 0.8,
            'fill-emissive-strength': 0.6  // GL JS v3: Makes buildings visible in all lighting conditions
        }
    });

    map.addLayer({
        id: LAYER_IDS.buildings + '-outline',
        type: 'line',
        source: 'buildings-source',
        paint: {
            'line-color': 'coral',
            'line-width': 2,
            'line-emissive-strength': 0.6  // GL JS v3: Outline visibility in 3D lighting
        }
    });
}

function addRouteLayer() {
    if (map.getLayer(LAYER_IDS.route)) return;

    // Add main route line with gradient effect
    map.addLayer({
        id: LAYER_IDS.route,
        type: 'line',
        source: 'route-source',
        paint: {
            'line-color': [
                'interpolate',
                ['linear'],
                ['line-progress'],
                0, '#00ff00',    // Start: green
                0.5, '#ffff00',  // Middle: yellow
                1, '#ff0000'     // End: red
            ],
            'line-width': 6,
            'line-opacity': 0.8,
            'line-emissive-strength': 0.8  // GL JS v3: Route stands out in all lighting conditions
        },
        layout: {
            'line-cap': 'round',
            'line-join': 'round'
        }
    });

    // Add animated dashed line on top for visual effect
    map.addLayer({
        id: LAYER_IDS.route + '-dashed',
        type: 'line',
        source: 'route-source',
        paint: {
            'line-color': '#ffffff',
            'line-width': 2,
            'line-dasharray': [0, 4, 3],
            'line-opacity': 0.9,
            'line-emissive-strength': 1.0  // GL JS v3: Animated dashes highly visible
        },
        layout: {
            'line-cap': 'round',
            'line-join': 'round'
        }
    });

    // Animate the dashed line
    animateRouteLine();
}

// Animate route dashed line
let dashArraySequence = [
    [0, 4, 3],
    [0.5, 4, 2.5],
    [1, 4, 2],
    [1.5, 4, 1.5],
    [2, 4, 1],
    [2.5, 4, 0.5],
    [3, 4, 0],
    [0, 0.5, 3, 3.5],
    [0, 1, 3, 3],
    [0, 1.5, 3, 2.5],
    [0, 2, 3, 2],
    [0, 2.5, 3, 1.5],
    [0, 3, 3, 1],
    [0, 3.5, 3, 0.5]
];
let step = 0;

function animateRouteLine() {
    if (!map.getLayer(LAYER_IDS.route + '-dashed')) return;

    step = (step + 1) % dashArraySequence.length;
    map.setPaintProperty(
        LAYER_IDS.route + '-dashed',
        'line-dasharray',
        dashArraySequence[step]
    );

    requestAnimationFrame(animateRouteLine);
}

// Wait for map to load before adding layers
map.on('load', () => {
    loadGeoJSONLayers();

    // Enable 3D terrain by default
    if (terrain3DEnabled) {
        enable3DTerrain();
        // Update button styling to show it's active
        setTimeout(() => {
            const btn = document.getElementById('terrain3DBtn');
            if (btn) {
                btn.style.backgroundColor = '#007bff';
                btn.style.color = 'white';
            }
        }, 100);
    }

    // Set up layer toggle listeners after map loads
    setTimeout(() => {
        setupLayerToggles();
    }, 500);
});

// --- Initialize variables ---
let startMarker, endMarker, stepMarkers = [];
let localFeatures = [];
let startPoint = null;
let endPoint = null;
let clickCount = 0;
let speechEnabled = true;
let speechQueue = [];
let isSpeaking = false;
let debounceTimer = null;
let currentHighlightLayer = null;

// Mapbox layer IDs
const LAYER_IDS = {
    roads: 'roads-layer',
    buildings: 'buildings-layer',
    route: 'route-layer',
    highlight: 'highlight-layer',
    userLocation: 'user-location-layer'
};

// --- Turn-by-Turn Navigation Variables ---
let gpsWatchId = null;
let userMarker = null;
let isNavigationMode = false;
let autoRecenter = true;
let currentInstructionIndex = 0;
let routeData = null;
let distanceTraveled = 0;
let isOffRoute = false;
let advanceWarningGiven = false;
let lastSpokenInstruction = null;

// --- UI Elements ---
const routeStatusEl = document.getElementById('routeStatus');
const cancelBtn = document.getElementById('cancelBtn');
const reverseBtn = document.getElementById('reverseBtn');
const statusMessageEl = document.getElementById('statusMessage');
const loadingSpinner = document.getElementById('loadingSpinner');
const speechToggle = document.getElementById('speechToggle');
const routeSummaryEl = document.getElementById('routeSummary');
const routeDistanceEl = document.getElementById('routeDistance');
const navBar = document.getElementById('navBar');
const currentInstructionEl = document.getElementById('currentInstruction');
const distanceToTurnEl = document.getElementById('distanceToTurn');
const routeProgressEl = document.getElementById('routeProgress');
const recenterBtn = document.getElementById('recenterBtn');
const exitNavBtn = document.getElementById('exitNavBtn');
const compassEl = document.getElementById('compass');
const compassArrowEl = document.getElementById('compassArrow');
const readAllBtn = document.getElementById('readAllBtn');

// --- Utility Functions ---
function showStatus(message, type = 'info', duration = 3000) {
    statusMessageEl.textContent = message;
    statusMessageEl.className = `alert alert-${type} position-absolute top-0 start-50 translate-middle-x mt-2`;
    statusMessageEl.style.display = 'block';
    statusMessageEl.classList.add('fade-in');
    
    setTimeout(() => {
        statusMessageEl.style.display = 'none';
    }, duration);
}

function showLoading(show = true) {
    loadingSpinner.style.display = show ? 'block' : 'none';
}

function updateRouteStatus() {
    if (clickCount === 0) {
        routeStatusEl.style.display = 'none';
        cancelBtn.style.display = 'none';
        reverseBtn.style.display = 'none';
    } else if (clickCount === 1) {
        routeStatusEl.textContent = '✓ Start point set. Click on map for end point.';
        routeStatusEl.className = 'route-status waiting-end';
        routeStatusEl.style.display = 'block';
        cancelBtn.style.display = 'block';
        reverseBtn.style.display = 'none';
    }
}

function showReverseButton(show = true) {
    if (reverseBtn) {
        reverseBtn.style.display = show ? 'block' : 'none';
    }
}

// Calculate distance between two points using Turf.js
function calculateDistance(point1, point2) {
    const from = turf.point([point1.lng || point1[0], point1.lat || point1[1]]);
    const to = turf.point([point2.lng || point2[0], point2.lat || point2[1]]);
    return turf.distance(from, to, { units: 'meters' }); // Returns distance in meters
}

// Get bounds from GeoJSON
function getBoundsFromGeoJSON(geojson) {
    if (!geojson || !geojson.features || geojson.features.length === 0) {
        // Return campus bounds as default
        return CAMPUS_BOUNDS;
    }
    try {
        const bbox = turf.bbox(geojson);
        // Validate bbox values
        if (bbox.some(v => !isFinite(v) || isNaN(v))) {
            return CAMPUS_BOUNDS;
        }
        return [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];
    } catch (e) {
        console.warn('Error calculating bounds:', e);
        return CAMPUS_BOUNDS;
    }
}

// Get center from GeoJSON
function getCenterFromGeoJSON(geojson) {
    if (!geojson) {
        return CAMPUS_CENTER; // Campus center as default
    }
    try {
        const center = turf.center(geojson);
        const coords = center.geometry.coordinates; // [lng, lat]
        // Validate coordinates
        if (!isFinite(coords[0]) || !isFinite(coords[1]) || isNaN(coords[0]) || isNaN(coords[1])) {
            return CAMPUS_CENTER; // Campus center as default
        }
        return coords;
    } catch (e) {
        console.warn('Error calculating center:', e);
        return CAMPUS_CENTER; // Campus center as default
    }
}

// --- Speech Synthesis with Queue ---
function speakSequentially(text) {
    if (!speechEnabled) return;
    
    speechQueue.push(text);
    processSpeechQueue();
}

function processSpeechQueue() {
    if (isSpeaking || speechQueue.length === 0) return;
    
    isSpeaking = true;
    const text = speechQueue.shift();
    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.onend = () => {
        isSpeaking = false;
        processSpeechQueue();
    };
    
    utterance.onerror = () => {
        isSpeaking = false;
        processSpeechQueue();
    };
    
    window.speechSynthesis.speak(utterance);
}

// Speech toggle
if (speechToggle) {
    speechToggle.addEventListener('click', () => {
        speechEnabled = !speechEnabled;
        if (!speechEnabled) {
            window.speechSynthesis.cancel();
            speechQueue = [];
            isSpeaking = false;
            speechToggle.textContent = '🔇';
            speechToggle.classList.add('text-muted');
        } else {
            speechToggle.textContent = '🔊';
            speechToggle.classList.remove('text-muted');
        }
    });
}

// Read All Directions button
if (readAllBtn) {
    readAllBtn.addEventListener('click', () => {
        if (!routeData || !routeData.directions || routeData.directions.length === 0) {
            showStatus('No directions to read', 'warning', 2000);
            return;
        }

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        speechQueue = [];
        isSpeaking = false;

        // Queue all directions
        routeData.directions.forEach((stepObj, i) => {
            const text = typeof stepObj === 'string' ? stepObj : stepObj.text;
            const announcement = `Step ${i + 1}. ${text}`;
            speakSequentially(announcement);
        });

        showStatus('Reading all directions...', 'info', 2000);
    });
}

// Cancel button
if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
        if (startMarker) startMarker.remove();
        startMarker = null;
        startPoint = null;
        clickCount = 0;
        updateRouteStatus();
        showStatus('Route selection cancelled', 'warning');
    });
}

// Reverse route button
if (reverseBtn) {
    reverseBtn.addEventListener('click', () => {
        if (startPoint && endPoint) {
            // Swap start and end points
            const temp = startPoint;
            startPoint = endPoint;
            endPoint = temp;

            // Swap markers
            if (startMarker && endMarker) {
                const tempLngLat = startMarker.getLngLat();
                startMarker.setLngLat(endMarker.getLngLat());
                endMarker.setLngLat(tempLngLat);
            }

            // Recalculate route
            calculateRoute();
            showStatus('Route reversed', 'info', 2000);
        }
    });
}

// --- Load Roads & Buildings ---
function loadGeoJSONLayers() {
    console.log('Loading GeoJSON layers...');
    Promise.all([
        fetch('/static/roads.geojson').then(r => {
            if (!r.ok) throw new Error(`Failed to load roads: ${r.statusText}`);
            return r.json();
        }),
        fetch('/static/buildings.geojson').then(r => {
            if (!r.ok) throw new Error(`Failed to load buildings: ${r.statusText}`);
            return r.json();
        })
    ])
        .then(([roads, buildings]) => {
            console.log(`Loaded ${roads.features?.length || 0} roads and ${buildings.features?.length || 0} buildings`);
            
            // Validate data
            if (!roads || !roads.features || roads.features.length === 0) {
                console.warn('No road features found in GeoJSON');
            }
            if (!buildings || !buildings.features || buildings.features.length === 0) {
                console.warn('No building features found in GeoJSON');
            }

            // Add roads source and layers
            map.addSource('roads-source', {
                type: 'geojson',
                data: roads
            });
            addRoadsLayers();

            // Add hover tooltips for roads
            let hoveredRoadId = null;
            map.on('mouseenter', LAYER_IDS.roads, (e) => {
                map.getCanvas().style.cursor = 'pointer';
                const feature = e.features[0];
                if (feature.properties?.name) {
                    hoveredRoadId = feature.id;
                    // Show popup on hover
                    const coordinates = e.lngLat;
                    new mapboxgl.Popup()
                        .setLngLat(coordinates)
                        .setHTML(`<strong>${feature.properties.name}</strong>`)
                        .addTo(map);
                }
            });

            map.on('mouseleave', LAYER_IDS.roads, () => {
                map.getCanvas().style.cursor = '';
                hoveredRoadId = null;
                // Close popups
                document.querySelectorAll('.mapboxgl-popup').forEach(popup => popup.remove());
            });

            // Add buildings source and layers
            map.addSource('buildings-source', {
                type: 'geojson',
                data: buildings
            });
            addBuildingsLayers();

            // Fit bounds to show all features
            const allFeatures = {
                type: 'FeatureCollection',
                features: [...roads.features, ...buildings.features]
            };
            
            // Only fit bounds if we have valid features
            if (allFeatures.features.length > 0) {
                try {
                    const bounds = getBoundsFromGeoJSON(allFeatures);
                    // Validate bounds before using
                    if (bounds && bounds[0] && bounds[1] && 
                        bounds[0][0] !== bounds[1][0] && bounds[0][1] !== bounds[1][1]) {
                        // Fit bounds with padding to show campus area
                        map.fitBounds(bounds, { 
                            padding: { top: 50, bottom: 50, left: 50, right: 50 },
                            duration: 1000 // Smooth animation
                        });
                    } else {
                        // Fallback: use campus bounds
                        map.fitBounds(CAMPUS_BOUNDS, { 
                            padding: { top: 50, bottom: 50, left: 50, right: 50 },
                            duration: 1000
                        });
                    }
                } catch (e) {
                    console.warn('Error fitting bounds:', e);
                    // Fallback to campus bounds
                    map.fitBounds(CAMPUS_BOUNDS, { 
                        padding: { top: 50, bottom: 50, left: 50, right: 50 },
                        duration: 1000
                    });
                }
            } else {
                // No features loaded, use campus bounds
                map.fitBounds(CAMPUS_BOUNDS, { 
                    padding: { top: 50, bottom: 50, left: 50, right: 50 },
                    duration: 1000
                });
            }

            // Prepare offline search data
            roads.features.forEach(f => {
                if (f.properties.name)
                    localFeatures.push({name: f.properties.name, type: 'road', geometry: f.geometry});
            });
            buildings.features.forEach(f => {
                if (f.properties.name)
                    localFeatures.push({
                        name: f.properties.name,
                        type: 'building',
                        geometry: f.geometry,
                        departments: f.properties.departments || []
                    });
            });

            showStatus('Map loaded successfully', 'success', 2000);
        })
        .catch(err => {
            console.error('Error loading GeoJSON:', err);
            showStatus('Error loading map data: ' + err.message, 'danger', 5000);
        });
}

// --- Smooth Collapse Helpers ---
function collapseDirections(hide = false) {
    const collapseEl = document.getElementById('directionsBody');
    const bsCollapse = bootstrap.Collapse.getInstance(collapseEl) || new bootstrap.Collapse(collapseEl, {toggle: false});
    if (hide) bsCollapse.hide(); else bsCollapse.show();
}

// --- Update Directions Panel ---
function updateDirectionsPanel(directions, totalDistance = null) {
    const container = document.querySelector('#directionsPanel .directions');
    container.innerHTML = '';

    if (!directions || directions.length === 0) {
        container.innerHTML = `<p class="text-muted mb-0">No route loaded yet.</p>`;
        collapseDirections(true);
        routeSummaryEl.style.display = 'none';
        if (readAllBtn) readAllBtn.style.display = 'none';
        return;
    }

    // Show Read All button when directions are available
    if (readAllBtn) readAllBtn.style.display = 'inline-block';

    const ul = document.createElement('ul');
    ul.className = 'list-group list-group-flush';
    ul.setAttribute('role', 'list');
    ul.setAttribute('aria-label', 'Turn-by-turn directions');

    directions.forEach((stepObj, i) => {
        const li = document.createElement('li');
        li.className = `list-group-item p-2 ${i === currentInstructionIndex ? 'active' : ''}`;
        li.id = `instruction-${i}`;
        li.setAttribute('tabindex', '0');
        li.setAttribute('role', 'button');
        li.setAttribute('aria-label', `Step ${i + 1}: ${stepObj.text || stepObj}`);
        li.innerHTML = `<strong>${i + 1}.</strong> ${stepObj.text || stepObj}`;

        // Add click handler to jump to instruction and speak it
        li.addEventListener('click', () => {
            if (routeData && routeData.directions[i] && routeData.directions[i].location) {
                const [lon, lat] = routeData.directions[i].location;
                map.flyTo({ center: [lon, lat], zoom: 18 });
                updateActiveInstruction(i);

                // Speak the clicked instruction
                const instructionText = stepObj.text || stepObj;
                speakInstruction(instructionText, true);
            }
        });

        // Keyboard support
        li.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                li.click();
            }
        });

        ul.appendChild(li);
    });
    container.appendChild(ul);

    // Show route summary with estimated time
    if (totalDistance !== null) {
        const distanceKm = (totalDistance / 1000).toFixed(2);
        const estimatedTime = Math.ceil(totalDistance / 1.4 / 60); // Assuming 1.4 m/s walking speed
        routeDistanceEl.innerHTML = `${totalDistance.toLocaleString()} m (${distanceKm} km) • ~${estimatedTime} min walk`;
        routeSummaryEl.style.display = 'block';
    }

    // Smoothly open the panel
    collapseDirections(false);
    
    // Scroll active instruction into view
    updateActiveInstruction(currentInstructionIndex);
}

// --- Update Active Instruction Highlight ---
function updateActiveInstruction(index) {
    if (!routeData || !routeData.directions) return;
    
    // Remove previous highlight
    const prevEl = document.getElementById(`instruction-${currentInstructionIndex}`);
    if (prevEl) {
        prevEl.classList.remove('active');
    }
    
    // Add new highlight
    currentInstructionIndex = index;
    const newEl = document.getElementById(`instruction-${index}`);
    if (newEl) {
        newEl.classList.add('active');
        newEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Update navigation bar
    updateNavigationBar();
}

// --- Clear Route Function ---
function clearRoute() {
    // Remove route layers (main and dashed)
    if (map.getLayer(LAYER_IDS.route + '-dashed')) {
        map.removeLayer(LAYER_IDS.route + '-dashed');
    }
    if (map.getLayer(LAYER_IDS.route)) {
        map.removeLayer(LAYER_IDS.route);
    }
    if (map.getSource('route-source')) {
        map.removeSource('route-source');
    }

    // Remove markers
    if (startMarker) startMarker.remove();
    if (endMarker) endMarker.remove();
    if (userMarker) userMarker.remove();
    stepMarkers.forEach(m => m.remove());

    // Stop GPS tracking
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }

    startMarker = null;
    endMarker = null;
    userMarker = null;
    stepMarkers = [];
    startPoint = null;
    endPoint = null;
    clickCount = 0;
    routeData = null;
    currentInstructionIndex = 0;
    distanceTraveled = 0;
    isOffRoute = false;
    advanceWarningGiven = false;
    lastSpokenInstruction = null;

    // Exit navigation mode
    exitNavigationMode();

    const container = document.querySelector('#directionsPanel .directions');
    if (container)
        container.innerHTML = `<p class="text-muted mb-0">Click on the map to set start point, then click again for end point.</p>`;

    // Smoothly collapse the panel
    collapseDirections(true);
    routeSummaryEl.style.display = 'none';
    if (readAllBtn) readAllBtn.style.display = 'none';
    updateRouteStatus();

    window.speechSynthesis.cancel();
    speechQueue = [];
    isSpeaking = false;
    
    showStatus('Route cleared', 'info', 2000);
}

// Attach to Clear button
document.getElementById('clearBtn').addEventListener('click', clearRoute);

// Set up layer toggle listeners
function setupLayerToggles() {
    const roadsToggle = document.getElementById('roadsLayerToggle');
    const buildingsToggle = document.getElementById('buildingsLayerToggle');
    const roadLabelsToggle = document.getElementById('roadLabelsToggle');
    const routeToggle = document.getElementById('routeLayerToggle');

    if (roadsToggle) {
        roadsToggle.addEventListener('change', (e) => {
            const visibility = e.target.checked ? 'visible' : 'none';
            if (map.getLayer(LAYER_IDS.roads)) {
                map.setLayoutProperty(LAYER_IDS.roads, 'visibility', visibility);
            }
        });
    }

    if (buildingsToggle) {
        buildingsToggle.addEventListener('change', (e) => {
            const visibility = e.target.checked ? 'visible' : 'none';
            if (map.getLayer(LAYER_IDS.buildings)) {
                map.setLayoutProperty(LAYER_IDS.buildings, 'visibility', visibility);
            }
            if (map.getLayer(LAYER_IDS.buildings + '-outline')) {
                map.setLayoutProperty(LAYER_IDS.buildings + '-outline', 'visibility', visibility);
            }
        });
    }

    if (roadLabelsToggle) {
        roadLabelsToggle.addEventListener('change', (e) => {
            const visibility = e.target.checked ? 'visible' : 'none';
            if (map.getLayer(LAYER_IDS.roads + '-labels')) {
                map.setLayoutProperty(LAYER_IDS.roads + '-labels', 'visibility', visibility);
            }
        });
    }

    if (routeToggle) {
        routeToggle.addEventListener('change', (e) => {
            const visibility = e.target.checked ? 'visible' : 'none';
            if (map.getLayer(LAYER_IDS.route)) {
                map.setLayoutProperty(LAYER_IDS.route, 'visibility', visibility);
            }
            if (map.getLayer(LAYER_IDS.route + '-dashed')) {
                map.setLayoutProperty(LAYER_IDS.route + '-dashed', 'visibility', visibility);
            }
        });
    }
}

// --- Search Logic with Debouncing ---
const searchBox = document.getElementById('searchBox');
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('searchResults');

function performSearch() {
    const query = searchBox.value.trim().toLowerCase();
    resultsDiv.innerHTML = '';
    resultsDiv.setAttribute('role', 'listbox');
    resultsDiv.setAttribute('aria-label', 'Search results');

    if (!query) {
        resultsDiv.style.display = 'none';
        return;
    }

    const matches = localFeatures.filter(f => f.name.toLowerCase().includes(query)).slice(0, 10);
    if (matches.length === 0) {
        resultsDiv.innerHTML = '<div class="p-2 text-muted" role="alert">No results found</div>';
        resultsDiv.style.display = 'block';
        return;
    }

    matches.forEach(match => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${match.name} (${match.type})`;
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'search-result-actions';
        
        const setStartBtn = document.createElement('button');
        setStartBtn.className = 'btn btn-sm btn-success';
        setStartBtn.textContent = 'Start';
        setStartBtn.onclick = (e) => {
            e.stopPropagation();
            setLocationFromSearch(match, 'start');
        };
        
        const setEndBtn = document.createElement('button');
        setEndBtn.className = 'btn btn-sm btn-danger';
        setEndBtn.textContent = 'End';
        setEndBtn.onclick = (e) => {
            e.stopPropagation();
            setLocationFromSearch(match, 'end');
        };
        
        actionsDiv.appendChild(setStartBtn);
        actionsDiv.appendChild(setEndBtn);
        
        item.appendChild(nameSpan);
        item.appendChild(actionsDiv);
        
        item.onclick = () => {
            highlightFeature(match);
            resultsDiv.style.display = 'none';
            searchBox.value = match.name; // Update search box with selected name
        };
        
        resultsDiv.appendChild(item);
    });
    resultsDiv.style.display = 'block';
}

function setLocationFromSearch(match, type) {
    const geom = match.geometry;
    let lat, lon;
    
    if (geom.type === 'Point') {
        [lon, lat] = geom.coordinates;
    } else {
        // Get centroid for polygons/lines
        const center = getCenterFromGeoJSON({ type: 'Feature', geometry: geom });
        [lon, lat] = center;
    }
    
    // Validate coordinates
    if (!isFinite(lon) || !isFinite(lat) || isNaN(lon) || isNaN(lat)) {
        showStatus('Invalid location coordinates', 'error');
        return;
    }
    
    if (type === 'start') {
        if (startMarker) startMarker.remove();
        startPoint = {lat, lng: lon};
        const el = document.createElement('div');
        el.className = 'marker-start';
        el.innerHTML = '<div style="background-color: #28a745; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;">S</div>';
        startMarker = new mapboxgl.Marker({ element: el })
            .setLngLat([lon, lat])
            .setPopup(new mapboxgl.Popup().setText('Start'))
            .addTo(map);
        startMarker.togglePopup();
        clickCount = 1;
        showStatus('Start point set from search', 'success');
    } else {
        if (endMarker) endMarker.remove();
        endPoint = {lat, lng: lon};
        const el = document.createElement('div');
        el.className = 'marker-end';
        el.innerHTML = '<div style="background-color: #dc3545; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;">E</div>';
        endMarker = new mapboxgl.Marker({ element: el })
            .setLngLat([lon, lat])
            .setPopup(new mapboxgl.Popup().setText('End'))
            .addTo(map);
        endMarker.togglePopup();
        
        if (startPoint) {
            // Automatically calculate route
            calculateRoute();
        } else {
            clickCount = 1;
            showStatus('End point set. Set start point to calculate route.', 'info');
        }
    }
    
    map.flyTo({ center: [lon, lat], zoom: 17 });
    updateRouteStatus();
    highlightFeature(match);
}

function highlightFeature(match) {
    // Remove any previous temporary highlights
    if (currentHighlightLayer && currentHighlightLayer.remove) {
        currentHighlightLayer.remove();
        currentHighlightLayer = null;
    }
    if (map.getLayer(LAYER_IDS.highlight)) {
        map.removeLayer(LAYER_IDS.highlight);
    }
    if (map.getLayer(LAYER_IDS.highlight + '-outline')) {
        map.removeLayer(LAYER_IDS.highlight + '-outline');
    }
    if (map.getSource('highlight-source')) {
        map.removeSource('highlight-source');
    }
    
    const geom = match.geometry;
    
    if (geom.type === 'Point') {
        const [lon, lat] = geom.coordinates;
        // Validate coordinates
        if (!isFinite(lon) || !isFinite(lat) || isNaN(lon) || isNaN(lat)) {
            showStatus('Invalid point coordinates', 'error');
            return;
        }
        map.flyTo({ center: [lon, lat], zoom: 17, duration: 1000 });

        // Create animated pulsing marker
        const el = document.createElement('div');
        el.innerHTML = '📍';
        el.style.cssText = 'font-size: 32px; animation: pulse 1.5s infinite; filter: drop-shadow(0 0 8px rgba(255, 0, 0, 0.8));';

        const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([lon, lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>${match.name}</strong><br><em>${match.type}</em>`))
            .addTo(map);
        marker.togglePopup();
        currentHighlightLayer = marker;

        showStatus(`Selected: ${match.name}`, 'info', 3000);
    } else {
        // Add highlight source
        map.addSource('highlight-source', {
            type: 'geojson',
            data: { type: 'Feature', geometry: geom }
        });
        
        // Determine layer type based on geometry
        const isPolygon = geom.type === 'Polygon' || geom.type === 'MultiPolygon';
        const isLine = geom.type === 'LineString' || geom.type === 'MultiLineString';

        if (isPolygon) {
        // Add fill layer with pulsing animation
            map.addLayer({
                id: LAYER_IDS.highlight,
                type: 'fill',
                source: 'highlight-source',
                paint: {
                    'fill-color': '#ffff00',
                    'fill-opacity': 0.5,
                    'fill-emissive-strength': 1.0
                }
            });

            // Add outline for better visibility
            map.addLayer({
                id: LAYER_IDS.highlight + '-outline',
                type: 'line',
                source: 'highlight-source',
                paint: {
                    'line-color': '#ff0000',
                    'line-width': 4,
                    'line-emissive-strength': 1.0
                }
            });
        } else if (isLine) {
            // Highlight line with thick, bright styling
            map.addLayer({
                id: LAYER_IDS.highlight,
                type: 'line',
                source: 'highlight-source',
                paint: {
                    'line-color': '#ff0000',
                    'line-width': 6,
                    'line-emissive-strength': 1.0
                }
            });
        }
        
        // Fit bounds to feature
        const bounds = getBoundsFromGeoJSON({ type: 'Feature', geometry: geom });
        map.fitBounds(bounds, { padding: 80, duration: 1000 });

        // Show popup at center
        const center = getCenterFromGeoJSON({ type: 'Feature', geometry: geom });
        new mapboxgl.Popup({ closeButton: true, closeOnClick: true })
            .setLngLat(center)
            .setHTML(`<strong>${match.name}</strong><br><em>${match.type}</em>`)
            .addTo(map);

        showStatus(`Highlighted: ${match.name}`, 'success', 3000);

        // Animate the highlight with opacity pulsing
        let opacity = 0.5;
        let increasing = false;
        const pulseInterval = setInterval(() => {
            if (increasing) {
                opacity += 0.05;
                if (opacity >= 0.7) increasing = false;
            } else {
                opacity -= 0.05;
                if (opacity <= 0.3) increasing = true;
            }

            if (map.getLayer(LAYER_IDS.highlight)) {
                if (isPolygon) {
                    map.setPaintProperty(LAYER_IDS.highlight, 'fill-opacity', opacity);
                }
            } else {
                clearInterval(pulseInterval);
            }
        }, 100);
        
        // Remove highlight after 10 seconds
        setTimeout(() => {
            clearInterval(pulseInterval);
            if (map.getLayer(LAYER_IDS.highlight)) {
                map.removeLayer(LAYER_IDS.highlight);
            }
            if (map.getLayer(LAYER_IDS.highlight + '-outline')) {
                map.removeLayer(LAYER_IDS.highlight + '-outline');
            }
            if (map.getSource('highlight-source')) {
                map.removeSource('highlight-source');
            }
            currentHighlightLayer = null;
        }, 10000);
    }

    // Display department list if building has departments
    const departmentList = document.getElementById('departmentList');
    const departmentsUl = document.getElementById('departments');
    
    // Always clear first
    departmentsUl.innerHTML = '';
    
    if (match.type === 'building' && match.departments?.length) {
        match.departments.forEach(dep => {
            const li = document.createElement('li');
            li.className = 'list-group-item list-group-item-action';
            li.textContent = dep;
            li.setAttribute('tabindex', '0');
            li.setAttribute('role', 'button');
            li.onclick = () => {
                showStatus(`Selected department: ${dep} in ${match.name}`, 'info');
                const bounds = getBoundsFromGeoJSON({ type: 'Feature', geometry: match.geometry });
                map.fitBounds(bounds, { padding: 50 });
            };
            departmentsUl.appendChild(li);
        });
        departmentList.style.display = 'block';
    } else {
        departmentList.style.display = 'none';
    }

    // Hide search results after selection
    resultsDiv.innerHTML = '';
    resultsDiv.style.display = 'none';
    searchBox.value = '';
}

// Debounced search
searchBox.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(performSearch, 300);
});

searchBtn.addEventListener('click', performSearch);

// Close search results when clicking outside
document.addEventListener('click', (e) => {
    if (!searchBox.contains(e.target) && !resultsDiv.contains(e.target) && !searchBtn.contains(e.target)) {
        resultsDiv.style.display = 'none';
    }
});

// Keyboard navigation
searchBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
    } else if (e.key === 'Escape') {
        resultsDiv.style.display = 'none';
        searchBox.blur();
    }
});

// --- Routing Logic ---
function calculateRoute() {
    if (!startPoint || !endPoint) {
        showStatus('Please set both start and end points', 'warning');
        return;
    }
    
    showLoading(true);
    const url = `/route?start=${startPoint.lng},${startPoint.lat}&end=${endPoint.lng},${endPoint.lat}`;
    
    fetch(url)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            showLoading(false);
            
            if (data.error) {
                showStatus('Error: ' + data.error, 'danger', 5000);
                return;
            }

            // Remove existing route layer
            if (map.getLayer(LAYER_IDS.route)) {
                map.removeLayer(LAYER_IDS.route);
            }
            if (map.getSource('route-source')) {
                map.removeSource('route-source');
            }

            // Remove step markers
            stepMarkers.forEach(m => m.remove());
            stepMarkers = [];

            // Add route source and layer
            map.addSource('route-source', {
                type: 'geojson',
                data: data.route,
                lineMetrics: true // Enable line-gradient
            });
            addRouteLayer();

            // Fit bounds to route
            try {
                const bounds = getBoundsFromGeoJSON(data.route);
                // Validate bounds before using
                if (bounds && bounds[0] && bounds[1] && 
                    bounds[0][0] !== bounds[1][0] && bounds[0][1] !== bounds[1][1]) {
                    map.fitBounds(bounds, { padding: 50 });
                }
            } catch (e) {
                console.warn('Error fitting route bounds:', e);
            }

            // Plot markers for each turn
            for (let i = 0; i < data.directions.length - 1; i++) {
                const stepObj = data.directions[i];
                if (!stepObj.location) continue;
                
                const [lon, lat] = stepObj.location;
                
                // Validate coordinates before creating marker
                if (!isFinite(lon) || !isFinite(lat) || isNaN(lon) || isNaN(lat)) {
                    console.warn(`Invalid coordinates for step ${i + 1}:`, stepObj.location);
                    continue;
                }

                const el = document.createElement('div');
                el.className = 'step-label bg-danger text-white rounded-circle';
                el.style.cssText = 'width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;';
                el.textContent = i + 1;

                const marker = new mapboxgl.Marker({ element: el })
                    .setLngLat([lon, lat])
                    .addTo(map);
                stepMarkers.push(marker);
            }

            // Store route data for navigation
            routeData = data;
            currentInstructionIndex = 0;
            distanceTraveled = 0;
            isOffRoute = false;
            advanceWarningGiven = false;
            lastSpokenInstruction = null;

            updateDirectionsPanel(data.directions, data.total_distance_m);

            // Enter navigation mode
            enterNavigationMode();

            // Speak only the first instruction
            if (speechEnabled && data.directions.length > 0) {
                const firstInstruction = typeof data.directions[0] === 'string' 
                    ? data.directions[0] 
                    : data.directions[0].text;
                speakInstruction(firstInstruction, true);
            }

            // Start GPS tracking
            startGPSTracking(data);

            clickCount = 0;
            updateRouteStatus();
            showReverseButton(true);
            showStatus('Route calculated successfully. Starting navigation...', 'success', 2000);
        })
        .catch(err => {
            showLoading(false);
            console.error('Routing error:', err);

            // More user-friendly error messages
            let errorMsg = 'Unable to calculate route';
            if (err.message.includes('Failed to fetch')) {
                errorMsg = 'Network error. Please check your connection.';
            } else if (err.message.includes('No connected road path')) {
                errorMsg = 'No route found. Try selecting points closer to roads.';
            }

            showStatus(errorMsg, 'danger', 5000);
        });
}

// Snap point to nearest road using Turf.js
function snapToNearestRoad(clickedPoint) {
    const roadsSource = map.getSource('roads-source');
    if (!roadsSource) {
        return clickedPoint; // Return original if no roads loaded
    }

    const roadsData = roadsSource._data;
    if (!roadsData || !roadsData.features || roadsData.features.length === 0) {
        return clickedPoint;
    }

    const point = turf.point([clickedPoint.lng, clickedPoint.lat]);
    let nearestPoint = null;
    let minDistance = Infinity;

    // Find the nearest point on any road
    roadsData.features.forEach(road => {
        if (road.geometry.type === 'LineString' || road.geometry.type === 'MultiLineString') {
            try {
                const snapped = turf.nearestPointOnLine(road, point);
                const distance = turf.distance(point, snapped, { units: 'meters' });

                if (distance < minDistance) {
                    minDistance = distance;
                    nearestPoint = snapped.geometry.coordinates;
                }
            } catch (e) {
                console.warn('Error snapping to road:', e);
            }
        }
    });

    // If we found a nearby road (within 100m), use it; otherwise use original point
    if (nearestPoint && minDistance < 100) {
        return { lng: nearestPoint[0], lat: nearestPoint[1] };
    }

    return clickedPoint;
}

// Map click handler
map.on('click', (e) => {
    if (clickCount === 0) {
        const clickedPoint = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        startPoint = snapToNearestRoad(clickedPoint);

        if (startMarker) startMarker.remove();
        const el = document.createElement('div');
        el.className = 'marker-start';
        el.innerHTML = '<div style="background-color: #28a745; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;">S</div>';
        startMarker = new mapboxgl.Marker({ element: el })
            .setLngLat([startPoint.lng, startPoint.lat])
            .setPopup(new mapboxgl.Popup().setText('Start'))
            .addTo(map);
        startMarker.togglePopup();
        clickCount = 1;
        updateRouteStatus();
        showStatus('Start point set. Click again for end point.', 'info');
        return;
    }

    if (clickCount === 1) {
        const clickedPoint = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        endPoint = snapToNearestRoad(clickedPoint);

        if (endMarker) endMarker.remove();
        const el = document.createElement('div');
        el.className = 'marker-end';
        el.innerHTML = '<div style="background-color: #dc3545; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;">E</div>';
        endMarker = new mapboxgl.Marker({ element: el })
            .setLngLat([endPoint.lng, endPoint.lat])
            .setPopup(new mapboxgl.Popup().setText('End'))
            .addTo(map);
        endMarker.togglePopup();
        
        calculateRoute();
    }
});

// Right-click to cancel route selection
map.on('contextmenu', (e) => {
    if (clickCount === 1) {
        e.preventDefault();
        if (startMarker) startMarker.remove();
        startMarker = null;
        startPoint = null;
        clickCount = 0;
        updateRouteStatus();
        showStatus('Route selection cancelled', 'warning');
    }
});

// --- Turn-by-Turn Navigation Functions ---

// Speak instruction with debouncing
function speakInstruction(text, force = false) {
    if (!speechEnabled || !window.speechSynthesis) return;

    if (text === lastSpokenInstruction && !force) {
        return;
    }

    window.speechSynthesis.cancel();
    lastSpokenInstruction = text;

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.onend = () => {
        setTimeout(() => {
            if (lastSpokenInstruction === text) {
                lastSpokenInstruction = null;
            }
        }, 5000);
    };
    window.speechSynthesis.speak(utter);
}

// Enter navigation mode
function enterNavigationMode() {
    isNavigationMode = true;
    autoRecenter = true;
    
    if (navBar) navBar.style.display = 'block';
    if (compassEl) compassEl.style.display = 'flex';
    updateNavigationBar();

    // Start compass updates if device supports orientation
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleOrientation);
    }
}

// Exit navigation mode
function exitNavigationMode() {
    isNavigationMode = false;
    autoRecenter = false;
    
    if (navBar) navBar.style.display = 'none';
    if (compassEl) compassEl.style.display = 'none';

    // Stop compass updates
    if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation);
    }
}

// Handle device orientation for compass
function handleOrientation(event) {
    if (!isNavigationMode || !compassArrowEl) return;

    const alpha = event.alpha; // Direction in degrees (0-360)
    if (alpha !== null) {
        compassArrowEl.style.transform = `rotate(${360 - alpha}deg)`;
    }
}

// Recenter map on user location
function recenterMap() {
    autoRecenter = true;
    if (userMarker) {
        const lngLat = userMarker.getLngLat();
        map.flyTo({ center: [lngLat.lng, lngLat.lat], zoom: 18 });
    }
}

// Navigation bar button handlers
if (recenterBtn) {
    recenterBtn.addEventListener('click', recenterMap);
}

if (exitNavBtn) {
    exitNavBtn.addEventListener('click', () => {
        clearRoute();
    });
}

// Update navigation bar with current instruction
function updateNavigationBar() {
    if (!isNavigationMode || !routeData) return;

    if (currentInstructionEl && routeData.directions) {
        const instruction = routeData.directions[currentInstructionIndex];
        const instructionText = typeof instruction === 'string' ? instruction : instruction.text;
        currentInstructionEl.textContent = instructionText || 'Navigation in progress...';
    }

    if (distanceToTurnEl && userMarker && routeData.route) {
        const userLngLat = userMarker.getLngLat();
        const userPoint = { lat: userLngLat.lat, lng: userLngLat.lng };
        const distToNext = distanceToNextInstruction(userPoint, currentInstructionIndex + 1);
        const span = distanceToTurnEl.querySelector('span');
        
        if (distToNext < Infinity && currentInstructionIndex + 1 < routeData.directions.length) {
            if (span) {
                span.textContent = `Next turn in ${Math.round(distToNext)}m`;
            } else {
                distanceToTurnEl.innerHTML = `<i class="fas fa-route"></i> <span>Next turn in ${Math.round(distToNext)}m</span>`;
            }
        } else if (routeData.route.geometry && routeData.route.geometry.coordinates) {
            const coords = routeData.route.geometry.coordinates;
            if (coords.length > 0) {
                const [destLon, destLat] = coords[coords.length - 1];
                const distToDestination = calculateDistance(userPoint, { lat: destLat, lng: destLon });
                if (span) {
                    span.textContent = `${Math.round(distToDestination)}m to destination`;
                } else {
                    distanceToTurnEl.innerHTML = `<i class="fas fa-route"></i> <span>${Math.round(distToDestination)}m to destination</span>`;
                }
            }
        }
    }

    // Update progress bar
    if (routeProgressEl && routeData.total_distance_m) {
        const progressPercent = Math.min(100, (distanceTraveled / routeData.total_distance_m * 100));
        routeProgressEl.style.width = `${progressPercent}%`;
    }
}

// Calculate distance to next instruction point
function distanceToNextInstruction(userPoint, instructionIndex) {
    if (!routeData || !routeData.route || !routeData.route.geometry) {
        return Infinity;
    }

    const coords = routeData.route.geometry.coordinates;
    if (!coords || instructionIndex >= coords.length) {
        return Infinity;
    }

    // Get the location for this instruction from directions
    if (routeData.directions && routeData.directions[instructionIndex - 1]) {
        const instruction = routeData.directions[instructionIndex - 1];
        if (instruction.location) {
            const [lon, lat] = instruction.location;
            return calculateDistance(userPoint, { lat, lng: lon });
        }
    }

    // Fallback: estimate based on route coordinates
    if (instructionIndex < coords.length) {
        const [targetLon, targetLat] = coords[instructionIndex];
        return calculateDistance(userPoint, { lat: targetLat, lng: targetLon });
    }

    return Infinity;
}

// Calculate distance traveled along route
function calculateDistanceTraveled(userPoint) {
    if (!routeData || !routeData.route || !routeData.route.geometry) return 0;

    const coords = routeData.route.geometry.coordinates;
    if (!coords || coords.length < 2) return 0;

    let minDist = Infinity;
    let closestIndex = 0;

    // Find closest point on route
    for (let i = 0; i < coords.length; i++) {
        const [lon, lat] = coords[i];
        const dist = calculateDistance(userPoint, { lat, lng: lon });
        if (dist < minDist) {
            minDist = dist;
            closestIndex = i;
        }
    }

    // Sum distances from start to closest point
    let traveled = 0;
    for (let i = 0; i < closestIndex; i++) {
        const [lon1, lat1] = coords[i];
        const [lon2, lat2] = coords[i + 1];
        traveled += calculateDistance({ lat: lat1, lng: lon1 }, { lat: lat2, lng: lon2 });
    }

    return traveled;
}

// Check if user is off route
function checkOffRoute(userPoint) {
    if (!routeData || !routeData.route || !routeData.route.geometry) return false;

    const coords = routeData.route.geometry.coordinates;
    if (!coords) return false;

    let minDistance = Infinity;

    // Find minimum distance to any point on the route
    for (let i = 0; i < coords.length; i++) {
        const [lon, lat] = coords[i];
        const dist = calculateDistance(userPoint, { lat, lng: lon });
        if (dist < minDistance) {
            minDistance = dist;
        }
    }

    // If more than 30m from route, consider off-route
    return minDistance > 30;
}

// GPS tracking with improved instruction management
function startGPSTracking(data) {
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }

    if (!navigator.geolocation) {
        showStatus('Geolocation is not supported by your browser', 'warning', 5000);
        return;
    }

    const geoOptions = {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 30000
    };

    gpsWatchId = navigator.geolocation.watchPosition(
        pos => {
            const userLatLng = [pos.coords.latitude, pos.coords.longitude];
            const userPoint = { lat: userLatLng[0], lng: userLatLng[1] };

            // Update user marker
            if (userMarker) userMarker.remove();
            const el = document.createElement('div');
            el.className = 'pulse-marker';
            el.style.cssText = 'width: 20px; height: 20px; border-radius: 50%; background-color: #2196F3; border: 3px solid #2196F3; box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.7);';
            userMarker = new mapboxgl.Marker({ element: el })
                .setLngLat([userLatLng[1], userLatLng[0]])
                .addTo(map);

            // Auto-recenter in navigation mode
            if (isNavigationMode && autoRecenter) {
                map.flyTo({ center: [userLatLng[1], userLatLng[0]], zoom: 18, duration: 500 });
            }

            // Update distance traveled and progress
            distanceTraveled = calculateDistanceTraveled(userPoint);
            updateNavigationBar();

            // Check if off route
            if (checkOffRoute(userPoint)) {
                if (!isOffRoute) {
                    isOffRoute = true;
                    speakInstruction("You are off route. Recalculating...", true);
                }
                return;
            } else {
                if (isOffRoute) {
                    speakInstruction("Back on route.", true);
                }
                isOffRoute = false;
            }

            // Check distance to next instruction
            const distToNext = distanceToNextInstruction(userPoint, currentInstructionIndex + 1);

            // Advance warning (50m before turn)
            if (distToNext < 50 && distToNext > 30 && currentInstructionIndex + 1 < data.directions.length) {
                if (!advanceWarningGiven) {
                    const nextInstruction = data.directions[currentInstructionIndex + 1];
                    const nextText = typeof nextInstruction === 'string' ? nextInstruction : nextInstruction.text;
                    speakInstruction(`In 50 meters, ${nextText}`, true);
                    advanceWarningGiven = true;
                }
            }

            // Move to next instruction when close enough (20m)
            if (distToNext < 20 && currentInstructionIndex + 1 < data.directions.length) {
                currentInstructionIndex++;
                advanceWarningGiven = false;
                updateActiveInstruction(currentInstructionIndex);
                const nextInstruction = data.directions[currentInstructionIndex];
                const nextText = typeof nextInstruction === 'string' ? nextInstruction : nextInstruction.text;
                speakInstruction(nextText, true);
            }

            // Check if arrived at destination
            const coords = data.route.geometry.coordinates;
            if (coords && coords.length > 0) {
                const [destLon, destLat] = coords[coords.length - 1];
                const distToDestination = calculateDistance(userPoint, { lat: destLat, lng: destLon });

                if (distToDestination < 10 && currentInstructionIndex === data.directions.length - 1) {
                    speakInstruction("You have arrived at your destination.", true);
                    setTimeout(() => {
                        exitNavigationMode();
                        showStatus('Arrived at destination!', 'success', 5000);
                    }, 3000);
                }
            }
        },
        err => {
            let errorMsg = 'GPS error: ';
            switch (err.code) {
                case err.PERMISSION_DENIED:
                    errorMsg += 'Location permission denied. Please enable location access.';
                    break;
                case err.POSITION_UNAVAILABLE:
                    errorMsg += 'Location unavailable. Please check your device settings.';
                    break;
                case err.TIMEOUT:
                    errorMsg += 'Location request timed out. Retrying...';
                    break;
                default:
                    errorMsg += err.message;
            }
            console.warn(errorMsg);
            showStatus(errorMsg, 'warning', 5000);
        },
        geoOptions
    );
}

// Allow user to disable auto-recenter by dragging map
map.on('dragstart', function () {
    if (isNavigationMode) {
        autoRecenter = false;
    }
});
