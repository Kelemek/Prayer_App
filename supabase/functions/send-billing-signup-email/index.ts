import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

function applyTemplateVariables(content: string, variables: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(placeholder, value || '');
  }
  return result;
}

function formatInviteExpiry(expiresAt: string): string {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return expiresAt;
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatStripePrice(price: {
  unit_amount?: number | null;
  currency?: string | null;
  recurring?: { interval?: string | null; interval_count?: number | null } | null;
}): string | null {
  if (price.unit_amount == null || !Number.isFinite(price.unit_amount)) {
    return null;
  }
  const amount = price.unit_amount / 100;
  const currency = (price.currency ?? 'usd').toUpperCase();
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
  const interval = price.recurring?.interval;
  const count = price.recurring?.interval_count ?? 1;
  if (!interval) {
    return formatted;
  }
  if (count === 1) {
    return `${formatted}/${interval}`;
  }
  return `${formatted} every ${count} ${interval}s`;
}

function churchFallbackHtml(vars: Record<string, string>): string {
  return `<p>Hi ${vars.recipientEmail},</p>
<p>You asked the Prayer App to email this link so you can finish Church setup in a browser. This is not a newsletter.</p>
<p>Church plan: <strong>${vars.pricing_display}</strong>. This link expires on ${vars.expiresAt}.</p>
<p><a href="${vars.web_url}">${vars.web_url}</a></p>
<p>Prayer App sent this because you tapped Email me a link to set up.</p>`;
}

function proFallbackHtml(vars: Record<string, string>): string {
  return `<p>Hi ${vars.recipientEmail},</p>
<p>You asked the Prayer App to email this link so you can finish Pro setup in a browser. This is not a newsletter.</p>
<p>Pro plan: <strong>${vars.pricing_display}</strong>. This link expires on ${vars.expiresAt}.</p>
<p><a href="${vars.web_url}">${vars.web_url}</a></p>
<p>Prayer App sent this because you tapped Email me a link to set up.</p>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const appUrl = (Deno.env.get('APP_URL') ?? 'http://localhost:4200').replace(/\/+$/, '');
  const churchPriceId = Deno.env.get('STRIPE_CHURCH_PRICE_ID');
  const proPriceId = Deno.env.get('STRIPE_PRO_PRICE_ID');
  const churchPriceDisplay = Deno.env.get('STRIPE_CHURCH_PRICE_DISPLAY') ?? '';
  const proPriceDisplay = Deno.env.get('STRIPE_PRO_PRICE_DISPLAY') ?? '';

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Billing signup email is not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json().catch(() => ({}));
  const kind = body.kind === 'pro' ? 'pro' : body.kind === 'church' ? 'church' : '';
  if (!kind) {
    return new Response(JSON.stringify({ error: 'kind must be church or pro' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const email = userData.user.email.toLowerCase().trim();

  const { data: leadRaw, error: leadError } = await userClient.rpc('create_billing_signup_lead', {
    p_kind: kind,
  });
  if (leadError || !leadRaw) {
    return new Response(
      JSON.stringify({ error: leadError?.message || 'Failed to create signup link' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const lead = leadRaw as { token?: string; expires_at?: string; status?: string };
  const token = String(lead.token ?? '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Failed to create signup link' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const webUrl =
    kind === 'church'
      ? `${appUrl}/church-setup?signup_token=${encodeURIComponent(token)}`
      : `${appUrl}/?pro_signup_token=${encodeURIComponent(token)}`;
  const expiresAt = typeof lead.expires_at === 'string' ? lead.expires_at : new Date().toISOString();

  let pricingDisplay =
    kind === 'church' ? churchPriceDisplay.trim() : proPriceDisplay.trim();
  const priceId = kind === 'church' ? churchPriceId : proPriceId;
  if (stripeSecret && priceId) {
    try {
      const priceRes = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
        headers: { Authorization: `Bearer ${stripeSecret}` },
      });
      const price = await priceRes.json();
      if (priceRes.ok) {
        const formatted = formatStripePrice(price);
        if (formatted) {
          pricingDisplay = formatted;
        }
      }
    } catch (err) {
      console.error('[send-billing-signup-email] Stripe price lookup failed:', err);
    }
  }
  if (!pricingDisplay) {
    pricingDisplay = 'See pricing on the web';
  }

  const { data: defaultTenant } = await adminClient
    .from('tenants')
    .select('id')
    .eq('slug', 'default-tenant')
    .maybeSingle();

  const templateKey = kind === 'church' ? 'church_signup_web' : 'pro_signup_web';
  let subject =
    kind === 'church'
      ? 'Your Church setup link from Prayer App'
      : 'Your Pro setup link from Prayer App';
  const vars = {
    pricing_display: pricingDisplay,
    web_url: webUrl,
    expiresAt: formatInviteExpiry(expiresAt),
    recipientEmail: email,
  };
  let htmlBody = kind === 'church' ? churchFallbackHtml(vars) : proFallbackHtml(vars);
  let textBody =
    kind === 'church'
      ? `Your Church setup link from Prayer App\n\nYou asked the Prayer App to email this link so you can finish Church setup in a browser. This is not a newsletter.\n\n${webUrl}\n\nChurch plan: ${pricingDisplay}\nThis link expires on ${vars.expiresAt}.`
      : `Your Pro setup link from Prayer App\n\nYou asked the Prayer App to email this link so you can finish Pro setup in a browser. This is not a newsletter.\n\n${webUrl}\n\nPro plan: ${pricingDisplay}\nThis link expires on ${vars.expiresAt}.`;

  if (defaultTenant?.id) {
    const { data: template } = await adminClient
      .from('email_templates')
      .select('subject, html_body, text_body')
      .eq('tenant_id', defaultTenant.id)
      .eq('template_key', templateKey)
      .maybeSingle();
    if (template?.html_body) {
      subject = applyTemplateVariables(template.subject || subject, vars);
      htmlBody = applyTemplateVariables(template.html_body, vars);
      textBody = applyTemplateVariables(template.text_body || textBody, vars);
    }
  }

  const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: email,
      subject,
      htmlBody,
      textBody,
    }),
  });
  const sendPayload = await sendRes.json().catch(() => ({}));
  const emailed = sendRes.ok && sendPayload?.success !== false;

  return new Response(
    JSON.stringify({
      url: webUrl,
      token,
      emailed,
      error: emailed ? undefined : sendPayload?.error || 'Failed to send email',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
