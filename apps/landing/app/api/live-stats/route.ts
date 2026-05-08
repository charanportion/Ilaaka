import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export type RecentClaim = {
  cells: number;
  created_at: string;
  color: string;
};

export type LandingStats = {
  km_claimed_week: number;
  walkers_week: number;
  recent_claims: RecentClaim[];
};

const EMPTY: LandingStats = {
  km_claimed_week: 0,
  walkers_week: 0,
  recent_claims: [],
};

const CACHE_HEADERS = {
  /* Edge/CDN holds the response for 30s, serves stale up to 60s while
     it refreshes in the background. The landing page polls every 60s,
     so a single Supabase round-trip per server-region per ~30s. */
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
} as const;

export async function GET() {
  const supa = getSupabase();
  if (!supa) {
    /* Supabase env not wired up — return empty so the LiveTicker
       hides itself rather than fabricating numbers. */
    return NextResponse.json(EMPTY, { headers: { "Cache-Control": "no-store" } });
  }

  const { data, error } = await supa.rpc("landing_stats");
  if (error || !data) {
    return NextResponse.json(EMPTY, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(data as LandingStats, { headers: CACHE_HEADERS });
}
