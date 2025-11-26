# NasrdaNavi - Architecture Refactoring Plan

**Created:** November 10, 2025  
**Status:** Planning Phase  
**Priority:** HIGH - Critical for maintainability and scalability

---

## 📊 Executive Summary

This document outlines the architectural refactoring plan for NasrdaNavi, transforming it from a monolithic structure into a maintainable and scalable application.

**Current State:** Monolithic (main.py: 178 lines, map.js: 2,646 lines)  
**Target State:** Modular architecture with Vite-powered frontend and structured backend  
**Expected Timeline:** 1-2 weeks  
**Risk Level:** Medium (requires careful migration)

---

## 🔴 Current Issues Analysis

### A. Backend Problems (main.py - 178 lines)

**Structure Issues:**

- ❌ All logic in ONE file (routing, graph building, utilities, config)
- ❌ No separation of concerns
- ❌ Graph built at startup (no caching, no validation)
- ❌ Hard-coded values (port 5001, file paths)
- ❌ Basic error handling only
- ❌ No API versioning

**Code Organization:**

```python
# Current structure (everything mixed):
- Imports (lines 1-10)
- Flask app initialization (lines 15-16)
- Configuration (lines 18-23)
- Data loading (lines 26-31)
- Graph building (lines 34-48)
- Utility functions (lines 50-66)
- Route endpoint (lines 126-174)
- Main entry (lines 176-178)
```

### B. Frontend Problems (map.js - 2,646 lines)

**Monolithic Structure:**

```javascript
// Current structure (everything in ONE file):
Lines 1-130:     Map initialization & Mapbox setup
Lines 131-417:   7 custom control classes (287 lines)
Lines 418-646:   Map style/terrain/layer functions
Lines 647-873:   Variable declarations & constants
Lines 874-968:   Utility functions
Lines 969-1037:  Speech synthesis system
Lines 1038-1211: Route status & UI management
Lines 1074-1204: GeoJSON loading
Lines 1205-1303: Directions panel management
Lines 1305-1367: Clear route functionality
Lines 1419-1737: Search logic (318 lines)
Lines 1739-2005: Routing logic (266 lines)
Lines 2020-2638: GPS tracking & navigation (618 lines!)
```

### C. Project Structure Problems

**Current Root Directory:**

```
NasrdaNavi/ (cluttered root)
├── main.py
├── static/
│   ├── map.js (2,646 lines!)
│   ├── roads.geojson
│   └── buildings.geojson
├── templates/
│   └── index.html (797 lines with inline CSS)
├── venv/
├── app.log
├── app.pid
├── 8+ documentation files (scattered)
└── .env
```

---

## 🎯 Proposed Architecture

### Backend Architecture (Layered)

```
┌─────────────────────────────────────────────────┐
│  API Layer                                      │
│  - Routes (GET /api/v1/route)                   │
│  - Health checks                                │
│  - Error handlers                               │
└─────────────┬───────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────┐
│  Service Layer                                  │
│  - RoutingService (route calculation)           │
│  - NavigationService (turn-by-turn logic)       │
└─────────────┬───────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────┐
│  Data Layer                                     │
│  - GeoJSONLoader (load and validate data)       │
│  - GraphBuilder (NetworkX graph construction)   │
└─────────────┬───────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────┐
│  Utilities                                      │
│  - Validators (input validation)                │
│  - GeoUtils (distance, bearing calculations)    │
└─────────────────────────────────────────────────┘
```

### Frontend Architecture (Modular)

```
┌─────────────────────────────────────────────────┐
│  Main App (main.js)                             │
│  - Initialize modules                           │
│  - Setup event bus                              │
│  - Handle global state                          │
└─────────────┬───────────────────────────────────┘
              │
    ┌─────────┼─────────┬──────────┐
    │         │         │          │
┌───▼────┐ ┌──▼──┐ ┌────▼─────┐ ┌─▼────┐
│  Map   │ │ Nav │ │    UI    │ │Utils │
│ Module │ │ Mod │ │  Module  │ │Module│
└────────┘ └─────┘ └──────────┘ └──────┘
```

---

## 📋 Refactoring Plan - Phase by Phase

### Phase 1: Backend Restructuring (Priority: CRITICAL)

**Duration:** 3-4 days  
**Risk:** Medium  
**Impact:** High

#### Step 1.1: Create Directory Structure

```bash
mkdir -p backend/{api/v1,services,models,data,utils}
touch backend/__init__.py
touch backend/config.py
touch backend/exceptions.py
touch backend/utils/vite.py
touch backend/api/__init__.py
touch backend/api/errors.py
touch backend/api/v1/{__init__.py,routes.py,health.py}
touch backend/services/{__init__.py,routing_service.py,navigation_service.py}
touch backend/models/{__init__.py,route.py,location.py}
touch backend/data/{__init__.py,geojson_loader.py,graph_builder.py}
touch backend/utils/{__init__.py,validators.py,geo_utils.py,logger.py}
```

