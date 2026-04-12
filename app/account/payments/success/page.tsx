"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

function PaymentSetupSuccessContent() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Finalizing your saved card...");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");

    async function syncPaymentMethod() {
      if (!sessionId) {
        setMessage("Missing checkout session. You can return to your account and try again.");
        return;
      }

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setMessage("You are not signed in. Return to your account and sign in again.");
        return;
      }

      const response = await fetch("/api/account/payments/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error || "Unable to sync your saved card.");
        return;
      }

      setMessage("Card saved. Your CEAtlas account is ready for checkout and future travel purchases.");
    }

    syncPaymentMethod();
  }, [searchParams]);

  return (
    <div className="container">
      <section className="account-shell">
        <div className="card account-card">
          <p className="packages-builder__eyebrow">Stripe Setup</p>
          <h1>Payment method update</h1>
          <p>{message}</p>
          <div className="account-actions">
            <Link href="/account" className="travel-primary">Back to account</Link>
            <Link href="/travel" className="travel-secondary">Back to travel</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function PaymentSetupSuccessPage() {
  return (
    <Suspense fallback={
      <div className="container">
        <section className="account-shell">
          <div className="card account-card">
            <p className="packages-builder__eyebrow">Stripe Setup</p>
            <h1>Payment method update</h1>
            <p>Finalizing your saved card...</p>
          </div>
        </section>
      </div>
    }
    >
      <PaymentSetupSuccessContent />
    </Suspense>
  );
}
