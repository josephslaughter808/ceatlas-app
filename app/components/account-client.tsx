"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./auth-provider";
import StateRequirementsPanel from "./state-requirements-panel";
import {
  PRACTICE_STATES,
  getPracticeStateName,
  normalizePracticeStateCode,
} from "@/lib/practice-states";

const HOME_AIRPORT_STORAGE_KEY = "ceatlas:home-airport";

type PaymentMethodRecord = {
  id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean | null;
};

type TravelOrderRecord = {
  id: string;
  status: string | null;
  destination: string | null;
  starts_on: string | null;
  ends_on: string | null;
  total_amount: number | null;
  service_fee_amount: number | null;
  currency: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ProviderLinkRecord = {
  id: string;
  provider_key: string;
  provider_name: string;
  login_label: string | null;
  username_hint: string | null;
  status: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata: Record<string, unknown>;
};

type SupportedProviderRecord = {
  key: string;
  name: string;
  description: string;
  loginUrl: string;
  loginType: "email_or_username";
  status: "available" | "planned";
};

type ProfileRecord = {
  full_name: string | null;
  state_of_practice: string | null;
};

export default function AccountClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [homeAirport, setHomeAirport] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [cardsBusy, setCardsBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRecord[]>([]);
  const [orders, setOrders] = useState<TravelOrderRecord[]>([]);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [stateOfPractice, setStateOfPractice] = useState("");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [travelerLegalName, setTravelerLegalName] = useState("");
  const [travelerPhone, setTravelerPhone] = useState("");
  const [travelerBirthDate, setTravelerBirthDate] = useState("");
  const [providerLinks, setProviderLinks] = useState<ProviderLinkRecord[]>([]);
  const [supportedProviders, setSupportedProviders] = useState<SupportedProviderRecord[]>([]);
  const [providerKey, setProviderKey] = useState("adha");
  const [providerLogin, setProviderLogin] = useState("");
  const [providerPassword, setProviderPassword] = useState("");
  const [providerLabel, setProviderLabel] = useState("");
  const [providerBusy, setProviderBusy] = useState(false);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const siteUrl = useMemo(() => (
    (process.env.NEXT_PUBLIC_SITE_URL || "https://ceatlas.co").replace(/\/$/, "")
  ), []);
  const returnTo = useMemo(() => {
    const candidate = searchParams.get("returnTo");
    return candidate && candidate.startsWith("/") ? candidate : null;
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const requestedMode = searchParams.get("mode");
    if (requestedMode === "signup" || requestedMode === "signin") {
      setMode(requestedMode);
    }

    if (searchParams.get("verified") === "1") {
      setMode("signin");
      setAuthMessage("Email verified. You can sign in and keep testing CEAtlas.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(HOME_AIRPORT_STORAGE_KEY);
    if (stored && !homeAirport) {
      setHomeAirport(stored);
    }
  }, [homeAirport]);

  useEffect(() => {
    if (!session) {
      setPaymentMethods([]);
      setOrders([]);
      setProfile(null);
      setStateOfPractice("");
      setProviderLinks([]);
      return;
    }

    const activeSession = session;

    async function loadAccountData() {
      const [cardsResponse, ordersResponse, profileResponse, providerResponse] = await Promise.all([
        supabase
          .from("payment_methods")
          .select("id, brand, last4, exp_month, exp_year, is_default")
          .order("created_at", { ascending: false }),
        supabase
          .from("travel_orders")
          .select("id, status, destination, starts_on, ends_on, total_amount, service_fee_amount, currency, metadata, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("full_name, state_of_practice")
          .maybeSingle(),
        fetch("/api/account/provider-links", {
          headers: {
            Authorization: `Bearer ${activeSession.access_token}`,
          },
        }),
      ]);

      const { data: cards } = cardsResponse;
      const { data: travelOrders } = ordersResponse;
      const { data: profileRow } = profileResponse;
      const providerData = await providerResponse.json().catch(() => null);

      setPaymentMethods(cards || []);
      setOrders(travelOrders || []);
      setProfile(profileRow || null);
      setFullName(profileRow?.full_name || user?.user_metadata?.full_name || "");
      setStateOfPractice(normalizePracticeStateCode(profileRow?.state_of_practice || user?.user_metadata?.state_of_practice));
      setHomeAirport(String(user?.user_metadata?.home_airport || window.localStorage.getItem(HOME_AIRPORT_STORAGE_KEY) || ""));
      setTravelerLegalName(String(user?.user_metadata?.traveler_legal_name || profileRow?.full_name || user?.user_metadata?.full_name || ""));
      setTravelerPhone(String(user?.user_metadata?.traveler_phone || ""));
      setTravelerBirthDate(String(user?.user_metadata?.traveler_birth_date || ""));
      setProviderLinks(providerData?.links || []);
      setSupportedProviders(providerData?.supportedProviders || []);
    }

    loadAccountData();
  }, [session, user?.user_metadata?.full_name, user?.user_metadata?.state_of_practice, user?.user_metadata?.home_airport]);

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage(null);

    try {
      if (mode === "signup") {
        const emailRedirectTo = `${siteUrl}/account?verified=1`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo,
            data: {
              full_name: fullName,
              state_of_practice: normalizePracticeStateCode(stateOfPractice) || null,
              home_airport: homeAirport.trim().toUpperCase() || null,
              traveler_legal_name: fullName.trim() || null,
            },
          },
        });

        if (error) throw error;
        if (data.session) {
          setAuthMessage("Account created. Welcome to CEAtlas.");
        } else {
          setAuthMessage("Account created. Check your email when you are ready to verify before checkout.");
        }
        router.push(returnTo || "/courses?account=created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        setAuthMessage("Signed in.");
        router.push(returnTo || "/account");
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Unable to complete authentication.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSaveCard() {
    if (!session?.access_token) return;
    if (!user?.email_confirmed_at) {
      setAuthMessage("Please verify your email before saving a card or checking out.");
      return;
    }

    setCardsBusy(true);
    setAuthMessage(null);

    try {
      const response = await fetch("/api/account/stripe/setup-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Unable to create Stripe setup session.");
      }

      window.location.href = data.url;
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Unable to launch Stripe card setup.");
      setCardsBusy(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) return;

    setProfileBusy(true);
    setProfileMessage(null);

    try {
      const nextState = normalizePracticeStateCode(stateOfPractice) || null;
      const nextName = fullName.trim() || null;
      const nextHomeAirport = homeAirport.trim().toUpperCase() || null;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: nextName,
          state_of_practice: nextState,
        })
        .eq("id", user.id);

      if (error) throw error;

      await supabase.auth.updateUser({
        data: {
          full_name: nextName,
          state_of_practice: nextState,
          home_airport: nextHomeAirport,
          traveler_legal_name: travelerLegalName.trim() || null,
          traveler_phone: travelerPhone.trim() || null,
          traveler_birth_date: travelerBirthDate || null,
        },
      });

      if (typeof window !== "undefined") {
        if (nextHomeAirport) {
          window.localStorage.setItem(HOME_AIRPORT_STORAGE_KEY, nextHomeAirport);
        } else {
          window.localStorage.removeItem(HOME_AIRPORT_STORAGE_KEY);
        }
      }

      setProfile((current) => ({
        full_name: nextName ?? current?.full_name ?? null,
        state_of_practice: nextState,
      }));
      setProfileMessage("Practice profile updated.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Unable to update your practice profile.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function refreshProviderLinks() {
    if (!session?.access_token) return;

    const response = await fetch("/api/account/provider-links", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to load provider links.");
    }

    setProviderLinks(data.links || []);
    setSupportedProviders(data.supportedProviders || []);
  }

  async function handleProviderConnect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) return;

    setProviderBusy(true);
    setProviderMessage(null);

    try {
      const response = await fetch("/api/account/provider-links", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          providerKey,
          login: providerLogin,
          password: providerPassword,
          label: providerLabel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to connect provider account.");
      }

      setProviderLogin("");
      setProviderPassword("");
      setProviderLabel("");
      setProviderMessage("Provider account connected. The secure storage layer is ready for user-scoped sync.");
      await refreshProviderLinks();
    } catch (error) {
      setProviderMessage(error instanceof Error ? error.message : "Unable to connect provider account.");
    } finally {
      setProviderBusy(false);
    }
  }

  async function handleProviderDisconnect(id: string) {
    if (!session?.access_token) return;

    setProviderBusy(true);
    setProviderMessage(null);

    try {
      const response = await fetch(`/api/account/provider-links/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to disconnect provider account.");
      }

      setProviderMessage("Provider account removed.");
      await refreshProviderLinks();
    } catch (error) {
      setProviderMessage(error instanceof Error ? error.message : "Unable to disconnect provider account.");
    } finally {
      setProviderBusy(false);
    }
  }

  const availableProviders = supportedProviders.filter((provider) => provider.status === "available");
  const plannedProviders = supportedProviders.filter((provider) => provider.status === "planned");
  const profileStateName = useMemo(
    () => getPracticeStateName(stateOfPractice || profile?.state_of_practice),
    [profile?.state_of_practice, stateOfPractice],
  );

  return (
    <div className="account-shell">
      <section className="page-header">
        <h1>Account & Checkout</h1>
        <p>
          Create an account, save a card with Stripe, and keep a clean record of CEAtlas travel purchases as checkout comes online.
        </p>
      </section>

      {!user ? (
        <section className="account-grid">
          <div className="card account-card">
            <div className="account-card__head">
              <div>
                <p className="packages-builder__eyebrow">Membership</p>
                <h2>{mode === "signup" ? "Create your account" : "Sign in"}</h2>
              </div>
              <button
                type="button"
                className="account-toggle"
                onClick={() => {
                  const nextMode = mode === "signup" ? "signin" : "signup";
                  setMode(nextMode);
                  router.replace(`/account?mode=${nextMode}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`);
                }}
              >
                {mode === "signup" ? "I already have an account" : "I need an account"}
              </button>
            </div>

            <form className="account-form" onSubmit={handleAuthSubmit}>
              {mode === "signup" ? (
                <>
                  <label>
                    <span>Full name</span>
                    <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
                  </label>

                  <label>
                    <span>State of practice</span>
                    <select value={stateOfPractice} onChange={(event) => setStateOfPractice(event.target.value)}>
                      <option value="">Select your state</option>
                      {PRACTICE_STATES.map((state) => (
                        <option key={state.code} value={state.code}>{state.name}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Home airport</span>
                    <input value={homeAirport} onChange={(event) => setHomeAirport(event.target.value.toUpperCase())} placeholder="DFW" maxLength={5} />
                  </label>
                </>
              ) : null}

              <label>
                <span>Email</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>

              <label>
                <span>Password</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </label>

              <button className="travel-primary" type="submit" disabled={authBusy || loading}>
                {authBusy ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>

            {authMessage ? <p className="account-message">{authMessage}</p> : null}
            <p className="account-helper">
              You will stay signed in on this device so you can come back to your courses, cart, travel planner, and checkout without restarting every time.
            </p>
          </div>

          <div className="card account-card account-card--highlight">
            <p className="packages-builder__eyebrow">Why this matters</p>
            <h2>Accounts are the foundation for real checkout.</h2>
            <p>We need a signed-in user before we can save cards with Stripe, keep purchase records, and attach future bookings to a CEAtlas traveler profile.</p>
            <div className="account-checklist">
              <span>Saved cards are stored by Stripe, not by us</span>
              <span>Purchase history will live in your CEAtlas account</span>
              <span>Upcoming trip checkout will build on this same profile</span>
              <span>Member-only CE catalogs unlock through your own linked provider accounts</span>
            </div>
          </div>
        </section>
      ) : (
        <section className="account-grid">
          <div className="card account-card">
            <div className="account-card__head">
              <div>
                <p className="packages-builder__eyebrow">Traveler Profile</p>
                <h2>{user.user_metadata?.full_name || user.email}</h2>
              </div>
              <button type="button" className="account-toggle" onClick={handleSignOut}>
                Sign out
              </button>
            </div>

            <div className="account-summary">
              <div>
                <strong>{paymentMethods.length}</strong>
                <span>Saved payment methods</span>
              </div>
              <div>
                <strong>{orders.length}</strong>
                <span>Recorded travel purchases</span>
              </div>
              <div>
                <strong>{providerLinks.length}</strong>
                <span>Linked CE provider accounts</span>
              </div>
              <div>
                <strong>{profileStateName ? "1" : "0"}</strong>
                <span>{profileStateName ? `${profileStateName} practice profile` : "Practice state not set"}</span>
              </div>
            </div>

            <div className="account-actions">
              <button type="button" className="travel-primary" onClick={handleSaveCard} disabled={cardsBusy}>
                {cardsBusy ? "Launching Stripe..." : "Save a card with Stripe"}
              </button>
              <Link href="/travel" className="travel-secondary">Open travel planner</Link>
            </div>

            {authMessage ? <p className="account-message">{authMessage}</p> : null}
          </div>

          <div className="card account-card">
            <div className="account-card__head">
              <div>
                <p className="packages-builder__eyebrow">Practice Profile</p>
                <h2>State of practice</h2>
              </div>
            </div>

            <form className="account-form" onSubmit={handleProfileSave}>
              <label>
                <span>Full name</span>
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </label>

              <label>
                <span>State of practice</span>
                <select value={stateOfPractice} onChange={(event) => setStateOfPractice(event.target.value)}>
                  <option value="">Select your state</option>
                  {PRACTICE_STATES.map((state) => (
                    <option key={state.code} value={state.code}>{state.name}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Home airport</span>
                <input value={homeAirport} onChange={(event) => setHomeAirport(event.target.value.toUpperCase())} placeholder="DFW" maxLength={5} />
              </label>

              <div className="account-actions">
                <button type="submit" className="travel-primary" disabled={profileBusy}>
                  {profileBusy ? "Saving..." : "Save practice profile"}
                </button>
              </div>
            </form>

            {profileMessage ? <p className="account-message">{profileMessage}</p> : null}

            <StateRequirementsPanel
              stateCode={stateOfPractice || profile?.state_of_practice}
              signedIn
              compact
            />
          </div>

          <div className="card account-card">
            <div className="account-card__head">
              <div>
                <p className="packages-builder__eyebrow">Booking Readiness</p>
                <h2>Traveler details</h2>
              </div>
            </div>

            <form className="account-form" onSubmit={handleProfileSave}>
              <label>
                <span>Legal traveler name</span>
                <input value={travelerLegalName} onChange={(event) => setTravelerLegalName(event.target.value)} placeholder="As it appears on ID" />
              </label>

              <label>
                <span>Phone number</span>
                <input value={travelerPhone} onChange={(event) => setTravelerPhone(event.target.value)} placeholder="(555) 555-5555" />
              </label>

              <label>
                <span>Date of birth</span>
                <input type="date" value={travelerBirthDate} onChange={(event) => setTravelerBirthDate(event.target.value)} />
              </label>

              <div className="account-chip-row">
                <span className="account-chip">{user.email_confirmed_at ? "Email verified" : "Email not verified"}</span>
                <span className="account-chip">{paymentMethods.length > 0 ? "Card saved" : "No saved card"}</span>
                <span className="account-chip">{travelerLegalName && travelerBirthDate ? "Traveler profile ready" : "Traveler profile incomplete"}</span>
              </div>

              <div className="account-actions">
                <button type="submit" className="travel-primary" disabled={profileBusy}>
                  {profileBusy ? "Saving..." : "Save traveler details"}
                </button>
              </div>
            </form>

            <p className="account-helper">
              These details prepare CEAtlas for real supplier booking once live hotel, car, and flight approvals are active.
            </p>
          </div>

          <div className="card account-card">
            <p className="packages-builder__eyebrow">Locked Catalogs</p>
            <h2>Provider connections</h2>
            <p className="account-helper">
              Link your own member or paid-provider accounts so CEAtlas can unlock login-blocked catalogs without sharing one global account across users.
            </p>

            {availableProviders.length > 0 ? (
              <form className="account-form" onSubmit={handleProviderConnect}>
                <label>
                  <span>Provider</span>
                  <select value={providerKey} onChange={(event) => setProviderKey(event.target.value)}>
                    {availableProviders.map((provider) => (
                      <option key={provider.key} value={provider.key}>{provider.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Provider login</span>
                  <input
                    value={providerLogin}
                    onChange={(event) => setProviderLogin(event.target.value)}
                    placeholder="Email or username"
                    required
                  />
                </label>

                <label>
                  <span>Provider password</span>
                  <input
                    type="password"
                    value={providerPassword}
                    onChange={(event) => setProviderPassword(event.target.value)}
                    placeholder="Password"
                    required
                  />
                </label>

                <label>
                  <span>Label (optional)</span>
                  <input
                    value={providerLabel}
                    onChange={(event) => setProviderLabel(event.target.value)}
                    placeholder="Work membership or personal login"
                  />
                </label>

                <div className="account-actions">
                  <button type="submit" className="travel-primary" disabled={providerBusy}>
                    {providerBusy ? "Connecting..." : "Connect provider"}
                  </button>
                  <a className="travel-secondary" href={availableProviders.find((provider) => provider.key === providerKey)?.loginUrl || "/account"} target="_blank" rel="noreferrer">
                    Open provider login
                  </a>
                </div>
              </form>
            ) : null}

            {providerMessage ? <p className="account-message">{providerMessage}</p> : null}

            {providerLinks.length === 0 ? (
              <p>No linked provider accounts yet. Start with ADHA so we can unlock CE Smart for the signed-in dentist who owns that membership.</p>
            ) : (
              <div className="account-list">
                {providerLinks.map((link) => (
                  <div key={link.id} className="account-list__item">
                    <strong>{link.provider_name}</strong>
                    <span>{link.login_label || link.username_hint || "Credential connected"}</span>
                    <span>Status: {link.status || "connected"}{link.last_synced_at ? ` • last synced ${new Date(link.last_synced_at).toLocaleString()}` : ""}</span>
                    {link.last_error ? <span>Last issue: {link.last_error}</span> : null}
                    <div className="account-actions">
                      <button type="button" className="travel-secondary" onClick={() => handleProviderDisconnect(link.id)} disabled={providerBusy}>
                        Disconnect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {plannedProviders.length > 0 ? (
              <>
                <p className="packages-builder__eyebrow">Queued next</p>
                <div className="account-chip-row">
                  {plannedProviders.map((provider) => (
                    <span key={provider.key} className="account-chip">{provider.name}</span>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className="card account-card">
            <p className="packages-builder__eyebrow">Saved Cards</p>
            <h2>Billing methods</h2>
            {paymentMethods.length === 0 ? (
              <p>No saved cards yet. Add one through Stripe so checkout is ready when travel booking goes live.</p>
            ) : (
              <div className="account-list">
                {paymentMethods.map((method) => (
                  <div key={method.id} className="account-list__item">
                    <strong>{method.brand ? method.brand.toUpperCase() : "Card"} •••• {method.last4 || "----"}</strong>
                    <span>{method.exp_month || "--"}/{method.exp_year || "----"} {method.is_default ? "• Default" : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card account-card account-card--wide">
            <p className="packages-builder__eyebrow">Purchase History</p>
            <h2>Previous purchases</h2>
            {orders.length === 0 ? (
              <p>No travel purchases yet. Once checkout is connected, every completed order will appear here with totals and service fees.</p>
            ) : (
              <div className="account-list">
                {orders.map((order) => (
                  <div key={order.id} className="account-list__item">
                    <strong>{order.destination || "Trip purchase"}</strong>
                    <span>
                      {order.starts_on || "Date pending"} {order.ends_on ? `to ${order.ends_on}` : ""}
                    </span>
                    <span>
                      {order.currency || "USD"} {order.total_amount?.toFixed(2) || "0.00"} total
                      {order.service_fee_amount ? ` • fee ${order.service_fee_amount.toFixed(2)}` : ""}
                    </span>
                    <span>{order.status || "pending"}</span>
                    {Array.isArray(order.metadata?.booking_notes) ? (
                      <span>{String((order.metadata?.booking_notes as string[])[0] || "")}</span>
                    ) : null}
                    {Array.isArray(order.metadata?.provider_references) && (order.metadata?.provider_references as unknown[]).length > 0 ? (
                      <span>Refs: {(order.metadata?.provider_references as string[]).join(" • ")}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
