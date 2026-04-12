"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function TravelCheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Finalizing your CEAtlas travel order...");

  useEffect(() => {
    const orderId = searchParams.get("order_id");
    const sessionId = searchParams.get("session_id");

    async function finalizeOrder() {
      if (!orderId || !sessionId) {
        setMessage("Missing travel checkout details. Return to the travel planner and try again.");
        return;
      }

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setMessage("You are not signed in. Return to your account and sign in again.");
        return;
      }

      const response = await fetch("/api/travel/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ orderId, sessionId }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Unable to finalize your travel order.");
        return;
      }

      setMessage("Payment captured. Your CEAtlas travel order is recorded and supplier booking is queued.");
    }

    finalizeOrder();
  }, [searchParams]);

  return (
    <div className="container">
      <section className="account-shell">
        <div className="card account-card">
          <p className="packages-builder__eyebrow">Travel Checkout</p>
          <h1>Travel order update</h1>
          <p>{message}</p>
          <div className="account-actions">
            <Link href="/travel" className="travel-primary">Back to travel</Link>
            <Link href="/account" className="travel-secondary">View account</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function TravelCheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="container"><section className="account-shell"><div className="card account-card"><p>Finalizing your CEAtlas travel order...</p></div></section></div>}>
      <TravelCheckoutSuccessContent />
    </Suspense>
  );
}
