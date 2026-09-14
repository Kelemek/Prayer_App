import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

/** Prayer App Biz Feedback — not Cross Pointe Site issues, not Gospel Site issues. */
const DEFAULT_DATA_SOURCE_ID = 'ad60c0ea-da0e-4a36-be18-b395c7bcb564';
const NOTION_VERSION = '2025-09-03';
const TITLE_MAX = 100;
const DESCRIPTION_MAX = 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type FeedbackType = 'bug' | 'feature' | 'suggestion';
type FeedbackPlatform = 'web' | 'ios' | 'android';

interface SubmitFeedbackBody {
  configuredCheck?: unknown;
  title?: string;
  description?: string;
  type?: FeedbackType;
  userName?: string;
  pageUrl?: string;
  tenantId?: string;
  platform?: string;
}

const TYPE_TO_NOTION: Record<FeedbackType, string> = {
  bug: 'Bug',
  feature: 'Feature',
  suggestion: 'Suggestion',
};

const recentSubmissions = new Map<string, number[]>();

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isFeedbackType(value: unknown): value is FeedbackType {
  return value === 'bug' || value === 'feature' || value === 'suggestion';
}

function normalizePlatform(value: unknown): FeedbackPlatform {
  if (value === 'ios' || value === 'android' || value === 'web') return value;
  return 'web';
}

function richText(content: string): Record<string, unknown> {
  return {
    rich_text: [{ type: 'text', text: { content } }],
  };
}

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const times = (recentSubmissions.get(email) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recentSubmissions.set(email, times);
  return times.length >= RATE_MAX;
}

function recordSubmission(email: string): void {
  const times = recentSubmissions.get(email) ?? [];
  times.push(Date.now());
  recentSubmissions.set(email, times);
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isNotionConfigured(): boolean {
  return Boolean(Deno.env.get('NOTION_TOKEN')?.trim());
}

function configuredResponse(): Response {
  return jsonResponse({ configured: isNotionConfigured() }, 200);
}

async function resolveAuthenticatedUser(
  userClient: SupabaseClient
): Promise<{ id: string; email: string } | null> {
  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData?.user?.id || !userData?.user?.email) return null;
  return {
    id: userData.user.id,
    email: userData.user.email.toLowerCase().trim(),
  };
}

