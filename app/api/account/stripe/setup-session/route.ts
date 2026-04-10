import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server-auth";
import { createSetupCheckoutSession, createStripeCustomer, isStripeConfigured } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 400 });
    }

    const user = await getUserFromRequest(request);

    if (!user.email_confirmed_at) {
      return NextResponse.json({
        error: "Please verify your email before saving a card or checking out.",
      }, { status: 403 });
    }

    const { data: existingCustomer, error: customerError } = await supabaseAdmin
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (customerError) {
      throw customerError;
    }

    let stripeCustomerId = existingCustomer?.stripe_customer_id || null;

    if (!stripeCustomerId) {
      const customer = await createStripeCustomer({
        email: user.email || "",
        name: String(user.user_metadata?.full_name || user.email || "CEAtlas Customer"),
        supabaseUserId: user.id,
      });

      stripeCustomerId = customer.id;

      const { error: insertError } = await supabaseAdmin
        .from("stripe_customers")
        .upsert({
          user_id: user.id,
          stripe_customer_id: stripeCustomerId,
          email: user.email || null,
        }, {
          onConflict: "user_id",
        });

      if (insertError) {
        throw insertError;
      }
    }

    const session = await createSetupCheckoutSession({
      stripeCustomerId,
    });

    return NextResponse.json({
      url: session.url || null,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to create setup session.",
    }, { status: 500 });
  }
}
