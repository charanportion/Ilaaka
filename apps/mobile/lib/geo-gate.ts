/**
 * Hyderabad-only region gate. Pure functions — no side effects.
 *
 * Two signals decide whether a user is allowed in:
 * 1. GPS coordinates inside the Hyderabad metro bounding box.
 * 2. Free-form locality text containing a Hyderabad keyword.
 *
 * If GPS says yes → allowed (most authoritative).
 * If GPS says no → blocked (regardless of typed locality — easy to fake).
 * If GPS unavailable → fall back to the locality text.
 *
 * Be lenient with the bounding box; better to admit a couple of edge-of-
 * city users than to block someone whose GPS jittered to a neighbouring
 * district. The blocked screen has a "recheck" button anyway.
 */

/* Slightly generous bbox covering Hyderabad + Secunderabad + outer ORR.
   ~35 km radius around the city centroid (17.385, 78.4867). */
export const HYDERABAD_BBOX = {
  minLat: 17.18,
  maxLat: 17.62,
  minLng: 78.20,
  maxLng: 78.78,
} as const;

/* Lowercase-only. Substring match — we test `text.toLowerCase().includes(keyword)`. */
const HYDERABAD_KEYWORDS = [
  'hyderabad',
  'secunderabad',
  'cyberabad',
  'telangana',
  // big neighbourhoods / IT corridors
  'hitec city',
  'hi-tech city',
  'gachibowli',
  'madhapur',
  'kondapur',
  'banjara hills',
  'jubilee hills',
  'jubliee hills',     // common misspelling
  'kphb',
  'kukatpally',
  'ameerpet',
  'begumpet',
  'tarnaka',
  'mehdipatnam',
  'lb nagar',
  'l b nagar',
  'dilsukhnagar',
  'uppal',
  'miyapur',
  'manikonda',
  'shamshabad',
  'nallakunta',
  'malakpet',
  'tolichowki',
  'attapur',
  'kothapet',
  'kompally',
  'nizampet',
  'hayathnagar',
  'narsingi',
  'gandipet',
  'film nagar',
  'somajiguda',
  'masab tank',
  'panjagutta',
  'punjagutta',
  'abids',
  'koti',
  'charminar',
  'falaknuma',
  'medchal',
  'hmda',
  'shaikpet',
  'serilingampally',
];

export type RegionDecision = {
  status: 'allowed' | 'blocked';
  reason:
    | 'coords_inside_bbox'
    | 'coords_outside_bbox'
    | 'locality_match'
    | 'locality_no_match'
    | 'no_signals';
};

export function coordsInHyderabad(lat: number, lng: number): boolean {
  return (
    lat >= HYDERABAD_BBOX.minLat &&
    lat <= HYDERABAD_BBOX.maxLat &&
    lng >= HYDERABAD_BBOX.minLng &&
    lng <= HYDERABAD_BBOX.maxLng
  );
}

export function localityMatchesHyderabad(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return HYDERABAD_KEYWORDS.some((k) => t.includes(k));
}

/**
 * Decide whether a user passes the region gate.
 *
 * - GPS yes → allowed (authoritative).
 * - GPS no → blocked. Locality text can't override real coords.
 * - GPS missing → trust locality text. Fail closed if both are missing.
 */
export function decideRegion(input: {
  coords?: { lat: number; lng: number } | null;
  locality?: string | null;
}): RegionDecision {
  if (input.coords) {
    return coordsInHyderabad(input.coords.lat, input.coords.lng)
      ? { status: 'allowed', reason: 'coords_inside_bbox' }
      : { status: 'blocked', reason: 'coords_outside_bbox' };
  }
  if (input.locality && localityMatchesHyderabad(input.locality)) {
    return { status: 'allowed', reason: 'locality_match' };
  }
  if (input.locality && input.locality.trim().length > 0) {
    return { status: 'blocked', reason: 'locality_no_match' };
  }
  return { status: 'blocked', reason: 'no_signals' };
}