async function isSuperAdmin(adminClient: SupabaseClient, email: string): Promise<boolean> {
  const { data, error } = await adminClient.rpc('is_super_admin', {
    email_to_check: email,
  });
  if (error) {
    console.error('is_super_admin failed:', error);
    return false;
  }
  return data === true;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const notionToken = Deno.env.get('NOTION_TOKEN');
  const dataSourceId =
    Deno.env.get('NOTION_FEEDBACK_DATA_SOURCE_ID')?.trim() || DEFAULT_DATA_SOURCE_ID;

  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ success: false, error: 'Server configuration error' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceKey);

  try {
    if (req.method === 'GET') {
      const authUser = await resolveAuthenticatedUser(userClient);
      if (!authUser) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
      return configuredResponse();
    }

    const body = (await req.json()) as SubmitFeedbackBody;

    const authUser = await resolveAuthenticatedUser(userClient);
    if (!authUser) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }
    const authenticatedEmail = authUser.email;

    if (body.configuredCheck === true) {
      return configuredResponse();
    }

    if (!notionToken?.trim()) {
      return jsonResponse(
        { success: false, error: 'Feedback is not configured on the server.' },
        503
      );
    }

    if (isRateLimited(authenticatedEmail)) {
      return jsonResponse({ success: false, error: 'Too many feedback submissions' }, 429);
    }

    const title = String(body.title ?? '').trim();
    const description = String(body.description ?? '').trim();
    const type = body.type;

    if (!title || !description) {
      return jsonResponse({ success: false, error: 'Title and description are required' }, 400);
    }

    if (title.length > TITLE_MAX) {
      return jsonResponse({ success: false, error: 'Title is too long' }, 400);
    }

    if (description.length > DESCRIPTION_MAX) {
      return jsonResponse({ success: false, error: 'Description is too long' }, 400);
    }

    if (!isFeedbackType(type)) {
      return jsonResponse({ success: false, error: 'Invalid feedback type' }, 400);
    }

    const userName = String(body.userName ?? '').trim();
    const pageUrlRaw = String(body.pageUrl ?? '').trim();
    const pageUrl = pageUrlRaw && isHttpUrl(pageUrlRaw) && pageUrlRaw.length <= 2000 ? pageUrlRaw : '';
    const platform = normalizePlatform(body.platform);

    let tenantName = '';
    let tenantSlug = '';
    let tenantIdExtra = '';
    const tenantIdRaw = String(body.tenantId ?? '').trim();

    if (tenantIdRaw) {
      if (!UUID_RE.test(tenantIdRaw)) {
        return jsonResponse({ success: false, error: 'Invalid tenant' }, 400);
      }

      const { data: tenant, error: tenantError } = await adminClient
        .from('tenants')
        .select('id, name, slug')
        .eq('id', tenantIdRaw)
        .maybeSingle();

      if (tenantError) {
        console.error('tenants lookup failed:', tenantError);
        return jsonResponse({ success: false, error: 'Could not verify organization' }, 500);
      }

      if (!tenant) {
        return jsonResponse({ success: false, error: 'Invalid tenant' }, 400);
      }

      const superAdmin = await isSuperAdmin(adminClient, authenticatedEmail);
      if (!superAdmin) {
        const { data: membership, error: membershipError } = await adminClient
          .from('tenant_memberships')
          .select('user_email, is_blocked')
          .eq('tenant_id', tenantIdRaw)
          .eq('user_email', authenticatedEmail)
          .maybeSingle();

        if (membershipError) {
          console.error('tenant_memberships lookup failed:', membershipError);
          return jsonResponse(
            { success: false, error: 'Could not verify organization membership' },
            500
          );
        }

        if (!membership || membership.is_blocked === true) {
          return jsonResponse(
            { success: false, error: 'Not a member of this organization' },
            403
          );
        }
      }

      tenantName = String(tenant.name ?? '').trim();
      tenantSlug = String(tenant.slug ?? '').trim();
      tenantIdExtra = tenant.id;
    }

    const tenantIdForRow = tenantIdExtra || null;

    const { data: submissionRow, error: submissionError } = await adminClient
      .from('feedback_submissions')
      .insert({
        auth_user_id: authUser.id,
        user_email: authenticatedEmail,
        user_name: userName || null,
        tenant_id: tenantIdForRow,
        title,
        description,
        feedback_type: type,
        platform,
        page_url: pageUrl || null,
      })
      .select('id')
      .single();

    if (submissionError || !submissionRow?.id) {
      console.error('feedback_submissions insert failed:', submissionError);
      return jsonResponse({ success: false, error: 'Failed to submit feedback' }, 500);
    }

    const submissionId = submissionRow.id as string;

    const notionProperties: Record<string, unknown> = {
      'Task name': {
        title: [{ type: 'text', text: { content: title } }],
      },
      Description: richText(description),
      Type: {
        select: { name: TYPE_TO_NOTION[type] },
      },
      'Submission ID': richText(submissionId),
      Status: {
        status: { name: 'Not started' },
      },
      Priority: {
        select: { name: 'Medium' },
      },
      Platform: {
        select: { name: platform },
      },
    };

    if (pageUrl) {
      notionProperties['Page URL'] = { url: pageUrl };
    }

    if (tenantName) {
      notionProperties['Tenant'] = richText(tenantName.slice(0, 2000));
    }

    if (tenantSlug) {
      notionProperties['Tenant slug'] = richText(tenantSlug.slice(0, 2000));
    }

    const notionBody: Record<string, unknown> = {
      parent: { type: 'data_source_id', data_source_id: dataSourceId },
      properties: notionProperties,
    };

    recordSubmission(authenticatedEmail);

    const notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notionBody),
    });

    const notionPayload = await notionRes.json().catch(() => ({}));
    if (!notionRes.ok) {
      console.error('Notion API error:', notionPayload);
      return jsonResponse({ success: false, error: 'Failed to submit feedback' }, 502);
    }

    const notionPageId =
      typeof notionPayload?.id === 'string' ? notionPayload.id : null;
    if (notionPageId) {
      await adminClient
        .from('feedback_submissions')
        .update({ notion_page_id: notionPageId })
        .eq('id', submissionId);
    }

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    console.error('submit-feedback error:', err);
    return jsonResponse({ success: false, error: 'Failed to submit feedback' }, 500);
  }
});
