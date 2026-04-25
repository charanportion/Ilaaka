# Mobile app

Expo (React Native) project layout, navigation, state, GPS tracking, map rendering.

## Locked decisions

- **Framework:** Expo (managed workflow, prebuild when native modules required).
- **Language:** TypeScript everywhere (`strict: true` in `tsconfig.json`).
- **Routing:** Expo Router (file-system based, supports deep links out of the box).
- **State:** Zustand. One store per concern. No Redux. No Context for state (Context for theming only).
- **Map:** `@maplibre/maplibre-react-native` — open-source MapLibre fork, same vector-tile spec as Mapbox.
- **GPS:** `expo-location`, with `foregroundServiceType: 'location'` on Android.
- **Local DB (offline trace buffer):** `expo-sqlite`.
- **Forms:** `react-hook-form` + Zod resolvers.
- **HTTP/queries:** `@tanstack/react-query` for server state. Plain `supabase-js` for mutations.
- **Styling:** NativeWind (Tailwind for React Native). Colors mirror the Ilaaka color palette.

## Project init

```bash
npx create-expo-app@latest apps/mobile --template default
cd apps/mobile
npx expo install expo-router expo-linking expo-secure-store expo-location expo-sqlite expo-notifications expo-device
pnpm add @supabase/supabase-js zustand @tanstack/react-query react-hook-form zod react-native-url-polyfill
pnpm add @maplibre/maplibre-react-native
pnpm add -D nativewind tailwindcss
```

## Folder structure

```
apps/mobile/
├── app/                              # Expo Router routes
│   ├── _layout.tsx                   # Root layout, auth gate
│   ├── (auth)/                       # Unauthenticated screens
│   │   ├── _layout.tsx
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (app)/                        # Authenticated screens
│   │   ├── _layout.tsx               # Tab nav
│   │   ├── map.tsx                   # Map of zones (default tab)
│   │   ├── record.tsx                # Activity recorder
│   │   ├── activity/[id].tsx         # Post-activity summary
│   │   ├── profile.tsx
│   │   └── friends.tsx
│   └── auth-callback.tsx             # OAuth deep link handler
├── components/
│   ├── map/
│   │   ├── ZoneMap.tsx               # MapLibre wrapper with zone fill layer
│   │   ├── LiveTraceLayer.tsx        # Renders the in-progress trace
│   │   └── UserLocationDot.tsx
│   ├── activity/
│   │   ├── RecorderControls.tsx      # Start/pause/stop buttons
│   │   ├── ActivityTypePicker.tsx
│   │   └── PostActivityCard.tsx      # "You captured N cells, lost M from X"
│   ├── ui/                           # Reusable primitives (Button, Input, Card, ...)
│   └── shared/
│       ├── AuthGate.tsx
│       └── ErrorBoundary.tsx
├── lib/
│   ├── supabase.ts
│   ├── auth.ts
│   ├── push.ts                       # Expo Push token registration
│   ├── analytics.ts                  # PostHog
│   ├── sentry.ts
│   ├── h3.ts                         # h3-js helpers (display only — no capture math here)
│   └── colors.ts
├── stores/
│   ├── auth-store.ts                 # Session, user profile
│   ├── activity-store.ts             # Active recording state
│   └── map-store.ts                  # Camera, visible bbox
├── db/
│   └── trace-buffer.ts               # expo-sqlite for offline GPS buffer
├── types/
│   ├── api.ts                        # Request/response types matching Edge Functions
│   └── db.ts                         # Generated from `supabase gen types`
├── tailwind.config.js
├── babel.config.js
├── app.json
├── eas.json
├── tsconfig.json
└── package.json
```

## Navigation

Two route groups: `(auth)` for unauthenticated, `(app)` for authenticated. The root `_layout` swaps between them based on session.

```tsx
// apps/mobile/app/(app)/_layout.tsx
import { Tabs } from 'expo-router';
import { Map, Activity, User, Users } from 'lucide-react-native';

export default function AppLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="map"      options={{ title: 'Map',     tabBarIcon: ({ color, size }) => <Map     color={color} size={size} /> }} />
      <Tabs.Screen name="record"   options={{ title: 'Record',  tabBarIcon: ({ color, size }) => <Activity color={color} size={size} /> }} />
      <Tabs.Screen name="friends"  options={{ title: 'Friends', tabBarIcon: ({ color, size }) => <Users    color={color} size={size} /> }} />
      <Tabs.Screen name="profile"  options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <User     color={color} size={size} /> }} />
    </Tabs>
  );
}
```

