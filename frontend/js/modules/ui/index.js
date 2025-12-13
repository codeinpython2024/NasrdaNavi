import { mapManager } from '../map/index.js';

class UIManager {
    constructor() {
        this.localFeatures = [];
        this.highlightMarker = null;
    }

    setFeatures(roads, buildings, sportArena = null) {
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
        if (sportArena) {
            sportArena.features.forEach(f => {
                if (f.properties.Name) {
                    this.localFeatures.push({
                        name: f.properties.Name,
                        type: 'sport',
                        geometry: f.geometry
                    });
                }
            });
        }
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
            item.textContent = `${match.name} (${match.type})`;
            item.onclick = () => this.selectFeature(match, resultsDiv, searchBox);
            resultsDiv.appendChild(item);
        });
        resultsDiv.style.display = 'block';
    }

    selectFeature(match, resultsDiv, searchBox) {
        const geom = match.geometry;

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
            mapManager.map.addSource('highlight', { type: 'geojson', data: { type: 'Feature', geometry: geom } });
            mapManager.map.addLayer({
                id: 'highlight-line',
                type: 'line',
                source: 'highlight',
                paint: { 'line-color': '#008751', 'line-width': 4 }
            });

            const bounds = new mapboxgl.LngLatBounds();
            const addCoords = coords => {
                if (typeof coords[0] === 'number') bounds.extend(coords);
                else coords.forEach(addCoords);
            };
            addCoords(geom.coordinates);
            mapManager.fitBounds(bounds);

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
                li.className = 'list-group-item';
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
        const container = document.getElementById('directionsBody');
        if (!container) return;

        container.innerHTML = '';

        if (!directions || directions.length === 0) {
            container.innerHTML = '<p class="text-muted">Click on the map to set start and end points.</p>';
            return;
        }

        const ul = document.createElement('ul');
        ul.className = 'list-group list-group-flush';
        directions.forEach((step, i) => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.innerHTML = `<strong>${i + 1}.</strong> ${step.text}`;
            ul.appendChild(li);
        });
        container.appendChild(ul);
    }
}

export const uiManager = new UIManager();
