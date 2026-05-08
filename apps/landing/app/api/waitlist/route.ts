import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";

const Body = z.object({
  email: z.string().trim().toLowerCase().email(),
  city: z.string().trim().max(80).optional(),
  context: z.enum([
    "ios_waitlist",
    "android_waitlist",
    "outside_hyderabad",
    "general",
  ]),
  source: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter a valid email." },
      { status: 400 },
    );
  }

  const supa = getSupabase();
  if (!supa) {
    /* No Supabase env configured yet — accept the submission so the UX
       still works in local dev / preview deploys without the secret. */
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[waitlist:dev]", parsed.data);
    }
    return NextResponse.json({ ok: true, dev: true });
  }

  const { error } = await supa.from("waitlist").insert({
    email: parsed.data.email,
    city: parsed.data.city ?? null,
    context: parsed.data.context,
    source: parsed.data.source ?? null,
  });

  /* Idempotent: unique(email, context) means a re-submission is fine. */
  if (error && !/duplicate key/i.test(error.message)) {
    return NextResponse.json(
      { error: "Couldn't save right now — try again in a moment." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
