// Delivery area polygon extracted from KML `Limites de livraison.kml`.
// KML coordinate order: lon,lat,alt. We store as [lat, lng].
export const deliveryPolygon = [
  [46.5358384, -72.7649188],
  [46.5361189, -72.761035],
  [46.5378311, -72.7624941],
  [46.539986, -72.7618718],
  [46.5413587, -72.7597475],
  [46.5412258, -72.7564001],
  [46.5396466, -72.7534819],
  [46.5369455, -72.7514434],
  [46.5361336, -72.7504992],
  [46.5363255, -72.7477527],
  [46.537344, -72.7428603],
  [46.5378606, -72.7416158],
  [46.541152, -72.7423453],
  [46.5455649, -72.7405214],
  [46.5520433, -72.7312088],
  [46.5544633, -72.7318096],
  [46.5677713, -72.715416],
  [46.5805746, -72.7081633],
  [46.5855004, -72.6978636],
  [46.5959994, -72.7107382],
  [46.5875944, -72.7561426],
  [46.5915759, -72.7860546],
  [46.5860903, -72.8028774],
  [46.5802501, -72.8031349],
  [46.5605718, -72.7742958],
  [46.5513055, -72.7615929],
  [46.5429822, -72.7647686],
  [46.5358384, -72.7649188], // closing coordinate
];

// Ray casting algorithm (latitude treated as X, longitude as Y consistently with array order)
export function pointInPolygon(lat, lng, polygon = deliveryPolygon) {
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