#### Step 1.2: Extract Components from main.py

**Current main.py breakdown:**

- Lines 1-10: Imports → Keep in respective modules
- Lines 12-13: load_dotenv() → Move to config.py
- Lines 15-16: Flask app → Move to backend/__init__.py (app factory)
- Lines 18-23: Configuration → Move to backend/config.py
- Lines 26-31: Data loading → Move to backend/data/geojson_loader.py
- Lines 34-48: Graph building → Move to backend/data/graph_builder.py
- Lines 50-66: Utility functions → Move to backend/utils/geo_utils.py
- Lines 68-120: Instruction generation → Move to backend/services/navigation_service.py
- Lines 122-124: Index route → Keep in main.py
- Lines 126-174: Route endpoint → Move to backend/api/v1/routes.py
- Lines 176-178: Main entry → Update to use app factory

#### Step 1.3: Create Configuration Management

**backend/config.py structure:**

```python
class Config:
    MAPBOX_ACCESS_TOKEN = os.getenv('MAPBOX_ACCESS_TOKEN')
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False
```

#### Step 1.4: Implement Services Layer

**backend/services/routing_service.py:**

- Class: RoutingService
- Methods: calculate_route(), snap_to_graph(), validate_coordinates()

**backend/services/navigation_service.py:**

- Class: NavigationService
- Methods: generate_turn_instructions(), calculate_bearing(), turn_direction()

#### Step 1.5: Create Data Layer

**backend/data/geojson_loader.py:**

- Class: GeoJSONLoader
- Methods: load_roads(), load_buildings()

**backend/data/graph_builder.py:**

- Class: GraphBuilder
- Methods: build_graph(), build_spatial_index()

#### Step 1.6: Error Handling & Validation

**backend/exceptions.py:**

- NasrdaNaviException (base)
- ValidationError
- RouteNotFoundError
- DataLoadError

**backend/utils/validators.py:**

- validate_coordinates()
- validate_route_params()

#### Step 1.7: Update Entry Point

**New main.py (simplified):**

```python
from backend import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5001)
```

---

### Phase 2: Frontend Modularization (Priority: CRITICAL)

**Duration:** 4-5 days  
**Risk:** High  
**Impact:** Very High

#### Step 2.1: Setup Vite

```bash
npm create vite@latest frontend -- --template vanilla
mv frontend/package.json .
mv frontend/vite.config.js .
npm install
rm frontend/index.html frontend/main.js
rm -rf frontend/public
mkdir -p frontend/{css,js/modules/{map,navigation,ui,utils}}
```

#### Step 2.2: Extract CSS from HTML

**Current state:** 663 lines of CSS inline in index.html

**New structure:**

```
frontend/css/
├── variables.css   # Design tokens
├── main.css        # Base styles
├── map.css         # Map-specific styles
├── mobile.css      # Mobile responsive
└── components.css  # UI components
```

#### Step 2.3: Break Down map.js (2,646 lines)

**Map Module:**

- map-core.js - Mapbox initialization
- map-controls.js - Custom controls
- map-layers.js - Layer management
- map-styles.js - Style switching
- map-terrain.js - 3D terrain

**Navigation Module:**

- gps-tracker.js - GPS tracking
- route-manager.js - Route management
- directions.js - Turn-by-turn display
- speech.js - Voice guidance

**UI Module:**

- search.js - Search functionality
- panels.js - UI panels
- markers.js - Marker management
- status.js - Status messages

**Utils Module:**

- api-client.js - Backend API calls
- geo-helpers.js - Geo calculations
- constants.js - Constants/config

#### Step 2.4: Update index.html

**Current:** 797 lines with inline CSS  
**Target:** ~150 lines, clean structure

```html
<script type="module" src="{{ vite_asset('js/main.js') }}"></script>
<link rel="stylesheet" href="{{ vite_asset('css/main.css') }}" />
```

---

### Phase 3: Configuration & Environment (Priority: HIGH)

**Duration:** 1 day  
**Risk:** Low  
**Impact:** Medium

#### Step 3.1: Create .env.example

```bash
MAPBOX_ACCESS_TOKEN=your_token_here
FLASK_ENV=development
FLASK_DEBUG=True
LOG_LEVEL=INFO
```

#### Step 3.2: Frontend Configuration

**frontend/js/config.js:**

