// Ray casting algorithm (latitude treated as X, longitude as Y consistently with array order)
export function pointInPolygon(lat, lng, polygon = []) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lngI] = polygon[i];
    const [latJ, lngJ] = polygon[j];
    const intersect = ((lngI > lng) !== (lngJ > lng)) &&
      (lat < (latJ - latI) * (lng - lngI) / (lngJ - lngI + 1e-12) + latI);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInPolygons(lat, lng, polygons = []) {
  if (!Array.isArray(polygons) || polygons.length === 0) return false;
  return polygons.some((polygon) => Array.isArray(polygon) && polygon.length >= 3 && pointInPolygon(lat, lng, polygon));
}

export function extractPolygonsFromGeoJson(geojson) {
  if (!geojson) return [];
  let parsed = geojson;
  if (typeof geojson === 'string') {
    try {
      parsed = JSON.parse(geojson);
    } catch {
      return [];
    }
  }

  const geometries = [];
  if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
    parsed.features.forEach((feature) => {
      if (feature && feature.geometry) geometries.push(feature.geometry);
    });
  } else if (parsed.type === 'Feature' && parsed.geometry) {
    geometries.push(parsed.geometry);
  } else if (parsed.type && parsed.coordinates) {
    geometries.push(parsed);
  }

  const polygons = [];
  geometries.forEach((geom) => {
    if (!geom || !Array.isArray(geom.coordinates)) return;
    if (geom.type === 'Polygon') {
      const ring = geom.coordinates[0];
      polygons.push(convertRingToLatLng(ring));
    } else if (geom.type === 'MultiPolygon') {
      geom.coordinates.forEach((poly) => {
        if (Array.isArray(poly) && poly[0]) {
          polygons.push(convertRingToLatLng(poly[0]));
        }
      });
    }
  });

  return polygons.filter((poly) => Array.isArray(poly) && poly.length >= 3);
}

function convertRingToLatLng(ring = []) {
  return ring
    .map((pair) => {
      const [lng, lat] = pair;
      if (typeof lat !== 'number' || typeof lng !== 'number') return null;
      return [lat, lng];
    })
    .filter(Boolean);
}
