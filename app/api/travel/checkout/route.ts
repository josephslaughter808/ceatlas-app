import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkoutDraftFromItinerary, markTravelOrderPendingCheckout } from "@/lib/travel/orders";
import type { TravelItineraryDraft, TravelSearchResponse } from "@/lib/travel/providers/types";
import { createPaymentCheckoutSession, createStripeCustomer, isStripeConfigured } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    const body = await request.json() as {
      itinerary?: TravelItineraryDraft;
      providers?: TravelSearchResponse["providers"];
    };

    if (!body.itinerary?.id) {
      return NextResponse.json({ error: "Missing itinerary." }, { status: 400 });
    }

    const itinerary = body.itinerary;
    const providers = body.providers || {
      flights: { provider: "Unknown", configured: false, mode: "disabled", message: null },
      hotels: { provider: "Unknown", configured: false, mode: "disabled", message: null },
      cars: { provider: "Unknown", configured: false, mode: "disabled", message: null },
    };

    let stripeCheckoutUrl: string | null = null;

    if (isStripeConfigured()) {
      const { data: existingCustomer } = await supabaseAdmin
        .from("stripe_customers")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();

      let stripeCustomerId = existingCustomer?.stripe_customer_id || null;

      if (!stripeCustomerId) {
        const customer = await createStripeCustomer({
          email: user.email || "",
          name: String(user.user_metadata?.full_name || user.email || "CEAtlas Customer"),
          supabaseUserId: user.id,
        });

        stripeCustomerId = customer.id;

        await supabaseAdmin
          .from("stripe_customers")
          .upsert({
            user_id: user.id,
            stripe_customer_id: stripeCustomerId,
            email: user.email || null,
          }, {
            onConflict: "user_id",
          });
      }

      const session = await createPaymentCheckoutSession({
        stripeCustomerId,
        orderId: itinerary.id,
        description: `${itinerary.destination} CEAtlas travel booking`,
        currency: itinerary.priceBreakdown.currency,
        amount: itinerary.priceBreakdown.total,
      });

      stripeCheckoutUrl = session.url || null;
      await markTravelOrderPendingCheckout(itinerary.id, session.id);
    }

    return NextResponse.json({
      checkout: checkoutDraftFromItinerary({
        itinerary,
        stripeCheckoutUrl,
        providers,
      }),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to prepare checkout.",
    }, { status: 500 });
  }
}
