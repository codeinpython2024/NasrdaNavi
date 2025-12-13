import { mapManager } from "../map/index.js"

class UIManager {
  constructor() {
    this.localFeatures = []
    this.highlightMarker = null
    this.fuse = null
    this.fuseOptions = {
      // Keys to search on
      keys: [
        { name: "name", weight: 0.7 },
        { name: "type", weight: 0.15 },
        { name: "parentBuilding", weight: 0.15 }, // For departments
      ],
      // Fuzzy matching options
      threshold: 0.4, // 0.0 = exact match, 1.0 = match anything
      distance: 100, // How far to search for a match
      minMatchCharLength: 2,
      includeScore: true,
      includeMatches: true,
      ignoreLocation: true, // Search entire string, not just start
      findAllMatches: true,
    }
  }

  setFeatures(roads, buildings, sportArena = null) {
    this.localFeatures = []

    roads.features.forEach((f) => {
      if (f.properties.name) {
        this.localFeatures.push({
          name: f.properties.name,
          type: "road",
          geometry: f.geometry,
        })
      }
    })

    buildings.features.forEach((f) => {
      if (f.properties.name) {
        const buildingName = f.properties.name

        // Parse departments - can be comma-separated string or array
        let departments = []
        const deptData = f.properties.Department || f.properties.departments
        if (typeof deptData === "string" && deptData.trim()) {
          // Split by comma and clean up each department name
          departments = deptData
            .split(",")
            .map((d) => d.trim())
            .filter((d) => d.length > 0)
        } else if (Array.isArray(deptData)) {
          departments = deptData
        }

        // Add the building itself
        this.localFeatures.push({
          name: buildingName,
          type: "building",
          geometry: f.geometry,
          departments: departments,
        })

        // Add each department as a separate searchable item
        departments.forEach((dept) => {
          this.localFeatures.push({
            name: dept,
            type: "department",
            parentBuilding: buildingName,
            geometry: f.geometry, // Use building's geometry
            departments: [], // Departments don't have sub-departments
          })
        })
      }
    })

    if (sportArena) {
      sportArena.features.forEach((f) => {
        if (f.properties.Name) {
          this.localFeatures.push({
            name: f.properties.Name,
            type: "sport",
            geometry: f.geometry,
          })
        }
      })
    }

    // Initialize Fuse.js with the features
    this.initFuse()
  }

  /**
   * Initialize Fuse.js search index
   */
  initFuse() {
    if (typeof Fuse !== "undefined") {
      this.fuse = new Fuse(this.localFeatures, this.fuseOptions)
      console.log(
        `Fuzzy search initialized with ${this.localFeatures.length} features`
      )
    } else {
      console.warn("Fuse.js not loaded - falling back to basic search")
    }
  }

