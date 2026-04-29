type TracePoint = { lng: number; lat: number };

export function haversineMeters(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function traceDistance(points: TracePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1].lng, points[i - 1].lat, points[i].lng, points[i].lat);
  }
  return total;
}

// Sum of positive altitude deltas with a 1 m noise threshold.
// Returns 0 if any point lacks altitude (older devices / pre-altitude buffers).
export function elevationGain(points: { altitude?: number | null }[]): number {
  if (points.length < 2) return 0;
  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    const a0 = points[i - 1].altitude;
    const a1 = points[i].altitude;
    if (a0 == null || a1 == null) return 0;
    const delta = a1 - a0;
    if (delta >= 1) gain += delta;
  }
  return gain;
}
