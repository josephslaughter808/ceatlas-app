import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { markTravelOrderAfterPayment } from "@/lib/travel/orders";
import { retrieveCheckoutSession, isStripeConfigured } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    const body = await request.json() as {
      orderId?: string;
      sessionId?: string;
    };

    const orderId = String(body.orderId || "");
    const sessionId = String(body.sessionId || "");

    if (!orderId || !sessionId) {
      return NextResponse.json({ error: "Missing orderId or sessionId." }, { status: 400 });
    }

    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 400 });
    }

    const session = await retrieveCheckoutSession(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment is not complete yet." }, { status: 400 });
    }

    await markTravelOrderAfterPayment({
      orderId,
      paymentIntentId: session.payment_intent || null,
      metadata: {
        checkout_session_id: sessionId,
        booking_status: "pending_supplier_booking",
        provider_references: [],
        booking_notes: [
          "Payment captured by CEAtlas.",
          "Supplier booking orchestration is ready, but live supplier credentials and traveler details must be completed before final confirmation.",
        ],
      },
    });

    await supabaseAdmin
      .from("travel_order_items")
      .update({
        metadata: {
          booking_status: "pending_supplier_booking",
          booking_reference: null,
          sync_message: "Awaiting live supplier booking implementation or provider access.",
        },
      })
      .eq("order_id", orderId);

    const { data: order } = await supabaseAdmin
      .from("travel_orders")
      .select("id, status, destination, starts_on, ends_on, total_amount, service_fee_amount, currency, metadata, created_at")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to finalize travel order.",
    }, { status: 500 });
  }
}
