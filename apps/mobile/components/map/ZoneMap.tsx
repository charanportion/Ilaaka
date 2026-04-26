import { useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import {
  Map,
  Camera,
  UserLocation,
  GeoJSONSource,
  Layer,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import type { NativeSyntheticEvent } from 'react-native';
import type { ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import type { PressEventWithFeatures } from '@maplibre/maplibre-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchZonesInBbox, fetchMyTracesInBbox } from '@/lib/zones';
import type { TraceInBbox } from '@/lib/zones';
import { useAuthStore } from '@/stores/auth-store';
import { ZoneInfoCard } from './ZoneInfoCard';
import type { ZoneInBbox } from '@/types/api';

const OSM_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const BENGALURU: [number, number] = [77.6271, 12.9352]; // [lng, lat] fallback
const INITIAL_ZOOM = 14;
const MIN_FETCH_ZOOM = 10;
const DEBOUNCE_MS = 300;
const TRACE_COLOR = '#6366F1'; // indigo — matches app theme

type LngLatBounds = [number, number, number, number]; // [west, south, east, north]

type SelectedZoneProps = {
  color: string;
  owner_username: string;
  captured_at: string;
  is_own: boolean;
};

export function ZoneMap({ showOnlyMine }: { showOnlyMine: boolean }) {
  const userId = useAuthStore((s) => s.user?.id);
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [zones, setZones] = useState<ZoneInBbox[]>([]);
  const [traces, setTraces] = useState<TraceInBbox[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState<SelectedZoneProps | null>(null);
  const bboxRef = useRef<LngLatBounds | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((pos) => setInitialCenter([pos.coords.longitude, pos.coords.latitude]))
      .catch(() => setInitialCenter(BENGALURU));
  }, []);

  async function doFetch(bounds: LngLatBounds) {
    cancelRef.current = false;
    setLoading(true);
    try {
      const [zoneData, traceData] = await Promise.all([
        fetchZonesInBbox(bounds),
        fetchMyTracesInBbox(bounds),
      ]);
      if (!cancelRef.current) {
        setZones(zoneData);
        setTraces(traceData);
      }
    } catch {
      // silent on the map
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }

  function handleRegionChange(e: NativeSyntheticEvent<ViewStateChangeEvent>) {
    const { zoom, bounds } = e.nativeEvent;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (zoom < MIN_FETCH_ZOOM) return;
      const bbox: LngLatBounds = [bounds[0], bounds[1], bounds[2], bounds[3]];
      bboxRef.current = bbox;
      doFetch(bbox);
    }, DEBOUNCE_MS);
  }

  // Refetch on tab focus so a fresh capture shows up immediately
  useFocusEffect(
    useCallback(() => {
      if (bboxRef.current) doFetch(bboxRef.current);
      return () => { cancelRef.current = true; };
    }, []),
  );

  const visible = showOnlyMine ? zones.filter((z) => z.owner_id === userId) : zones;

  const zoneFc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: visible.map((z) => ({
      type: 'Feature',
      id: z.h3_index,
      geometry: z.geom as GeoJSON.Polygon,
      properties: {
        color: z.owner_color,
        owner_id: z.owner_id,
        owner_username: z.owner_username,
        captured_at: z.captured_at,
        h3_index: z.h3_index,
        is_own: z.owner_id === userId,
      },
    })),
  };

  const traceFc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: traces.map((t) => ({
      type: 'Feature',
      id: t.activity_id,
      geometry: t.geom as GeoJSON.LineString,
      properties: {},
    })),
  };

  function handleZonePress(e: NativeSyntheticEvent<PressEventWithFeatures>) {
    const feature = e.nativeEvent.features[0];
    if (!feature?.properties) return;
    setSelectedZone(feature.properties as SelectedZoneProps);
  }

  if (!initialCenter) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Map
        style={{ flex: 1 }}
        mapStyle={OSM_STYLE}
        logo={false}
        attribution={false}
        onRegionDidChange={handleRegionChange}
        onPress={() => setSelectedZone(null)}
      >
        <Camera
          initialViewState={{
            center: initialCenter,
            zoom: INITIAL_ZOOM,
          }}
        />
        <UserLocation />

        {zoneFc.features.length > 0 && (
          <GeoJSONSource id="zones" data={zoneFc} onPress={handleZonePress}>
            <Layer
              id="zones-fill"
              type="fill"
              paint={{
                'fill-color': ['get', 'color'],
                'fill-opacity': ['case', ['boolean', ['get', 'is_own'], false], 0.55, 0.3],
              }}
            />
            <Layer
              id="zones-line"
              type="line"
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 1,
                'line-opacity': 0.8,
              }}
            />
          </GeoJSONSource>
        )}

        {traceFc.features.length > 0 && (
          <GeoJSONSource id="traces" data={traceFc}>
            <Layer
              id="traces-line"
              type="line"
              paint={{
                'line-color': TRACE_COLOR,
                'line-width': 3,
                'line-opacity': 0.9,
              }}
            />
          </GeoJSONSource>
        )}
      </Map>

      {loading && (
        <View style={{ position: 'absolute', top: 16, right: 16 }}>
          <ActivityIndicator size="small" color="#6366F1" />
        </View>
      )}

      {selectedZone && (
        <View style={{ position: 'absolute', bottom: 24, left: 0, right: 0 }}>
          <ZoneInfoCard
            properties={selectedZone}
            onClose={() => setSelectedZone(null)}
          />
        </View>
      )}
    </View>
  );
}
