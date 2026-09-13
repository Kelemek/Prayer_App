import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  BillingSignupEmailSendError,
  isBillingSignupKind,
  mapChurchSetupState,
  type BillingSignupKind,
  type BillingSignupLeadCreated,
  type ChurchSetupState,
} from '../lib/billing-signup';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class BillingSignupService {
  constructor(private supabase: SupabaseService) {}

  async getChurchSetupState(): Promise<ChurchSetupState> {
    const { data, error } = await this.supabase.client.rpc('get_church_setup_state');
    if (error) {
      console.error('[BillingSignup] get_church_setup_state failed:', error);
      return { status: 'none' };
    }
    return mapChurchSetupState(data);
  }

  async isTenantSlugAvailable(slug: string): Promise<boolean | null> {
    const { data, error } = await this.supabase.client.rpc('is_tenant_slug_available', {
      p_slug: slug,
    });
    if (error) {
      console.error('[BillingSignup] is_tenant_slug_available failed:', error);
      return null;
    }
    return data === true;
  }

  async completeChurchSetup(name: string, slug: string): Promise<{ id: string; slug: string; name: string }> {
    const { data, error } = await this.supabase.client.rpc('complete_church_setup_for_user', {
      p_name: name,
      p_slug: slug,
    });
    if (error || !data) {
      throw new Error(error?.message || 'Failed to finish church setup');
    }
    const row = data as { id?: string; slug?: string; name?: string };
    if (!row.id || !row.slug || !row.name) {
      throw new Error('Failed to finish church setup');
    }
    return { id: row.id, slug: row.slug, name: row.name };
  }

  async sendSignupEmail(kind: BillingSignupKind): Promise<BillingSignupLeadCreated> {
    if (!isBillingSignupKind(kind)) {
      throw new Error('Invalid signup kind');
    }
    const session = await this.supabase.client.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      throw new Error('You must be signed in to email a setup link');
    }

    const response = await fetch(
      `${this.supabase.getSupabaseUrl()}/functions/v1/send-billing-signup-email`,
      {
        method: 'POST',
        headers: {
          apikey: this.supabase.getPublishableKey(),
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kind }),
      }
    );
    const payload = (await response.json()) as {
      url?: string;
      token?: string;
      emailed?: boolean;
      error?: string;
    };
    const url = payload.url?.trim() ?? '';
    const leadToken = payload.token?.trim() ?? '';
    if (!response.ok || !url || !leadToken) {
      throw new Error(payload.error || 'Failed to email a setup link');
    }
    const created: BillingSignupLeadCreated = {
      token: leadToken,
      url,
      expiresAt: '',
      status: 'pending',
    };
    if (payload.emailed === false) {
      throw new BillingSignupEmailSendError(
        payload.error || 'Could not send email',
        leadToken,
        url
      );
    }
    return created;
  }

  churchSetupAbsoluteUrl(): string {
    const base = (environment.appUrl || '').replace(/\/+$/, '');
    return `${base}/church-setup`;
  }
}
