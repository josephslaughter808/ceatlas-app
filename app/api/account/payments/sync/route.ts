import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server-auth";
import { retrieveCheckoutSession, isStripeConfigured } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 400 });
    }

    const user = await getUserFromRequest(request);
    const body = await request.json() as { sessionId?: string };
    const sessionId = String(body.sessionId || "").trim();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
    }

    const session = await retrieveCheckoutSession(sessionId);
    const setupIntent = typeof session.setup_intent === "object" ? session.setup_intent : null;
    const paymentMethod = setupIntent && typeof setupIntent.payment_method === "object"
      ? setupIntent.payment_method
      : null;

    if (!paymentMethod?.id) {
      return NextResponse.json({ error: "No saved payment method found on this session." }, { status: 400 });
    }

    const { error: customerError } = await supabaseAdmin
      .from("stripe_customers")
      .upsert({
        user_id: user.id,
        stripe_customer_id: session.customer || paymentMethod.customer || null,
        email: user.email || null,
      }, {
        onConflict: "user_id",
      });

    if (customerError) {
      throw customerError;
    }

    const { error: paymentMethodError } = await supabaseAdmin
      .from("payment_methods")
      .upsert({
        user_id: user.id,
        stripe_payment_method_id: paymentMethod.id,
        stripe_customer_id: session.customer || paymentMethod.customer || null,
        brand: paymentMethod.card?.brand || null,
        last4: paymentMethod.card?.last4 || null,
        exp_month: paymentMethod.card?.exp_month || null,
        exp_year: paymentMethod.card?.exp_year || null,
        is_default: true,
      }, {
        onConflict: "stripe_payment_method_id",
      });

    if (paymentMethodError) {
      throw paymentMethodError;
    }

    await supabaseAdmin
      .from("payment_methods")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .neq("stripe_payment_method_id", paymentMethod.id);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to sync payment method.",
    }, { status: 500 });
  }
}
