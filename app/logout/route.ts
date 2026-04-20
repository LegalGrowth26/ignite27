import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

async function signOutAndRedirect() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const siteUrl = env.siteUrl().replace(/\/$/, "");
  return NextResponse.redirect(`${siteUrl}/`);
}

export async function POST() {
  return signOutAndRedirect();
}

export async function GET() {
  return signOutAndRedirect();
}
