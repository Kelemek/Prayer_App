import type { SupabaseClient } from '@supabase/supabase-js';
import { describeFunctionInvokeFailure } from '../utils/supabase-function-invoke-error';

export interface PlanningCenterAttributes {
  first_name?: string;
  last_name?: string;
  name: string;
  avatar?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  primary_email_address?: string | null;
  login_identifier?: string;
}

export interface PlanningCenterPerson {
  id: string;
  type: string;
  attributes: PlanningCenterAttributes;
}

export interface EmailLookupResult {
  people: PlanningCenterPerson[];
  count: number;
  error?: string;
}

export interface PlanningCenterList {
  id: string;
  name: string;
  description: string;
}

export interface PlanningCenterListMember {
  id: string;
  name: string;
  avatar?: string | null;
}

/** PCO `avatar` is often a file UUID; prefer `demographic_avatar_url` for `<img src>`. */
export function resolvePlanningCenterMemberAvatarUrl(
  attributes: {
    avatar?: string | null;
    demographic_avatar_url?: string | null;
  } | null
  | undefined
): string | null {
  const demographic = attributes?.demographic_avatar_url?.trim();
  if (demographic && /^https?:\/\//i.test(demographic)) {
    return demographic;
  }
  const avatar = attributes?.avatar?.trim();
  if (avatar && /^https?:\/\//i.test(avatar)) {
    return avatar;
  }
  return null;
}

export interface PlanningCenterCredentialsStatus {
  enabled: boolean;
  configured: boolean;
  app_id_last4: string | null;
}

async function parseInvokeError(
  error: unknown,
  data: unknown,
  response: Response | null | undefined,
  functionName: string
): Promise<string | null> {
  const body = data as { error?: string } | null;
  if (body?.error) {
    return body.error;
  }
  if (error) {
    return await describeFunctionInvokeFailure(error, response, functionName);
  }
  return null;
}

export async function fetchPlanningCenterCredentialsStatus(
  client: SupabaseClient,
  tenantId: string
): Promise<{ status: PlanningCenterCredentialsStatus | null; error: string | null }> {
  const { data, error, response } = await client.functions.invoke('planning-center-credentials', {
    body: { action: 'status', tenant_id: tenantId },
  });
  const invokeError = await parseInvokeError(error, data, response, 'planning-center-credentials');
  if (invokeError) {
    return { status: null, error: invokeError };
  }
  const row = data as PlanningCenterCredentialsStatus & { success?: boolean };
  return {
    status: {
      enabled: Boolean(row.enabled),
      configured: Boolean(row.configured),
      app_id_last4: row.app_id_last4 ?? null,
    },
    error: null,
  };
}

export async function savePlanningCenterCredentials(
  client: SupabaseClient,
  tenantId: string,
  appId: string,
  secret: string
): Promise<{ error: string | null }> {
  const { data, error, response } = await client.functions.invoke('planning-center-credentials', {
    body: { action: 'save', tenant_id: tenantId, app_id: appId, secret },
  });
  return { error: await parseInvokeError(error, data, response, 'planning-center-credentials') };
}

export async function testPlanningCenterCredentials(
  client: SupabaseClient,
  tenantId: string,
  appId?: string,
  secret?: string
): Promise<{ ok: boolean; error: string | null }> {
  const { data, error, response } = await client.functions.invoke('planning-center-credentials', {
    body: {
      action: 'test',
      tenant_id: tenantId,
      app_id: appId,
      secret,
    },
  });
  const invokeError = await parseInvokeError(error, data, response, 'planning-center-credentials');
  if (invokeError) {
    return { ok: false, error: invokeError };
  }
  return { ok: true, error: null };
}

export async function setPlanningCenterEnabled(
  client: SupabaseClient,
  tenantId: string,
  enabled: boolean
): Promise<{ error: string | null }> {
  const { data, error, response } = await client.functions.invoke('planning-center-credentials', {
    body: { action: 'enable', tenant_id: tenantId, enabled },
  });
  return { error: await parseInvokeError(error, data, response, 'planning-center-credentials') };
}

export async function clearPlanningCenterCredentials(
  client: SupabaseClient,
  tenantId: string
): Promise<{ error: string | null }> {
  const { data, error, response } = await client.functions.invoke('planning-center-credentials', {
    body: { action: 'clear', tenant_id: tenantId },
  });
  return { error: await parseInvokeError(error, data, response, 'planning-center-credentials') };
}

export async function lookupPersonByEmail(
  client: SupabaseClient,
  tenantId: string,
  searchTerm: string
): Promise<EmailLookupResult> {
  if (!searchTerm.trim()) {
    return { people: [], count: 0, error: 'Email address is required' };
  }
  const { data, error, response } = await client.functions.invoke('planning-center-lookup', {
    body: { tenant_id: tenantId, email: searchTerm.trim() },
  });
  const invokeError = await parseInvokeError(error, data, response, 'planning-center-lookup');
  if (invokeError) {
    return { people: [], count: 0, error: invokeError };
  }
  const result = data as { people?: PlanningCenterPerson[]; count?: number };
  return {
    people: result.people ?? [],
    count: result.count ?? (result.people?.length ?? 0),
  };
}

export async function searchPlanningCenterByName(
  client: SupabaseClient,
  tenantId: string,
  name: string
): Promise<EmailLookupResult> {
  return lookupPersonByEmail(client, tenantId, name);
}

export async function fetchPlanningCenterLists(
  client: SupabaseClient,
  tenantId: string
): Promise<{ lists: PlanningCenterList[]; error: string | null }> {
  const { data, error, response } = await client.functions.invoke('planning-center-lists', {
    body: { tenant_id: tenantId, action: 'lists' },
  });
  const invokeError = await parseInvokeError(error, data, response, 'planning-center-lists');
  if (invokeError) {
    return { lists: [], error: invokeError };
  }
  const result = data as { lists?: PlanningCenterList[] };
  return { lists: result.lists ?? [], error: null };
}

export async function fetchListMembers(
  client: SupabaseClient,
  tenantId: string,
  listId: string
): Promise<{ members: PlanningCenterListMember[]; error: string | null }> {
  const { data, error, response } = await client.functions.invoke('planning-center-lists', {
    body: { tenant_id: tenantId, action: 'members', listId },
  });
  const invokeError = await parseInvokeError(error, data, response, 'planning-center-lists');
  if (invokeError) {
    return { members: [], error: invokeError };
  }
  const result = data as { members?: PlanningCenterListMember[] };
  const members = result.members ?? [];
  members.sort((a, b) => sortByLastName(a.name, b.name));
  return { members, error: null };
}

export function formatPersonName(person: PlanningCenterPerson): string {
  const attrs = person.attributes;
  if (attrs.name?.trim()) {
    return attrs.name.trim();
  }
  const parts = [attrs.first_name, attrs.last_name].filter(Boolean);
  return parts.join(' ').trim() || 'Unknown';
}

function sortByLastName(a: string, b: string): number {
  const lastA = extractSortableLastName(a);
  const lastB = extractSortableLastName(b);
  return lastA.localeCompare(lastB, undefined, { sensitivity: 'base' });
}

function extractSortableLastName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return '';
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0];
  }
  const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv']);
  let end = parts.length - 1;
  while (end > 0 && suffixes.has(parts[end].toLowerCase())) {
    end--;
  }
  return parts[end] ?? parts[parts.length - 1];
}