## Zustand stores

Pattern: one store per concern, exposed via a hook.

```typescript
// apps/mobile/stores/auth-store.ts
import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  setSession: (s: Session | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  setSession: (s) => set({ session: s, user: s?.user ?? null }),
}));
```

```typescript
// apps/mobile/stores/activity-store.ts
import { create } from 'zustand';
import { LocationObject } from 'expo-location';

type ActivityType = 'run' | 'walk' | 'cycle' | 'hike';

type ActivityState = {
  isRecording: boolean;
  isPaused: boolean;
  type: ActivityType;
  startedAt: Date | null;
  points: { lng: number; lat: number; ts: number; accuracy: number }[];
  start: (type: ActivityType) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  addPoint: (loc: LocationObject) => void;
  reset: () => void;
};

export const useActivityStore = create<ActivityState>((set) => ({
  isRecording: false,
  isPaused: false,
  type: 'run',
  startedAt: null,
  points: [],
  start: (type) => set({ isRecording: true, isPaused: false, type, startedAt: new Date(), points: [] }),
  pause: () => set({ isPaused: true }),
  resume: () => set({ isPaused: false }),
  stop: () => set({ isRecording: false, isPaused: false }),
  addPoint: (loc) => set((s) =>
    s.isRecording && !s.isPaused
      ? { points: [...s.points, {
          lng: loc.coords.longitude,
          lat: loc.coords.latitude,
          ts: loc.timestamp,
          accuracy: loc.coords.accuracy ?? 999,
        }] }
      : {}
  ),
  reset: () => set({ isRecording: false, isPaused: false, points: [], startedAt: null }),
}));
```

## GPS recording

```typescript
// apps/mobile/lib/location.ts
import * as Location from 'expo-location';
import { useActivityStore } from '@/stores/activity-store';

let watcher: Location.LocationSubscription | null = null;

export async function startTracking() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') throw new Error('Location permission denied');

  // Background permission is requested only when the user starts recording.
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') throw new Error('Background location permission denied');

  watcher = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,        // 1 Hz nominal
      distanceInterval: 5,       // or every 5m, whichever is sooner
    },
    (loc) => useActivityStore.getState().addPoint(loc),
  );
}

export async function stopTracking() {
  watcher?.remove();
  watcher = null;
}
```

For background recording, also configure `app.json`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["location"],
        "NSLocationWhenInUseUsageDescription": "Ilaaka tracks your route while you exercise.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Ilaaka tracks your route in the background while recording an activity."
      }
    },
    "android": {
      "permissions": ["ACCESS_FINE_LOCATION", "ACCESS_BACKGROUND_LOCATION", "FOREGROUND_SERVICE"]
    },
    "plugins": [
      ["expo-location", {
        "locationAlwaysAndWhenInUsePermission": "Ilaaka tracks your route while you exercise.",
        "isAndroidBackgroundLocationEnabled": true,
        "isAndroidForegroundServiceEnabled": true
      }]
    ]
  }
}
```

## Offline trace buffer

Activities can be recorded in flight mode, in tunnels, or in shaky connectivity. Buffer to SQLite, sync on completion.

```typescript
// apps/mobile/db/trace-buffer.ts
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('ilaaka.db');

db.execSync(`
  create table if not exists trace_buffer (
    activity_local_id text not null,
    seq integer not null,
    lng real not null,
    lat real not null,
    ts integer not null,
    accuracy real not null,
    primary key (activity_local_id, seq)
  );
  create table if not exists pending_activities (
    local_id text primary key,
    type text not null,
    started_at integer not null,
    ended_at integer,
    submitted integer not null default 0
  );
`);

export function bufferPoint(localId: string, seq: number, p: { lng: number; lat: number; ts: number; accuracy: number }) {
  db.runSync(
    'insert or replace into trace_buffer values (?, ?, ?, ?, ?, ?)',
    localId, seq, p.lng, p.lat, p.ts, p.accuracy,
  );
}

