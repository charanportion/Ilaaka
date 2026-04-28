import { useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import {
  Map,
  Camera,
  UserLocation,
  GeoJSONSource,
  Layer,
  useCurrentPosition,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import type { NativeSyntheticEvent } from 'react-native';
import type { ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import type { PressEventWithFeatures } from '@maplibre/maplibre-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { fetchZonePolygonsInBbox } from '@/lib/zones';
import { fetchFriendsZones } from '@/lib/friends';
import { useAuthStore } from '@/stores/auth-store';
import { ZoneInfoCard } from './ZoneInfoCard';
import { MapRecenterButton } from './MapRecenterButton';
import type { MergedZoneInBbox, ZoneFilter } from '@/types/api';

const OSM_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const HYDERABAD: [number, number] = [78.3338, 17.4010]; // [lng, lat] fallback
const INITIAL_ZOOM = 14;
const MIN_FETCH_ZOOM = 10;
const DEBOUNCE_MS = 300;

// Personalization: tighter zoom for slower modes, wider for faster ones.
// See docs/onboarding.md "Personalization rules — primary_activity".
const ZOOM_BY_ACTIVITY: Record<string, number> = {
  walk:  16,
  run:   15,
  hike:  15,
  cycle: 13,
};

type LngLatBounds = [number, number, number, number]; // [west, south, east, north]

const NEAR_USER_METERS = 30;

function isNear(a: [number, number] | null, b: [number, number] | null): boolean {
  if (!a || !b) return false;
  const cosLat = Math.cos((a[1] * Math.PI) / 180);
  const dxMeters = (a[0] - b[0]) * cosLat * 111_320;
  const dyMeters = (a[1] - b[1]) * 111_320;
  return Math.hypot(dxMeters, dyMeters) < NEAR_USER_METERS;
}

type SelectedZoneProps = {
  color: string;
  owner_id: string;
  owner_username: string;
  owner_display_name: string;
  owner_avatar_url: string | null;
  captured_at: string;
  is_own: boolean;
};

export function ZoneMap({ filter }: { filter: ZoneFilter }) {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const primaryActivity = useAuthStore((s) => s.profile?.primary_activity);
  const initialZoom = primaryActivity
    ? ZOOM_BY_ACTIVITY[primaryActivity] ?? INITIAL_ZOOM
    : INITIAL_ZOOM;
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [zones, setZones] = useState<MergedZoneInBbox[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState<SelectedZoneProps | null>(null);
  const [bearing, setBearing] = useState(0);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const bboxRef = useRef<LngLatBounds | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRef = useRef(false);
  const featurePressedRef = useRef(false);
  const cameraRef = useRef<CameraRef | null>(null);

  const currentPosition = useCurrentPosition();
  const userLngLat: [number, number] | null = currentPosition?.coords
    ? [currentPosition.coords.longitude, currentPosition.coords.latitude]
    : null;

  useEffect(() => {
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((pos) => setInitialCenter([pos.coords.longitude, pos.coords.latitude]))
      .catch(() => setInitialCenter(HYDERABAD));
  }, []);

  async function doFetch(bounds: LngLatBounds, activeFilter: ZoneFilter) {
    cancelRef.current = false;
    setLoading(true);
    try {
      const zoneData = activeFilter === 'friends'
        ? await fetchFriendsZones(bounds)
        : await fetchZonePolygonsInBbox(bounds);
      if (!cancelRef.current) setZones(zoneData);
    } catch (e) {
      console.error('[zone-map] fetch error:', e);
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }

  // Refetch when filter changes
  useEffect(() => {
    if (bboxRef.current) {
      cancelRef.current = true;
      doFetch(bboxRef.current, filter);
    }
  }, [filter]);

  function handleRegionChange(e: NativeSyntheticEvent<ViewStateChangeEvent>) {
    const { zoom, bounds } = e.nativeEvent;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (zoom < MIN_FETCH_ZOOM) return;
      const bbox: LngLatBounds = [bounds[0], bounds[1], bounds[2], bounds[3]];
      bboxRef.current = bbox;
      doFetch(bbox, filter);
    }, DEBOUNCE_MS);
  }

  function handleRegionIsChanging(e: NativeSyntheticEvent<ViewStateChangeEvent>) {
    const { bearing: nextBearing, center } = e.nativeEvent;
    setBearing(nextBearing);
    setMapCenter([center[0], center[1]]);
  }

  const isCenteredOnUser = isNear(mapCenter ?? initialCenter, userLngLat);

  function handleRecenterPress() {
    if (!cameraRef.current) return;
    if (isCenteredOnUser) {
      cameraRef.current.setStop({ bearing: 0, pitch: 0, duration: 400 });
      return;
    }
    if (!userLngLat) return;
    cameraRef.current.easeTo({
      center: userLngLat,
      zoom: initialZoom,
      duration: 500,
    });
  }

  // Refetch on tab focus so a fresh capture shows up immediately
  useFocusEffect(
    useCallback(() => {
      if (bboxRef.current) doFetch(bboxRef.current, filter);
      return () => { cancelRef.current = true; };
    }, [filter]),
  );

  const visible = filter === 'mine'
    ? zones.filter((z) => z.owner_id === userId)
    : zones;

  const zoneFc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: visible.map((z) => ({
      type: 'Feature',
      id: z.owner_id,
      geometry: z.geom as GeoJSON.Polygon | GeoJSON.MultiPolygon,
      properties: {
        color: z.owner_color,
        owner_id: z.owner_id,
        owner_username: z.owner_username,
        owner_display_name: z.owner_display_name,
        owner_avatar_url: z.owner_avatar_url ?? null,
        captured_at: z.captured_at,
        is_own: z.owner_id === userId,
      },
    })),
  };

  function handleZonePress(e: NativeSyntheticEvent<PressEventWithFeatures>) {
    const feature = e.nativeEvent.features[0];
    if (!feature?.properties) return;
    featurePressedRef.current = true;
    setSelectedZone(feature.properties as SelectedZoneProps);
  }

  function handleMapPress() {
    if (featurePressedRef.current) {
      featurePressedRef.current = false;
      return;
    }
    setSelectedZone(null);
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
        onRegionIsChanging={handleRegionIsChanging}
        onPress={handleMapPress}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: initialCenter,
            zoom: initialZoom,
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
                'fill-opacity': ['case', ['boolean', ['get', 'is_own'], false], 0.18, 0.1],
              }}
            />
            <Layer
              id="zones-line"
              type="line"
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 4,
                'line-opacity': 1,
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

      {userLngLat && (
        <View style={{ position: 'absolute', right: 16, bottom: selectedZone ? 200 : 32 }}>
          <MapRecenterButton
            mode={isCenteredOnUser ? 'compass' : 'recenter'}
            bearing={bearing}
            onPress={handleRecenterPress}
          />
        </View>
      )}

      {selectedZone && (
        <View style={{ position: 'absolute', bottom: 24, left: 0, right: 0 }}>
          <ZoneInfoCard
            properties={selectedZone}
            onClose={() => setSelectedZone(null)}
            onViewProfile={(ownerId) => {
              setSelectedZone(null);
              router.push(`/user/${ownerId}` as any);
            }}
          />
        </View>
      )}
    </View>
  );
}
