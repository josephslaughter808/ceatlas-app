import { supabaseAdmin } from "@/lib/supabase-admin";

export async function getUserFromRequest(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new Error("Missing bearer token");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Invalid session");
  }

  return data.user;
}