export function readBufferedTrace(localId: string) {
  return db.getAllSync<{ lng: number; lat: number; ts: number; accuracy: number }>(
    'select lng, lat, ts, accuracy from trace_buffer where activity_local_id = ? order by seq',
    localId,
  );
}

export function clearBuffer(localId: string) {
  db.runSync('delete from trace_buffer where activity_local_id = ?', localId);
  db.runSync('delete from pending_activities where local_id = ?', localId);
}
```

## Map — MapLibre with zone fill

```tsx
// apps/mobile/components/map/ZoneMap.tsx
import MapLibreGL from '@maplibre/maplibre-react-native';
import { useEffect, useState } from 'react';
import { useMapStore } from '@/stores/map-store';
import { supabase } from '@/lib/supabase';

MapLibreGL.setAccessToken(null);     // OSM tiles don't need a token

const OSM_STYLE = 'https://tiles.openfreemap.org/styles/liberty';   // free, no API key

type Zone = {
  h3_index: number;
  owner_id: string;
  owner_color: string;
  geom: GeoJSON.Polygon;
};

export function ZoneMap() {
  const [zones, setZones] = useState<Zone[]>([]);
  const bbox = useMapStore((s) => s.bbox);

  useEffect(() => {
    if (!bbox) return;
    supabase.rpc('zones_in_bbox', {
      min_lng: bbox[0], min_lat: bbox[1], max_lng: bbox[2], max_lat: bbox[3],
    }).then(({ data }) => setZones(data ?? []));
  }, [bbox]);

  const fc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: zones.map((z) => ({
      type: 'Feature',
      geometry: z.geom,
      properties: { color: z.owner_color, h3: z.h3_index.toString() },
    })),
  };

  return (
    <MapLibreGL.MapView
      style={{ flex: 1 }}
      styleURL={OSM_STYLE}
      onRegionDidChange={(e) => {
        const ne = e.properties.visibleBounds[0];
        const sw = e.properties.visibleBounds[1];
        useMapStore.getState().setBbox([sw[0], sw[1], ne[0], ne[1]]);
      }}
    >
      <MapLibreGL.Camera defaultSettings={{ centerCoordinate: [77.6271, 12.9352], zoomLevel: 14 }} />
      <MapLibreGL.UserLocation visible androidRenderMode="gps" />
      <MapLibreGL.ShapeSource id="zones" shape={fc}>
        <MapLibreGL.FillLayer id="zones-fill" style={{ fillColor: ['get', 'color'], fillOpacity: 0.4 }} />
        <MapLibreGL.LineLayer id="zones-line" style={{ lineColor: ['get', 'color'], lineWidth: 0.5, lineOpacity: 0.7 }} />
      </MapLibreGL.ShapeSource>
    </MapLibreGL.MapView>
  );
}
```

OpenFreeMap is a community-run, free OSM tile host with no API key. Suitable for v0; switch to Protomaps + Cloudflare R2 if rate-limited.

## Push notification registration

On every login (and once per session), register the device's Expo Push token with the backend:

```typescript
// apps/mobile/lib/push.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export async function registerPushToken() {
  if (!Device.isDevice) return;     // No-op in simulator

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  });

  await supabase.from('push_tokens').upsert({
    token,
    platform: Platform.OS as 'ios' | 'android',
  });
}
```

Call `registerPushToken()` from the authenticated layout's mount effect.

## Testing — minimum bar

Unit-test pure functions (haversine, simplification helpers, color picker). Skip UI tests for v0 — the time investment isn't worth it pre-PMF. Manual smoke test on a physical Android device before each release. iOS simulator does *not* simulate GPS realistically; testing on actual hardware while walking is non-negotiable for the GPS pipeline.

## EAS build setup

```json
// eas.json
{
  "cli": { "version": ">= 13.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "channel": "production",
      "autoIncrement": true
    }
  }
}
```

Build commands:

```bash
eas build --profile development --platform android      # for daily dev
eas build --profile preview --platform all              # TestFlight / internal track
eas build --profile production --platform all           # store submission
```
