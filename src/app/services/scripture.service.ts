import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { BibleTranslation } from '../types/memorization';

export interface ScripturePassage {
  reference: string;
  text: string;
  translation: BibleTranslation;
  cached?: boolean;
}

export interface ScriptureAudioResult {
  audioUrl: string | null;
  useSpeechSynthesis: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ScriptureService {
  constructor(private supabase: SupabaseService) {}

  private functionsUrl(functionName: string): string {
    return `${this.supabase.getSupabaseUrl()}/functions/v1/${functionName}`;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const session = await this.supabase.client.auth.getSession();
    const token = session.data.session?.access_token;
    return {
      apikey: this.supabase.getPublishableKey(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async getPassage(
    reference: string,
    translation: BibleTranslation = 'esv'
  ): Promise<ScripturePassage> {
    const url = new URL(this.functionsUrl('scripture'));
    url.searchParams.set('reference', reference.trim());
    url.searchParams.set('translation', translation);

    const response = await fetch(url.toString(), {
      headers: await this.authHeaders(),
    });

    const payload = (await response.json()) as ScripturePassage & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || 'Could not load scripture text');
    }
    return payload;
  }

  async getAudioUrl(
    reference: string,
    translation: BibleTranslation = 'esv'
  ): Promise<ScriptureAudioResult> {
    const url = new URL(this.functionsUrl('scripture-audio'));
    url.searchParams.set('reference', reference.trim());
    url.searchParams.set('translation', translation);

    const response = await fetch(url.toString(), {
      headers: await this.authHeaders(),
    });

    const payload = (await response.json()) as ScriptureAudioResult & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || 'Could not load scripture audio');
    }
    return payload;
  }
}
