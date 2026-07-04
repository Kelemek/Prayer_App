// @ts-nocheck - Deno Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Max-Age': '86400'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { email, code } = await req.json();
    const emailNormalized = (email || '').toLowerCase().trim();
    const codeNormalized = (code || '').trim();

    if (!emailNormalized || !/^\d{6}$/.test(codeNormalized)) {
      return new Response(JSON.stringify({
        error: 'Invalid verification code',
        details: 'Enter the 6-digit code'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: settings, error: settingsError } = await supabase
      .from('admin_settings')
      .select('test_account_email, test_account_code_6')
      .eq('id', 1)
      .maybeSingle();

    if (settingsError) {
      console.error('Failed to load admin_settings:', settingsError);
      return new Response(JSON.stringify({ error: 'Invalid verification code' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const testEmail = (settings?.test_account_email || '').trim().toLowerCase();
    const testCode = (settings?.test_account_code_6 || '').trim();

    if (!testEmail || emailNormalized !== testEmail || !testCode || codeNormalized !== testCode) {
      return new Response(JSON.stringify({ error: 'Invalid verification code' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { error: createError } = await supabase.auth.admin.createUser({
      email: emailNormalized,
      email_confirm: true
    });
    if (createError && !/already|exists|registered/i.test(createError.message)) {
      console.error('createUser failed:', createError);
      return new Response(JSON.stringify({ error: 'Invalid verification code' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: emailNormalized
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('generateLink failed:', linkError);
      return new Response(JSON.stringify({ error: 'Invalid verification code' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Notify admins (fire-and-forget)
    void notifyAdminsTestLogin(supabase, testEmail);

    return new Response(JSON.stringify({
      success: true,
      hashed_token: linkData.properties.hashed_token,
      email: emailNormalized
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('test-account-auth error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

async function notifyAdminsTestLogin(supabase, testAccountEmail) {
  try {
    const { data: admins } = await supabase
      .from('tenant_memberships')
      .select('user_email')
      .eq('role', 'tenant_admin')
      .eq('receive_admin_emails', true);

    const adminEmails = (admins || [])
      .map((a) => a.user_email)
      .filter(Boolean);

    if (adminEmails.length === 0) {
      return;
    }

    const subject = 'Test account logged into the prayer app';
    const htmlBody = `<p>The test account <strong>${testAccountEmail}</strong> was used to sign in to the prayer app.</p><p>Time: ${new Date().toISOString()}</p>`;
    const textBody = `The test account ${testAccountEmail} was used to sign in to the prayer app. Time: ${new Date().toISOString()}`;

    await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ to: adminEmails, subject, htmlBody, textBody })
    });
  } catch (err) {
    console.warn('Test account admin notification failed:', err);
  }
}
