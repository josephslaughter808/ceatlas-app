const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type StripeCustomer = {
  id: string;
  email?: string | null;
  name?: string | null;
};

type StripeCheckoutSession = {
  id: string;
  url?: string | null;
  customer?: string | null;
  payment_status?: string | null;
  status?: string | null;
  metadata?: Record<string, string>;
  amount_total?: number | null;
  payment_intent?: string | null;
  setup_intent?: string | {
    id?: string;
    payment_method?: string | {
      id?: string;
      card?: {
        brand?: string;
        last4?: string;
        exp_month?: number;
        exp_year?: number;
      };
      customer?: string | null;
      type?: string | null;
    } | null;
  } | null;
};

function toFormBody(params: Record<string, string>) {
  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    body.set(key, value);
  }

  return body;
}

async function stripeRequest<T>(path: string, init?: RequestInit) {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stripe request failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<T>;
}

export function isStripeConfigured() {
  return Boolean(STRIPE_SECRET_KEY);
}

export async function createStripeCustomer({
  email,
  name,
  supabaseUserId,
}: {
  email: string;
  name: string;
  supabaseUserId: string;
}) {
  return stripeRequest<StripeCustomer>("/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: toFormBody({
      email,
      name,
      "metadata[supabase_user_id]": supabaseUserId,
    }),
  });
}

export async function createSetupCheckoutSession({
  stripeCustomerId,
}: {
  stripeCustomerId: string;
}) {
  return stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: toFormBody({
      mode: "setup",
      customer: stripeCustomerId,
      success_url: `${SITE_URL}/account/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/account`,
    }),
  });
}

export async function createPaymentCheckoutSession({
  stripeCustomerId,
  orderId,
  description,
  currency,
  amount,
}: {
  stripeCustomerId: string;
  orderId: string;
  description: string;
  currency: string;
  amount: number;
}) {
  const normalizedAmount = Math.max(1, Math.round(amount * 100));

  return stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: toFormBody({
      mode: "payment",
      customer: stripeCustomerId,
      "metadata[travel_order_id]": orderId,
      "line_items[0][price_data][currency]": currency.toLowerCase(),
      "line_items[0][price_data][product_data][name]": description,
      "line_items[0][price_data][unit_amount]": String(normalizedAmount),
      "line_items[0][quantity]": "1",
      success_url: `${SITE_URL}/travel/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${SITE_URL}/travel`,
    }),
  });
}

export async function retrieveCheckoutSession(sessionId: string) {
  const params = new URLSearchParams({
    expand: ["setup_intent", "setup_intent.payment_method"].join(","),
  });

  return stripeRequest<StripeCheckoutSession>(`/checkout/sessions/${sessionId}?${params.toString()}`);
}
