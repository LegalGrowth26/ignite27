import type { NavItem } from "@/components/nav-items";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

// Session-aware account nav: "Login" for anonymous visitors, "Account"
// once a session exists. Never throws; any failure falls back to Login.
// Fixes the nav showing "Login" to signed-in users (seen on /account).
export async function resolveAccountNav(): Promise<readonly NavItem[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return [{ href: "/login", label: "Login" }];
    }
    return [{ href: "/account", label: "Account" }];
  } catch {
    return [{ href: "/login", label: "Login" }];
  }
}
