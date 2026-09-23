import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import {
  APP_BECAME_VISIBLE_EVENT,
  FOREGROUND_CONNECTION_CHECK_WINDOW_MS,
} from '../lib/app-foreground';
import { buildSupabaseClientOptions } from '../lib/supabase-client-options';
import { isDeadAuthSessionError } from '../lib/supabase-session-health';
import { describeFunctionInvokeFailure as formatFunctionInvokeFailure } from '../utils/supabase-function-invoke-error';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private connectionCheck: Promise<void> | null = null;
  private lastHealthyConnectionAt: number | null = null;

  constructor() {
    const supabaseUrl = environment.supabaseUrl;
    const supabasePublishableKey = environment.supabasePublishableKey;

    if (!supabaseUrl || !supabasePublishableKey) {
      console.error('Supabase environment variables missing:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabasePublishableKey
      });
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(
      supabaseUrl,
      supabasePublishableKey,
      buildSupabaseClientOptions(
        supabaseUrl,
        () => this.getClientVersion(),
        (input, options) => this.fetchWithNativeCompat(input, options)
      )
    );

    // Set up visibility recovery for Edge on iOS
    this.setupVisibilityRecovery();
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  getConfig() {
    return {
      url: environment.supabaseUrl,
      publishableKey: environment.supabasePublishableKey
    };
  }

  getSupabaseUrl(): string {
    return environment.supabaseUrl;
  }

  getPublishableKey(): string {
    return environment.supabasePublishableKey;
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  describeFunctionInvokeFailure(
    error: unknown,
    response?: Response | null,
    functionName?: string
  ): Promise<string> {
    return formatFunctionInvokeFailure(error, response, functionName);
  }

  isNetworkError(error: unknown): boolean {
    if (!error) return false;
    
    const errorStr = String(error).toLowerCase();
    return (
      errorStr.includes('failed to fetch') ||
      errorStr.includes('network') ||
      errorStr.includes('timeout') ||
      errorStr.includes('aborted') ||
      errorStr.includes('connection') ||
      (error instanceof Error && (
        error.message.includes('Failed to fetch') ||
        error.message.includes('Network') ||
        error.message.includes('Timeout')
      ))
    );
  }

  /**
   * Ensure Supabase connection is healthy
   * Critical for Edge on iOS which may lose connections during background suspension
   */
  async ensureConnected(): Promise<void> {
    if (
      this.lastHealthyConnectionAt != null &&
      Date.now() - this.lastHealthyConnectionAt < FOREGROUND_CONNECTION_CHECK_WINDOW_MS
    ) {
      return;
    }
    if (this.connectionCheck) {
      return this.connectionCheck;
    }
    this.connectionCheck = this.checkConnectionHealth().finally(() => {
      this.connectionCheck = null;
    });
    return this.connectionCheck;
  }

  /**
   * One getSession per in-flight check. Recreate the client only when the
   * stored session is actually dead — not on a healthy or transient failure.
   */
  private async checkConnectionHealth(): Promise<void> {
    try {
      const { error } = await this.supabase.auth.getSession();
      if (!error) {
        this.lastHealthyConnectionAt = Date.now();
        return;
      }
      if (!isDeadAuthSessionError(error)) {
        console.warn('[SupabaseService] Connection health check failed:', error);
        return;
      }
      console.warn('[SupabaseService] Auth session is dead, recreating client:', error);
      await this.reconnect();
      this.lastHealthyConnectionAt = Date.now();
    } catch (err) {
      if (!isDeadAuthSessionError(err)) {
        console.error('[SupabaseService] Connection check error:', err);
        return;
      }
      console.warn('[SupabaseService] Auth session is dead, recreating client:', err);
      await this.reconnect();
      this.lastHealthyConnectionAt = Date.now();
    }
  }

  /**
   * Force reconnection by recreating the Supabase client
   * Useful when Edge/iOS loses the connection during background suspension
   */
  private async reconnect(): Promise<void> {
    try {
      const supabaseUrl = environment.supabaseUrl;
      const supabasePublishableKey = environment.supabasePublishableKey;

      if (!supabaseUrl || !supabasePublishableKey) {
        throw new Error('Missing Supabase environment variables');
      }

      // Create a new client instance to reset all connections
      this.supabase = createClient(
        supabaseUrl,
        supabasePublishableKey,
        buildSupabaseClientOptions(
          supabaseUrl,
          () => this.getClientVersion(),
          (input, options) => this.fetchWithNativeCompat(input, options)
        )
      );
    } catch (err) {
      console.error('[SupabaseService] Reconnection failed:', err);
      throw err;
    }
  }

  /**
   * Get client version info (web vs native)
   */
  private getClientVersion(): string {
    try {
      // Check if running in Capacitor (native app)
      if (typeof (window as any).Capacitor !== 'undefined') {
        const platform = (window as any).Capacitor?.getPlatform?.() || 'native';
        return `capacitor-${platform}`;
      }
    } catch {
      // Fall through to web
    }
    return 'web';
  }

  /**
   * Enhanced fetch wrapper for native app compatibility
   * Handles CORS and timeout issues specific to native HTTP stacks (iOS, Android)
   */
  private fetchWithNativeCompat(input: URL | RequestInfo, options?: RequestInit): Promise<Response> {
    // Ensure proper headers for native compatibility
    const headers = new Headers(options?.headers || {});
    
    // Ensure content-type is set for POST requests
    if (options?.method === 'POST' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    
    // Add explicit CORS mode for edge function calls
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const isEdgeFunction = urlStr.includes('/functions/');
    const mode: RequestMode = isEdgeFunction ? 'cors' : (options?.mode || 'cors');
    
    const fetchOptions: RequestInit = {
      ...options,
      headers,
      mode,
      // Ensure credentials aren't sent (API key in header, not cookies)
      credentials: 'omit'
    };

    // Wrap with timeout for native app reliability
    return this.fetchWithTimeout(fetch(input, fetchOptions), 30000);
  }

  /**
   * Wrap fetch with timeout to prevent hanging on native apps
   * Properly clears timeout to prevent orphaned timers
   */
  private fetchWithTimeout(fetchPromise: Promise<Response>, timeoutMs: number): Promise<Response> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<Response>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Fetch timeout after ${timeoutMs}ms - network may be slow or unavailable`)),
        timeoutMs
      );
    });

    return Promise.race([fetchPromise, timeoutPromise]).finally(() => {
      // Clear the timeout regardless of whether fetch succeeded or timed out
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    });
  }

  /**
   * Trigger connection recovery when app becomes visible
   * Especially important for Edge on iOS
   */
  setupVisibilityRecovery(): void {
    if (typeof window === 'undefined') return;

    // Raw visibility is handled by installAppForegroundSignal in main.ts.
    window.addEventListener(APP_BECAME_VISIBLE_EVENT, () => {
      this.ensureConnected().catch(err => {
        console.error('[SupabaseService] Failed to ensure connection:', err);
      });
    });
  }

  async directQuery<T = any>(
    table: string,
    options: {
      select?: string;
      eq?: Record<string, string | number | boolean>;
      order?: { column: string; ascending?: boolean };
      limit?: number;
      count?: 'exact' | 'planned' | 'estimated';
      head?: boolean;
      timeout?: number;
    } = {}
  ): Promise<{ data: T | null; error: Error | null; count?: number }> {
    const { select = '*', eq = {}, order, limit, count, head = false, timeout = 30000 } = options;
    
    const params = new URLSearchParams();
    params.set('select', select);
    
    // Add equality filters
    for (const [key, value] of Object.entries(eq)) {
      params.set(key, `eq.${value}`);
    }
    
    // Add ordering
    if (order) {
      const direction = order.ascending === false ? '.desc' : '.asc';
      params.set('order', `${order.column}${direction}`);
    }
    
    // Add limit
    if (limit !== undefined) {
      params.set('limit', String(limit));
    }
    
    // Add count preference
    const headers: Record<string, string> = {
      'apikey': environment.supabasePublishableKey,
      'Authorization': `Bearer ${environment.supabasePublishableKey}`
    };
    
    if (count) {
      headers['Prefer'] = `count=${count}`;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(
        `${environment.supabaseUrl}/rest/v1/${table}?${params.toString()}`,
        {
          method: head ? 'HEAD' : 'GET',
          headers,
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          data: null,
          error: new Error(`Query failed: ${response.status} - ${errorText}`)
        };
      }
      
      const data = head ? null : await response.json();
      const countValue = response.headers.get('Content-Range')
        ? parseInt(response.headers.get('Content-Range')?.split('/')[1] || '0')
        : undefined;
      
      return { data: data as T, error: null, count: countValue };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  async directMutation<T = any>(
    table: string,
    options: {
      method: 'POST' | 'PATCH' | 'DELETE';
      body?: any;
      eq?: Record<string, string | number | boolean>;
      returning?: boolean;
      timeout?: number;
    }
  ): Promise<{ data: T | null; error: Error | null }> {
    const { method, body, eq = {}, returning = false, timeout = 30000 } = options;
    
    const params = new URLSearchParams();
    
    // Add equality filters for PATCH/DELETE
    if (method !== 'POST') {
      for (const [key, value] of Object.entries(eq)) {
        params.set(key, `eq.${value}`);
      }
    }
    
    const headers: Record<string, string> = {
      'apikey': environment.supabasePublishableKey,
      'Authorization': `Bearer ${environment.supabasePublishableKey}`,
      'Content-Type': 'application/json'
    };
    
    if (returning) {
      headers['Prefer'] = 'return=representation';
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const url = `${environment.supabaseUrl}/rest/v1/${table}${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          data: null,
          error: new Error(`Mutation failed: ${response.status} - ${errorText}`)
        };
      }
      
      const data = returning && response.status !== 204 ? await response.json() : null;
      return { data: data as T, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
}
