import { useMemo } from 'react';
import { View } from 'react-native';
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
} from '@maplibre/maplibre-react-native';

const OSM_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

type Bounds = [west: number, south: number, east: number, north: number];

type Props = {
  polygon?: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  path?:    GeoJSON.LineString | GeoJSON.MultiLineString | null;
  ownerColor?: string;
  height?:   number;
  // Defaults to ownerColor so the route line matches the activity owner's
  // preferred color. Pass an override explicitly to break that tie.
  pathColor?: string;
};

// Walks any nested coordinate array and reduces it to [west, south, east, north].
function expandBounds(coords: unknown, bounds: Bounds): Bounds {
  if (!Array.isArray(coords)) return bounds;
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    const lng = coords[0] as number;
    const lat = coords[1] as number;
    return [
      Math.min(bounds[0], lng),
      Math.min(bounds[1], lat),
      Math.max(bounds[2], lng),
      Math.max(bounds[3], lat),
    ];
  }
  let next = bounds;
  for (const c of coords) next = expandBounds(c, next);
  return next;
}

function geometryBounds(geoms: (GeoJSON.Geometry | null | undefined)[]): Bounds | null {
  let bounds: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  let touched = false;
  for (const g of geoms) {
    if (!g || !('coordinates' in g)) continue;
    bounds = expandBounds(g.coordinates as unknown, bounds);
    touched = true;
  }
  if (!touched || !isFinite(bounds[0])) return null;
  // Pad ~5% so the route doesn't kiss the edges
  const dLng = Math.max(0.0005, (bounds[2] - bounds[0]) * 0.05);
  const dLat = Math.max(0.0005, (bounds[3] - bounds[1]) * 0.05);
  return [bounds[0] - dLng, bounds[1] - dLat, bounds[2] + dLng, bounds[3] + dLat];
}

// Non-interactive map for the feed and detail screens. Shows the captured
// territory polygon (filled) plus the route line (matched-to-roads when
// available, simplified raw GPS otherwise). All gestures disabled.
export function StaticActivityMap({
  polygon,
  path,
  ownerColor = '#7F77DD',
  pathColor,
  height     = 220,
}: Props) {
  const resolvedPathColor = pathColor ?? ownerColor;
  const bounds = useMemo(() => geometryBounds([polygon ?? null, path ?? null]), [polygon, path]);

  const polygonFc = useMemo<GeoJSON.Feature | null>(() => {
    if (!polygon) return null;
    return { type: 'Feature', geometry: polygon, properties: {} };
  }, [polygon]);

  const pathFc = useMemo<GeoJSON.Feature | null>(() => {
    if (!path) return null;
    return { type: 'Feature', geometry: path, properties: {} };
  }, [path]);

  if (!bounds) {
    return <View style={{ height, backgroundColor: '#E5E7EB' }} />;
  }

  return (
    <View style={{ height, overflow: 'hidden' }}>
      <Map
        style={{ flex: 1 }}
        mapStyle={OSM_STYLE}
        logo={false}
        attribution={false}
        compass={false}
        scaleBar={false}
        dragPan={false}
        touchZoom={false}
        doubleTapZoom={false}
        doubleTapHoldZoom={false}
        touchRotate={false}
        touchPitch={false}
      >
        <Camera initialViewState={{ bounds, padding: { top: 24, bottom: 24, left: 24, right: 24 } }} />

        {polygonFc && (
          <GeoJSONSource id="static-activity-polygon" data={polygonFc}>
            <Layer
              id="static-activity-polygon-fill"
              type="fill"
              paint={{ 'fill-color': ownerColor, 'fill-opacity': 0.18 }}
            />
            <Layer
              id="static-activity-polygon-line"
              type="line"
              paint={{ 'line-color': ownerColor, 'line-width': 3, 'line-opacity': 0.9 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        )}

        {pathFc && (
          <GeoJSONSource id="static-activity-path" data={pathFc}>
            <Layer
              id="static-activity-path-line"
              type="line"
              paint={{ 'line-color': resolvedPathColor, 'line-width': 4, 'line-opacity': 0.95 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        )}
      </Map>
    </View>
  );
}