  /**
   * Search for features using fuzzy matching
   * @param {string} query - Search query
   * @returns {Array} - Matching features
   */
  search(query) {
    if (!query || query.length < 2) return []

    // Use Fuse.js if available
    if (this.fuse) {
      const results = this.fuse.search(query)
      return results.slice(0, 10).map((result) => ({
        ...result.item,
        score: result.score,
        matches: result.matches,
      }))
    }

    // Fallback to basic search
    return this.localFeatures
      .filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10)
  }

  showSearchResults(matches, resultsDiv, searchBox) {
    resultsDiv.innerHTML = ""

    if (matches.length === 0) {
      resultsDiv.style.display = "none"
      return
    }

    matches.forEach((match) => {
      const item = document.createElement("div")
      item.className = "search-result-item"
      item.setAttribute("role", "option")
      item.setAttribute("tabindex", "0")

      // Create container for name and optional parent info
      const nameContainer = document.createElement("div")
      nameContainer.className = "search-result-name-container"

      // Create highlighted name with matched portions
      const nameSpan = document.createElement("span")
      nameSpan.className = "search-result-name"

      if (match.matches && match.matches.length > 0) {
        // Highlight matched portions
        nameSpan.innerHTML = this.highlightMatches(match.name, match.matches)
      } else {
        nameSpan.textContent = match.name
      }

      nameContainer.appendChild(nameSpan)

      // For departments, show the parent building
      if (match.type === "department" && match.parentBuilding) {
        const parentSpan = document.createElement("span")
        parentSpan.className = "search-result-parent"
        parentSpan.textContent = `in ${match.parentBuilding}`
        nameContainer.appendChild(parentSpan)
      }

      // Type badge
      const typeBadge = document.createElement("span")
      typeBadge.className = `search-result-type type-${match.type}`
      typeBadge.textContent = match.type === "department" ? "dept" : match.type

      item.appendChild(nameContainer)
      item.appendChild(typeBadge)

      // Click handler
      item.onclick = () => this.selectFeature(match, resultsDiv, searchBox)

      // Keyboard handler for accessibility
      item.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          this.selectFeature(match, resultsDiv, searchBox)
        }
      }

      resultsDiv.appendChild(item)
    })

    resultsDiv.style.display = "block"
  }

  /**
   * Highlight matched portions of text
   * @param {string} text - Original text
   * @param {Array} matches - Fuse.js matches array
   * @returns {string} - HTML with highlighted matches
   */
  highlightMatches(text, matches) {
    if (!matches || matches.length === 0) return this.escapeHtml(text)

    // Find the name match
    const nameMatch = matches.find((m) => m.key === "name")
    if (!nameMatch || !nameMatch.indices) return this.escapeHtml(text)

    let result = ""
    let lastIndex = 0

    // Sort indices by start position
    const indices = [...nameMatch.indices].sort((a, b) => a[0] - b[0])

    for (const [start, end] of indices) {
      // Add text before match
      if (start > lastIndex) {
        result += this.escapeHtml(text.slice(lastIndex, start))
      }
      // Add highlighted match
      result += `<mark>${this.escapeHtml(text.slice(start, end + 1))}</mark>`
      lastIndex = end + 1
    }

    // Add remaining text
    if (lastIndex < text.length) {
      result += this.escapeHtml(text.slice(lastIndex))
    }

    return result
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }

  selectFeature(match, resultsDiv, searchBox) {
    const geom = match.geometry

    if (this.highlightMarker) this.highlightMarker.remove()
    if (mapManager.map.getLayer("highlight-line")) {
      mapManager.map.removeLayer("highlight-line")
      mapManager.map.removeSource("highlight")
    }

    // Build popup text based on type
    let popupText = match.name
    if (match.type === "department" && match.parentBuilding) {
      popupText = `${match.name} (in ${match.parentBuilding})`
    } else {
      popupText = `${match.name} (${match.type})`
    }

    if (geom.type === "Point") {
      const [lon, lat] = geom.coordinates
      mapManager.setCenter([lon, lat], 17)
      this.highlightMarker = new mapboxgl.Marker()
        .setLngLat([lon, lat])
        .setPopup(new mapboxgl.Popup().setText(popupText))
        .addTo(mapManager.map)
        .togglePopup()
    } else {
      mapManager.map.addSource("highlight", {
        type: "geojson",
        data: { type: "Feature", geometry: geom },
      })
      mapManager.map.addLayer({
        id: "highlight-line",
        type: "line",
        source: "highlight",
        paint: { "line-color": "#008751", "line-width": 4 },
      })

      const bounds = new mapboxgl.LngLatBounds()
      const addCoords = (coords) => {
        if (typeof coords[0] === "number") bounds.extend(coords)
        else coords.forEach(addCoords)
      }
      addCoords(geom.coordinates)
      mapManager.fitBounds(bounds)

      // Also add a popup at the centroid for non-point geometries
      const centroid = this.getGeometryCentroid(geom)
      if (centroid) {
        this.highlightMarker = new mapboxgl.Marker({ color: "#008751" })
          .setLngLat(centroid)
          .setPopup(new mapboxgl.Popup().setText(popupText))
          .addTo(mapManager.map)
          .togglePopup()
      }

      setTimeout(() => {
        if (mapManager.map.getLayer("highlight-line")) {
          mapManager.map.removeLayer("highlight-line")
          mapManager.map.removeSource("highlight")
        }
      }, 6000)
    }

    this.showDepartments(match)
    resultsDiv.innerHTML = ""
    resultsDiv.style.display = "none"
    searchBox.value = ""
  }

  /**
   * Calculate centroid of a geometry
   * @param {object} geom - GeoJSON geometry
   * @returns {Array|null} - [lng, lat] or null
   */
  getGeometryCentroid(geom) {
    try {
      let coords = []

      const collectCoords = (c) => {
        if (typeof c[0] === "number") {
          coords.push(c)
        } else {
          c.forEach(collectCoords)
        }
      }

      collectCoords(geom.coordinates)

      if (coords.length === 0) return null

      const sumLng = coords.reduce((sum, c) => sum + c[0], 0)
      const sumLat = coords.reduce((sum, c) => sum + c[1], 0)

      return [sumLng / coords.length, sumLat / coords.length]
    } catch {
      return null
    }
  }

  showDepartments(match) {
    const departmentList = document.getElementById("departmentList")
    const departmentsUl = document.getElementById("departments")

    if (match.type === "building" && match.departments?.length) {
      departmentsUl.innerHTML = ""
      match.departments.forEach((dep) => {
        const li = document.createElement("li")
        li.className = "list-group-item"
        li.textContent = dep
        departmentsUl.appendChild(li)
      })
      departmentList.style.display = "block"
    } else {
      departmentsUl.innerHTML = ""
      departmentList.style.display = "none"
    }
  }

  updateDirections(directions) {
    const container = document.getElementById("directionsBody")
    if (!container) return

    container.innerHTML = ""

    if (!directions || directions.length === 0) {
      container.innerHTML =
        '<p class="text-muted">Click on the map to set start and end points.</p>'
      return
    }

    const ul = document.createElement("ul")
    ul.className = "list-group list-group-flush"
    directions.forEach((step, i) => {
      const li = document.createElement("li")
      li.className = "list-group-item"
      li.innerHTML = `<strong>${i + 1}.</strong> ${this.escapeHtml(step.text)}`
      ul.appendChild(li)
    })
    container.appendChild(ul)
  }
}

export const uiManager = new UIManager()
