import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { APP_BUNDLE_VERSION } from '../../lib/app-analytics-context';
import {
  clientSurfaceFromPlatform,
  evaluateClientVersionGate,
  normalizeMinVersionsRow,
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
    clientVersion: APP_BUNDLE_VERSION,
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

  async initialize(options?: { previewBlocked?: boolean }): Promise<void> {
    if (this.initialized) {
      return;
    }
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.loadDecision(options);
    await this.initializationPromise;
    this.initialized = true;
  }

  private async loadDecision(options?: {
    previewBlocked?: boolean;
  }): Promise<void> {
    const surface = clientSurfaceFromPlatform(Capacitor.getPlatform());

    if (options?.previewBlocked) {
      this.decision = {
        blocked: true,
        surface,
        clientVersion: APP_BUNDLE_VERSION,
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

      this.decision = evaluateClientVersionGate(
        surface,
        APP_BUNDLE_VERSION,
        normalizeMinVersionsRow(data)
      );
    } catch (error) {
      console.warn(
        '[ClientVersionGate] Min-version check failed (fail-open):',
        error
      );
    }
  }
}
