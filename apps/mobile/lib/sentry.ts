import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Strip GPS / PII out of an arbitrary record. Defensive — the dependent libs
// shouldn't be putting these in events, but if any future code accidentally
// includes them we don't want them flowing to Sentry.
const PII_KEYS = new Set(['lat', 'lng', 'latitude', 'longitude', 'coords', 'coordinates', 'email', 'phone']);
const COORD_REGEX = /\b-?\d{1,3}\.\d{4,}\s*,?\s*-?\d{1,3}\.\d{4,}\b/;

function scrubObject<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (PII_KEYS.has(key.toLowerCase())) {
      (obj as Record<string, unknown>)[key] = '[scrubbed]';
    } else {
      const v = (obj as Record<string, unknown>)[key];
      if (v && typeof v === 'object') scrubObject(v);
    }
  }
  return obj;
}

export function initSentry() {
  if (isExpoGo) return; // Expo Go has no native Sentry TurboModule — skip entirely
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  // Lazy require keeps the top-level module graph free of native references,
  // which is what causes the TurboModule crash in Expo Go on new arch.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require('@sentry/react-native');
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
    // Drop email + lat/lng from breadcrumbs and event bodies. CLAUDE.md hard
    // rule: "No raw GPS in logs. Sentry, console, PostHog — none of them."
    beforeBreadcrumb(crumb: { message?: string; data?: Record<string, unknown> | null } | null) {
      if (!crumb) return crumb;
      if (typeof crumb.message === 'string' && COORD_REGEX.test(crumb.message)) {
        crumb.message = '[breadcrumb-scrubbed: contained coordinate-like text]';
      }
      if (crumb.data) scrubObject(crumb.data);
      return crumb;
    },
    beforeSend(evt: { user?: Record<string, unknown> | null; extra?: Record<string, unknown> | null; contexts?: Record<string, unknown> | null; breadcrumbs?: { message?: string }[] }) {
      // Drop PII on the user object — Sentry auto-fills email when default PII
      // is enabled; we explicitly opt out, but be paranoid.
      if (evt.user) {
        delete evt.user.email;
        delete evt.user.username;
        delete evt.user.ip_address;
      }
      if (evt.extra) scrubObject(evt.extra);
      if (evt.contexts) scrubObject(evt.contexts);
      // Filter coordinate-shaped breadcrumbs even if they slipped past beforeBreadcrumb.
      if (Array.isArray(evt.breadcrumbs)) {
        evt.breadcrumbs = evt.breadcrumbs.filter(
          (b) => !(typeof b?.message === 'string' && COORD_REGEX.test(b.message)),
        );
      }
      return evt;
    },
  });
}
