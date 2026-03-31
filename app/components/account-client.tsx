"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./auth-provider";

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
  created_at: string;
};

export default function AccountClient() {
  const { user, session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [cardsBusy, setCardsBusy] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRecord[]>([]);
  const [orders, setOrders] = useState<TravelOrderRecord[]>([]);

  useEffect(() => {
    if (!session) {
      setPaymentMethods([]);
      setOrders([]);
      return;
    }

    async function loadAccountData() {
      const [{ data: cards }, { data: travelOrders }] = await Promise.all([
        supabase
          .from("payment_methods")
          .select("id, brand, last4, exp_month, exp_year, is_default")
          .order("created_at", { ascending: false }),
        supabase
          .from("travel_orders")
          .select("id, status, destination, starts_on, ends_on, total_amount, service_fee_amount, currency, created_at")
          .order("created_at", { ascending: false }),
      ]);

      setPaymentMethods(cards || []);
      setOrders(travelOrders || []);
    }

    loadAccountData();
  }, [session]);

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage(null);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;
        setAuthMessage("Account created. If Supabase email confirmation is enabled, check your inbox before signing in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        setAuthMessage("Signed in.");
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Unable to complete authentication.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSaveCard() {
    if (!session?.access_token) return;

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
                onClick={() => setMode((current) => current === "signup" ? "signin" : "signup")}
              >
                {mode === "signup" ? "I already have an account" : "I need an account"}
              </button>
            </div>

            <form className="account-form" onSubmit={handleAuthSubmit}>
              {mode === "signup" ? (
                <label>
                  <span>Full name</span>
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
                </label>
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
          </div>

          <div className="card account-card account-card--highlight">
            <p className="packages-builder__eyebrow">Why this matters</p>
            <h2>Accounts are the foundation for real checkout.</h2>
            <p>We need a signed-in user before we can save cards with Stripe, keep purchase records, and attach future bookings to a CEAtlas traveler profile.</p>
            <div className="account-checklist">
              <span>Saved cards are stored by Stripe, not by us</span>
              <span>Purchase history will live in your CEAtlas account</span>
              <span>Upcoming trip checkout will build on this same profile</span>
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
