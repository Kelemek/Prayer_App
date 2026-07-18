import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { UserSessionService, type UserSessionData } from './user-session.service';
import { TenantContextService } from './tenant-context.service';
import type {
  UserHourReminderKind,
  UserHourReminderSlot,
} from '../types/user-hour-reminder';

/** Revalidate cache in background after this many ms (stale-while-revalidate). */
const STALE_MS = 10 * 60 * 1000;

type HourReminderSessionKeys = {
  slotsKey: keyof Pick<
    UserSessionData,
    'prayerHourReminders' | 'memorizationHourReminders'
  >;
  fetchedAtKey: keyof Pick<
    UserSessionData,
    'prayerHourRemindersFetchedAt' | 'memorizationHourRemindersFetchedAt'
  >;
};

const CONFIG: Record<
  UserHourReminderKind,
  HourReminderSessionKeys & { table: string; tenantScoped: boolean }
> = {
  prayer: {
    table: 'user_prayer_hour_reminders',
    slotsKey: 'prayerHourReminders',
    fetchedAtKey: 'prayerHourRemindersFetchedAt',
    tenantScoped: false,
  },
  memorization: {
    table: 'user_memorization_hour_reminders',
    slotsKey: 'memorizationHourReminders',
    fetchedAtKey: 'memorizationHourRemindersFetchedAt',
    tenantScoped: true,
  },
};

@Injectable({
  providedIn: 'root',
})
export class UserHourReminderService {
  private fetchGeneration: Record<UserHourReminderKind, number> = {
    prayer: 0,
    memorization: 0,
  };

  constructor(
    private supabase: SupabaseService,
    private userSession: UserSessionService,
    private tenantContext: TenantContextService
  ) {}

  async ensureLoaded(
    kind: UserHourReminderKind,
    forceRefresh = false
  ): Promise<UserHourReminderSlot[]> {
    const session = this.userSession.getCurrentSession();
    if (!session?.email?.trim()) {
      return [];
    }
    const email = session.email.trim();
    const { slotsKey, fetchedAtKey } = CONFIG[kind];
    const cached = session[slotsKey];
    const fetchedAt = session[fetchedAtKey] ?? 0;
    const age = Date.now() - fetchedAt;

    if (!forceRefresh && cached !== undefined && age < STALE_MS) {
      return cached;
    }
    if (!forceRefresh && cached !== undefined && age >= STALE_MS) {
      void this.fetchAndUpdateSession(kind, email).catch(() => undefined);
      return cached;
    }
    return this.fetchAndUpdateSession(kind, email);
  }

  private async fetchAndUpdateSession(
    kind: UserHourReminderKind,
    email: string
  ): Promise<UserHourReminderSlot[]> {
    const generation = ++this.fetchGeneration[kind];
    const { table, slotsKey, fetchedAtKey, tenantScoped } = CONFIG[kind];
    let query = this.supabase.client
      .from(table)
      .select('id, iana_timezone, local_hour')
      .eq('user_email', email)
      .order('local_hour', { ascending: true });

    if (tenantScoped) {
      const tenantId = this.tenantContext.getActiveTenant()?.id;
      if (!tenantId) {
        return [];
      }
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }
    const slots = (data ?? []) as UserHourReminderSlot[];
    if (
      generation !== this.fetchGeneration[kind] ||
      !this.sessionStillMatches(email)
    ) {
      return slots;
    }
    await this.userSession.updateUserSession({
      [slotsKey]: slots,
      [fetchedAtKey]: Date.now(),
    });
    return slots;
  }

  private sessionStillMatches(email: string): boolean {
    const current = this.userSession.getCurrentSession()?.email?.trim();
    return !!current && current === email.trim();
  }

  async addSlot(
    kind: UserHourReminderKind,
    email: string,
    ianaTimezone: string,
    localHour: number
  ): Promise<UserHourReminderSlot[]> {
    this.fetchGeneration[kind]++;
    const { table, tenantScoped } = CONFIG[kind];
    const row: Record<string, string | number> = {
      user_email: email.trim(),
      iana_timezone: ianaTimezone,
      local_hour: localHour,
    };
    if (tenantScoped) {
      const tenantId = this.tenantContext.getActiveTenant()?.id;
      if (!tenantId) {
        throw new Error('Select an organization first.');
      }
      row['tenant_id'] = tenantId;
    }
    const { error } = await this.supabase.client.from(table).insert(row);
    if (error) {
      throw error;
    }
    return this.fetchAndUpdateSession(kind, email.trim());
  }

  async removeSlot(
    kind: UserHourReminderKind,
    email: string,
    id: string
  ): Promise<UserHourReminderSlot[]> {
    this.fetchGeneration[kind]++;
    const { table, tenantScoped } = CONFIG[kind];
    let query = this.supabase.client
      .from(table)
      .delete()
      .eq('id', id)
      .eq('user_email', email.trim());
    if (tenantScoped) {
      const tenantId = this.tenantContext.getActiveTenant()?.id;
      if (!tenantId) {
        throw new Error('Select an organization first.');
      }
      query = query.eq('tenant_id', tenantId);
    }
    const { error } = await query;
    if (error) {
      throw error;
    }
    return this.fetchAndUpdateSession(kind, email.trim());
  }

  sessionCacheKeys(kind: UserHourReminderKind): HourReminderSessionKeys {
    const { slotsKey, fetchedAtKey } = CONFIG[kind];
    return { slotsKey, fetchedAtKey };
  }
}
