import { mapManager } from '../map/index.js';

class UIManager {
    constructor() {
        this.localFeatures = [];
        this.directionsCollapse = null;
        this.highlightMarker = null;
    }

    init() {
        const collapseEl = document.getElementById('directionsBody');
        this.directionsCollapse = new bootstrap.Collapse(collapseEl, { toggle: false });
    }

    setFeatures(roads, buildings) {
        this.localFeatures = [];
        roads.features.forEach(f => {
            if (f.properties.name) {
                this.localFeatures.push({ name: f.properties.name, type: 'road', geometry: f.geometry });
            }
        });
        buildings.features.forEach(f => {
            if (f.properties.name) {
                this.localFeatures.push({
                    name: f.properties.name,
                    type: 'building',
                    geometry: f.geometry,
                    departments: f.properties.departments || []
                });
            }
        });
    }

    search(query) {
        if (!query) return [];
        return this.localFeatures
            .filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 10);
    }

    showSearchResults(matches, resultsDiv, searchBox) {
        resultsDiv.innerHTML = '';
        if (matches.length === 0) {
            resultsDiv.style.display = 'none';
            return;
        }

        matches.forEach(match => {
            const item = document.createElement('div');
            item.className = 'p-1 border-bottom';
            item.textContent = `${match.name} (${match.type})`;
            item.onclick = () => this.selectFeature(match, resultsDiv, searchBox);
            resultsDiv.appendChild(item);
        });
        resultsDiv.style.display = 'block';
    }

    selectFeature(match, resultsDiv, searchBox) {
        const geom = match.geometry;

        // Remove previous highlight
        if (this.highlightMarker) this.highlightMarker.remove();
        if (mapManager.map.getLayer('highlight-line')) {
            mapManager.map.removeLayer('highlight-line');
            mapManager.map.removeSource('highlight');
        }

        if (geom.type === 'Point') {
            const [lon, lat] = geom.coordinates;
            mapManager.setCenter([lon, lat], 17);
            this.highlightMarker = new mapboxgl.Marker()
                .setLngLat([lon, lat])
                .setPopup(new mapboxgl.Popup().setText(`${match.name} (${match.type})`))
                .addTo(mapManager.map)
                .togglePopup();
        } else {
            // Add highlight layer
            mapManager.map.addSource('highlight', { type: 'geojson', data: { type: 'Feature', geometry: geom } });
            mapManager.map.addLayer({
                id: 'highlight-line',
                type: 'line',
                source: 'highlight',
                paint: { 'line-color': '#ef4444', 'line-width': 4 }
            });

            // Fit bounds
            const bounds = new mapboxgl.LngLatBounds();
            const addCoords = coords => {
                if (typeof coords[0] === 'number') bounds.extend(coords);
                else coords.forEach(addCoords);
            };
            addCoords(geom.coordinates);
            mapManager.fitBounds(bounds);

            // Remove after 6s
            setTimeout(() => {
                if (mapManager.map.getLayer('highlight-line')) {
                    mapManager.map.removeLayer('highlight-line');
                    mapManager.map.removeSource('highlight');
                }
            }, 6000);
        }

        this.showDepartments(match);
        resultsDiv.innerHTML = '';
        resultsDiv.style.display = 'none';
        searchBox.value = '';
    }

    showDepartments(match) {
        const departmentList = document.getElementById('departmentList');
        const departmentsUl = document.getElementById('departments');

        if (match.type === 'building' && match.departments?.length) {
            departmentsUl.innerHTML = '';
            match.departments.forEach(dep => {
                const li = document.createElement('li');
                li.className = 'list-group-item list-group-item-action';
                li.textContent = dep;
                departmentsUl.appendChild(li);
            });
            departmentList.style.display = 'block';
        } else {
            departmentsUl.innerHTML = '';
            departmentList.style.display = 'none';
        }
    }

    updateDirections(directions) {
        const container = document.querySelector('#directionsPanel .directions');
        container.innerHTML = '';

        if (!directions || directions.length === 0) {
            container.innerHTML = '<p class="text-muted mb-0">Select start and end points on the map.</p>';
            this.directionsCollapse.hide();
            return;
        }

        const ul = document.createElement('ul');
        ul.className = 'list-group list-group-flush';
        directions.forEach((step, i) => {
            const li = document.createElement('li');
            li.className = 'list-group-item p-1';
            li.innerHTML = `<strong>${i + 1}.</strong> ${step.text}`;
            ul.appendChild(li);
        });
        container.appendChild(ul);
        this.directionsCollapse.show();
    }
}

export const uiManager = new UIManager();
