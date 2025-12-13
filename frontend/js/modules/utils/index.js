export { errorHandler } from "./errorHandler.js"
export { loadingManager } from "./loading.js"

export function findNearest(features, latlng) {
  let nearest = null
  let minDist = Infinity

  features.forEach((f) => {
    if (f.geometry.type === "Point") {
      const [lon, lat] = f.geometry.coordinates
      const dist = Math.hypot(lat - latlng.lat, lon - latlng.lng)
      if (dist < minDist) {
        minDist = dist
        nearest = f
      }
    }
  })

  return nearest
}
