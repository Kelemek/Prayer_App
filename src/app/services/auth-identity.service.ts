import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

const PENDING_LOGIN_EMAIL_KEY = 'pending_login_email';
const PENDING_TEST_ACCOUNT_KEY = 'pending_test_account_login';

@Injectable({
  providedIn: 'root'
})
export class AuthIdentityService {
  constructor(private supabase: SupabaseService) {}

  async getEmail(): Promise<string | null> {
    try {
      const { data: { session } } = await this.supabase.client.auth.getSession();
      const sessionEmail = session?.user?.email?.toLowerCase().trim();
      if (sessionEmail) {
        return sessionEmail;
      }
    } catch (error) {
      console.warn('[AuthIdentity] Failed to read auth session:', error);
    }
    return null;
  }

  setPendingLogin(email: string, isTestAccount = false): void {
    sessionStorage.setItem(PENDING_LOGIN_EMAIL_KEY, email.toLowerCase().trim());
    if (isTestAccount) {
      sessionStorage.setItem(PENDING_TEST_ACCOUNT_KEY, 'true');
    } else {
      sessionStorage.removeItem(PENDING_TEST_ACCOUNT_KEY);
    }
  }

  getPendingLoginEmail(): string | null {
    return sessionStorage.getItem(PENDING_LOGIN_EMAIL_KEY);
  }

  isPendingTestAccountLogin(): boolean {
    return sessionStorage.getItem(PENDING_TEST_ACCOUNT_KEY) === 'true';
  }

  clearPendingLogin(): void {
    sessionStorage.removeItem(PENDING_LOGIN_EMAIL_KEY);
    sessionStorage.removeItem(PENDING_TEST_ACCOUNT_KEY);
  }

  async isTestAccountEmail(email: string): Promise<boolean> {
    const normalized = email.toLowerCase().trim();
    if (!normalized) {
      return false;
    }
    const { data, error } = await this.supabase.client.rpc('is_test_account_email', {
      p_email: normalized
    });
    if (error) {
      console.warn('[AuthIdentity] is_test_account_email failed:', error);
      return false;
    }
    return data === true;
  }
}
