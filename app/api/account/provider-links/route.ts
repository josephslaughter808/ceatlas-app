import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSupportedProviderConnection, SUPPORTED_PROVIDER_CONNECTIONS } from "@/lib/provider-connections";
import { encryptProviderSecret, maskProviderLogin } from "@/lib/provider-secrets";

function sanitizeLink(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    provider_key: String(row.provider_key || ""),
    provider_name: String(row.provider_name || ""),
    login_label: row.login_label ? String(row.login_label) : null,
    username_hint: row.username_hint ? String(row.username_hint) : null,
    status: row.status ? String(row.status) : null,
    last_synced_at: row.last_synced_at ? String(row.last_synced_at) : null,
    last_error: row.last_error ? String(row.last_error) : null,
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
    metadata: typeof row.metadata === "object" && row.metadata ? row.metadata : {},
  };
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    const { data, error } = await supabaseAdmin
      .from("linked_provider_accounts")
      .select("id, provider_key, provider_name, login_label, username_hint, status, last_synced_at, last_error, created_at, updated_at, metadata")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      links: (data || []).map((row) => sanitizeLink(row as unknown as Record<string, unknown>)),
      supportedProviders: SUPPORTED_PROVIDER_CONNECTIONS,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to load provider links.",
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    const body = await request.json() as {
      providerKey?: string;
      login?: string;
      password?: string;
      label?: string;
    };

    const providerKey = String(body.providerKey || "").trim().toLowerCase();
    const login = String(body.login || "").trim();
    const password = String(body.password || "").trim();
    const label = String(body.label || "").trim();

    const provider = getSupportedProviderConnection(providerKey);

    if (!provider) {
      return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
    }

    if (provider.status !== "available") {
      return NextResponse.json({ error: `${provider.name} linking is queued but not active yet.` }, { status: 400 });
    }

    if (!login || !password) {
      return NextResponse.json({ error: "Both login and password are required." }, { status: 400 });
    }

    const payload = {
      user_id: user.id,
      provider_key: provider.key,
      provider_name: provider.name,
      login_label: label || null,
      username_hint: maskProviderLogin(login),
      encrypted_username: encryptProviderSecret(login),
      encrypted_secret: encryptProviderSecret(password),
      status: "connected",
      last_error: null,
      metadata: {
        login_url: provider.loginUrl,
        login_type: provider.loginType,
        connection_source: "ceatlas-account",
      },
    };

    const { data, error } = await supabaseAdmin
      .from("linked_provider_accounts")
      .upsert(payload, { onConflict: "user_id,provider_key" })
      .select("id, provider_key, provider_name, login_label, username_hint, status, last_synced_at, last_error, created_at, updated_at, metadata")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      link: sanitizeLink(data as unknown as Record<string, unknown>),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to save provider link.",
    }, { status: 500 });
  }
}

