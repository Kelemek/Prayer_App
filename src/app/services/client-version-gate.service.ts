import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../environments/environment';
import {
  evaluateClientVersionGate,
  maybeAutoReloadWebOnce,
  normalizeMinVersionsRow,
  resolveClientVersion,
  type ClientVersionGateDecision,
} from '../../lib/client-version-gate';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ClientVersionGateService {
  private decision: ClientVersionGateDecision = {
    blocked: false,
    surface: null,
    clientVersion: resolveClientVersion('web'),
    minVersion: null,
  };
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(private supabase: SupabaseService) {}

  isBlocked(): boolean {
    return this.decision.blocked;
  }

  getDecision(): ClientVersionGateDecision {
    return this.decision;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.evaluatePolicy();
    try {
      await this.initializationPromise;
    } finally {
      this.initialized = true;
    }
  }

  private async evaluatePolicy(): Promise<void> {
    const platform = Capacitor.getPlatform();
    const clientVersion = resolveClientVersion(platform);

    if (!environment.production && this.hasLocalPreviewOverride()) {
      this.decision = {
        blocked: true,
        surface: Capacitor.isNativePlatform() ? 'native' : 'web',
        clientVersion,
        minVersion: 'preview',
      };
      return;
    }

    try {
      const { data, error } = await this.supabase.client.rpc(
        'get_public_client_min_versions'
      );
      if (error) {
        console.warn(
          '[ClientVersionGate] Failed to load min versions (fail-open):',
          error.message
        );
        return;
      }

      const mins = normalizeMinVersionsRow(data);
      this.decision = evaluateClientVersionGate(platform, clientVersion, mins);
      if (this.decision.blocked) {
        maybeAutoReloadWebOnce({
          blocked: true,
          platform,
          reload: () => {
            window.location.reload();
          },
        });
      }
    } catch (error) {
      console.warn(
        '[ClientVersionGate] Min-version check failed (fail-open):',
        error
      );
    }
  }

  private hasLocalPreviewOverride(): boolean {
    try {
      return (
        new URLSearchParams(window.location.search).get('force_upgrade') === '1'
      );
    } catch {
      return false;
    }
  }
}
