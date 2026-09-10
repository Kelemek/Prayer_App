import { Injectable } from "@angular/core";
import { SupabaseService } from "./supabase.service";
import { TenantContextService } from "./tenant-context.service";
import type { AllowanceLevel } from "../types/prayer";

const DEFAULT_ALLOWANCE: AllowanceLevel = "everyone";

@Injectable({
  providedIn: "root",
})
export class PrayerAllowancePolicyService {
  deletionsAllowed: AllowanceLevel = DEFAULT_ALLOWANCE;
  updatesAllowed: AllowanceLevel = DEFAULT_ALLOWANCE;

  constructor(
    private supabaseService: SupabaseService,
    private tenantContext: TenantContextService
  ) {}

  async load(): Promise<void> {
    const tenantId = this.tenantContext.getActiveTenant()?.id;
    if (!tenantId) {
      this.deletionsAllowed = DEFAULT_ALLOWANCE;
      this.updatesAllowed = DEFAULT_ALLOWANCE;
      return;
    }

    try {
      const { data, error } = await this.supabaseService.client
        .from("tenant_settings")
        .select("deletions_allowed, updates_allowed")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) {
        console.error("Error loading tenant allowance settings:", error);
        return;
      }

      if (data) {
        this.deletionsAllowed = data.deletions_allowed || DEFAULT_ALLOWANCE;
        this.updatesAllowed = data.updates_allowed || DEFAULT_ALLOWANCE;
      }
    } catch (err) {
      console.error("Error loading tenant allowance settings:", err);
    }
  }
}