```javascript
export const config = {
    mapbox: {
        accessToken: MAPBOX_TOKEN,
        defaultStyle: 'mapbox://styles/mapbox/standard',
        defaultZoom: 16,
        defaultPitch: 80
    },
    campus: {
        center: [7.386361992341225, 8.989575961419508],
        bounds: [...]
    },
    navigation: {
        offRouteThreshold: 35,
        arrivalThreshold: 15,
        advanceWarningDistance: 60
    },
    api: {
        baseUrl: '/api/v1',
        timeout: 30000
    }
};
```

#### Step 3.3: Update .gitignore

```gitignore
__pycache__/
*.py[cod]
venv/
.env
.env.local
logs/
*.log
*.pid
.vscode/
.idea/
.DS_Store
dist/
node_modules/
```

---

### Phase 4: Documentation Organization (Priority: LOW)

**Duration:** 0.5 day  
**Risk:** Low  
**Impact:** Medium

#### Step 4.1: Create docs/ Structure

```bash
mkdir -p docs/{architecture,guides}
```

#### Step 4.2: Move Documentation

- Move scattered docs to docs/
- Create docs/architecture/backend.md
- Create docs/architecture/frontend.md
- Create docs/guides/development.md

---

## 📁 Final Directory Structure

```
NasrdaNavi/
├── backend/                          # Main application package
│   ├── __init__.py              # Flask app factory
│   ├── config.py                # Configuration management
│   ├── exceptions.py            # Custom exceptions
│   ├── api/                     # API endpoints
│   │   ├── __init__.py
│   │   ├── errors.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── routes.py
│   │       └── health.py
│   ├── services/                # Business logic
│   │   ├── __init__.py
│   │   ├── routing_service.py
│   │   └── navigation_service.py
│   ├── models/                  # Data models
│   │   ├── __init__.py
│   │   ├── route.py
│   │   └── location.py
│   ├── data/                    # Data handling
│   │   ├── __init__.py
│   │   ├── geojson_loader.py
│   │   └── graph_builder.py
│   └── utils/                   # Utilities
│       ├── __init__.py
│       ├── vite.py
│       ├── validators.py
│       ├── geo_utils.py
│       └── logger.py
├── frontend/                    # Frontend Source Code
│   ├── css/
│   │   ├── variables.css
│   │   ├── main.css
│   │   ├── map.css
│   │   ├── mobile.css
│   │   └── components.css
│   └── js/
│       ├── main.js
│       ├── config.js
│       └── modules/
│           ├── map/
│           ├── navigation/
│           ├── ui/
│           └── utils/
├── static/                      # Public Assets & Build Output
│   ├── dist/                    # Vite Build Output
│   └── data/
│       ├── roads.geojson
│       └── buildings.geojson
├── templates/
│   └── index.html
├── docs/                        # Documentation
│   ├── architecture/
│   └── guides/
├── logs/                        # Log files
├── .env.example
├── .gitignore
├── main.py                      # Application entry point
├── package.json
├── vite.config.js
├── requirements.txt
├── runtime.txt
├── render.yaml
└── README.md
```

---

## 🎯 Implementation Schedule

### Week 1: Backend + Frontend Core

**Days 1-2: Backend Structure**

- [ ] Create directory structure
- [ ] Setup configuration management
- [ ] Create custom exceptions
- [ ] Extract services (RoutingService, NavigationService)
- [ ] Create data loaders
- [ ] Update main.py to use app factory

**Days 3-5: Frontend Modularization**

- [ ] Setup Vite
- [ ] Extract CSS to separate files
- [ ] Extract map modules
- [ ] Extract navigation modules
- [ ] Extract UI modules
- [ ] Extract utils
- [ ] Update index.html

### Week 2: Polish

**Days 1-2: Configuration & Cleanup**

- [ ] Create .env.example
- [ ] Update .gitignore
- [ ] Organize documentation
- [ ] Final integration testing

---

## ✅ Expected Benefits

- **Maintainability** - Clear module boundaries, easy to find code
- **Scalability** - Easy to add features without breaking existing code
- **Collaboration** - Multiple developers can work in parallel
- **Debugging** - Smaller files, easier to trace issues

---

## ⚠️ Risks & Mitigation

### Risk 1: Breaking Existing Functionality

**Mitigation:**

- Refactor incrementally (one module at a time)
- Test thoroughly after each extraction
- Keep original files as backup during transition

### Risk 2: Time Overrun

**Mitigation:**

- Strict priorities (backend → frontend → rest)
- Focus on critical path first
- Defer non-essential items

---

## 🚀 Next Steps

1. Create backup branch
2. Create feature branch: `refactor/architecture-improvements`
3. Start Phase 1 (Backend Restructuring)

---

**Document Status:** Ready  
**Last Updated:** November 26, 2025  
**Owner:** Development Team
