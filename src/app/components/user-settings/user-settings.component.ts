import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from "@angular/core";
import { ThemeService } from "../../services/theme.service";
import { TextSizeService, TextSize } from "../../services/text-size.service";
import { SupabaseService } from "../../services/supabase.service";
import { AdminAuthService } from "../../services/admin-auth.service";
import { GitHubFeedbackService } from "../../services/github-feedback.service";
import { UserSessionService } from "../../services/user-session.service";
import { BadgeService } from "../../services/badge.service";
import { CapacitorService } from "../../services/capacitor.service";
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from "rxjs";
import { getUserInfo } from "../../../utils/userInfoStorage";
import { GitHubFeedbackFormComponent } from "../github-feedback-form/github-feedback-form.component";
import { HourReminderSettingsSectionComponent } from "../hour-reminder-settings-section/hour-reminder-settings-section.component";
import { TenantContextService } from "../../services/tenant-context.service";
import { TenantMembershipPreferencesService } from "../../services/tenant-membership-preferences.service";
import { ConnectivityService } from "../../services/connectivity.service";
import { ToastService } from "../../services/toast.service";
import { UserSettingsPrintSectionComponent } from "./user-settings-print-section/user-settings-print-section.component";
import { UserSettingsAppearanceSectionComponent } from "./user-settings-appearance-section/user-settings-appearance-section.component";
import { UserSettingsNotificationPreferencesSectionComponent } from "./user-settings-notification-preferences-section/user-settings-notification-preferences-section.component";
import { UserSettingsPrayerEncouragementSectionComponent } from "./user-settings-prayer-encouragement-section/user-settings-prayer-encouragement-section.component";
import { UserSettingsDefaultViewSectionComponent } from "./user-settings-default-view-section/user-settings-default-view-section.component";
import { UserSettingsMemorizationPracticeSectionComponent } from "./user-settings-memorization-practice-section/user-settings-memorization-practice-section.component";

type ThemeOption = "light" | "dark" | "system";

@Component({
  selector: "app-user-settings",
  standalone: true,
  imports: [
    GitHubFeedbackFormComponent,
    HourReminderSettingsSectionComponent,
    UserSettingsPrintSectionComponent,
    UserSettingsAppearanceSectionComponent,
    UserSettingsNotificationPreferencesSectionComponent,
    UserSettingsPrayerEncouragementSectionComponent,
    UserSettingsDefaultViewSectionComponent,
    UserSettingsMemorizationPracticeSectionComponent,
  ],
  templateUrl: "./user-settings.component.html",
  styleUrl: "./user-settings.component.css",
  changeDetection: ChangeDetectionStrategy.Default,
})
export class UserSettingsComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isOpen = false;
  @Output() onClose = new EventEmitter<void>();

  name = "";
  email = "";
  receiveNotifications: boolean | null = null;
  receivePushNotifications: boolean | null = null;
  badgeFunctionalityEnabled: boolean | null = null;
  showPrayForButton: boolean | null = null;
  showPrayingCount: boolean | null = null;
  theme: ThemeOption = "system";
  textSize: TextSize = "normal";
  saving = false;
  savingNotification = false;
  savingPushNotification = false;
  savingBadge = false;
  savingShowPrayForButton = false;
  savingShowPrayingCount = false;
  successPushNotification: string | null = null;
  savingDefaultView = false;
  error: string | null = null;
  success: string | null = null;
  successNotification: string | null = null;
  successBadge: string | null = null;
  successPrayerEncouragementUi: string | null = null;
  successDefaultView: string | null = null;
  preferencesLoaded = false;
  badgePreferencesLoaded = false;
  prayerEncouragementUiLoaded = false;
  defaultViewPreferencesLoaded = false;
  memorizationStrictModeLoaded = false;
  defaultPrayerView: "current" | "personal" | null = null;
  memorizationStrictMode = false;
  savingMemorizationStrictMode = false;

  githubFeedbackEnabled = false;
  showDeleteAccountVerification = false;
  deletingAccount = false;


  private destroy$ = new Subject<void>();
  private emailChange$ = new Subject<string>();
  private isInitialLoad = false;

  themeOptions = [
    {
      value: "light" as ThemeOption,
      label: "Light",
      icon: '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>',
    },
    {
      value: "dark" as ThemeOption,
      label: "Dark",
      icon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>',
    },
    {
      value: "system" as ThemeOption,
      label: "System",
      icon: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line>',
    },
  ];


  constructor(
    private themeService: ThemeService,
    private textSizeService: TextSizeService,
    private supabase: SupabaseService,
    private adminAuthService: AdminAuthService,
    private githubFeedbackService: GitHubFeedbackService,
    private badgeService: BadgeService,
    public userSessionService: UserSessionService,
    public capacitorService: CapacitorService,
    private tenantContext: TenantContextService,
    private membershipPrefs: TenantMembershipPreferencesService,
    private connectivity: ConnectivityService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  private getActiveTenantId(): string | null {
    return this.tenantContext.getActiveTenant()?.id ?? null;
  }

  ngOnInit(): void {
    // Load current theme and text size from services
    this.theme = this.themeService.getTheme() as ThemeOption;
    this.textSize = this.textSizeService.getTextSize();

    // Load user info from localStorage if available
    const userInfo = this.getUserInfo();
    if (userInfo.firstName && userInfo.lastName) {
      this.name = `${userInfo.firstName} ${userInfo.lastName}`;
    }
    this.email = userInfo.email;

    void this.loadGitHubFeedbackStatus();

    // Set up email change debounce listener
    this.emailChange$
      .pipe(takeUntil(this.destroy$), debounceTime(800), distinctUntilChanged())
      .subscribe((email) => {
        if (!this.isInitialLoad) {
          this.loadPreferencesAutomatically(email);
        }
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["isOpen"] && this.isOpen) {
      this.theme = this.themeService.getTheme() as ThemeOption;
      this.textSize = this.textSizeService.getTextSize();
      // Mark that we're doing initial load
      this.isInitialLoad = true;
      this.preferencesLoaded = false;
      this.badgePreferencesLoaded = false;
      this.defaultViewPreferencesLoaded = false;
      this.memorizationStrictModeLoaded = false;
      this.prayerEncouragementUiLoaded = false;

      // Get user info and preferences from UserSessionService cache
      const userSession = this.userSessionService.getCurrentSession();
      if (userSession) {
        this.email = userSession.email;
        this.name = userSession.fullName || "";

        // Get preferences from cached session - no database query needed
        this.receiveNotifications = userSession.isActive ?? true;
        this.receivePushNotifications = userSession.receivePush ?? false;
        this.preferencesLoaded = true;

        // Get badge functionality preference from cached session - no database query needed
        this.badgeFunctionalityEnabled =
          userSession.badgeFunctionalityEnabled ?? false;
        this.badgePreferencesLoaded = true;

        // Get default prayer view preference from cached session
        this.defaultPrayerView = userSession.defaultPrayerView || "current";
        this.defaultViewPreferencesLoaded = true;
        this.memorizationStrictMode = userSession.memorizationStrictMode ?? false;
        this.memorizationStrictModeLoaded = true;
        this.showPrayForButton = userSession.showPrayForButton ?? true;
        this.showPrayingCount = userSession.showPrayingCount ?? true;
        this.prayerEncouragementUiLoaded = true;
      } else {
        // Fall back to localStorage if session not available
        const userInfo = this.getUserInfo();
        this.email = userInfo.email;
        this.name =
          userInfo.firstName && userInfo.lastName
            ? `${userInfo.firstName} ${userInfo.lastName}`
            : "";

        if (this.email.trim()) {
          this.loadPreferencesAutomatically(this.email);
          // Badge functionality defaults to false when no session
          this.badgeFunctionalityEnabled = false;
          this.badgePreferencesLoaded = true;
          // Default prayer view defaults to 'current' when no session
          this.defaultPrayerView = "current";
          this.defaultViewPreferencesLoaded = true;
          this.memorizationStrictMode = false;
          this.memorizationStrictModeLoaded = true;
          this.showPrayForButton = true;
          this.showPrayingCount = true;
          this.prayerEncouragementUiLoaded = true;
        } else {
          this.receiveNotifications = true;
          this.receivePushNotifications = false;
          this.preferencesLoaded = true;
          this.badgeFunctionalityEnabled = false;
          this.badgePreferencesLoaded = true;
          this.defaultPrayerView = "current";
          this.defaultViewPreferencesLoaded = true;
          this.memorizationStrictMode = false;
          this.memorizationStrictModeLoaded = true;
          this.showPrayForButton = true;
          this.showPrayingCount = true;
          this.prayerEncouragementUiLoaded = true;
        }
      }

      this.error = null;
      this.success = null;
      this.successNotification = null;
      this.successPushNotification = null;
      this.successBadge = null;
      this.successPrayerEncouragementUi = null;

      // Reset flag after a short delay
      setTimeout(() => {
        this.isInitialLoad = false;
      }, 100);
    }
  }


  async loadGitHubFeedbackStatus(): Promise<void> {
    try {
      const config = await this.githubFeedbackService.getGitHubConfig();
      this.githubFeedbackEnabled = config?.enabled || false;
      this.cdr.markForCheck();
    } catch (err) {
      console.error("Error loading GitHub feedback status:", err);
      this.githubFeedbackEnabled = false;
    }
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  handleThemeChange(newTheme: ThemeOption): void {
    this.theme = newTheme;
    this.themeService.setTheme(newTheme);
  }

  handleTextSizeChange(size: TextSize): void {
    this.textSize = size;
    this.textSizeService.setTextSize(size);
  }








  private async loadPreferencesAutomatically(
    emailAddress: string
  ): Promise<void> {
    if (!emailAddress.trim()) {
      this.preferencesLoaded = true;
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
      this.preferencesLoaded = true;
      return;
    }

    try {
      // Check for approved preferences in tenant_memberships
      const { data: subscriberData, error } = await this.supabase.client
        .from("tenant_memberships")
        .select("*")
        .match(this.membershipPrefs.matchFilter(emailAddress.toLowerCase().trim()))
        .maybeSingle();

      if (error) {
        console.error("Error loading subscriber preferences:", error);
        this.receiveNotifications = true; // Default to true on error
        this.receivePushNotifications = false;
        this.preferencesLoaded = true;
        return;
      }

      if (subscriberData) {
        // User has approved preferences
        if (subscriberData.name && subscriberData.name.trim()) {
          this.name = subscriberData.name;
        }
        this.receiveNotifications = subscriberData.is_active;
        this.receivePushNotifications = subscriberData.receive_push ?? false;
        this.showPrayForButton = subscriberData.show_pray_for_button ?? true;
        this.showPrayingCount = subscriberData.show_praying_count ?? true;
        this.prayerEncouragementUiLoaded = true;
      } else {
        // New user - set defaults (receive_push only becomes true when app installs and registers device token)
        this.receiveNotifications = true;
        this.receivePushNotifications = false;
      }

      this.preferencesLoaded = true;
      this.cdr.markForCheck();
    } catch (err) {
      console.error("Error loading preferences:", err);
      this.receiveNotifications = true; // Default to true on error
      this.receivePushNotifications = false;
      this.preferencesLoaded = true;
    }
  }

  onEmailChange(): void {
    this.emailChange$.next(this.email);
  }

  setReceiveNotifications(enabled: boolean): void {
    if (
      !this.preferencesLoaded ||
      this.savingNotification ||
      this.receiveNotifications === enabled
    ) {
      return;
    }
    if (!this.connectivity.requireOnline('save settings')) {
      return;
    }
    this.receiveNotifications = enabled;
    void this.onNotificationToggle();
  }

  setReceivePushNotifications(enabled: boolean): void {
    if (
      !this.preferencesLoaded ||
      this.savingPushNotification ||
      this.receivePushNotifications === enabled
    ) {
      return;
    }
    if (!this.connectivity.requireOnline('save settings')) {
      return;
    }
    this.receivePushNotifications = enabled;
    void this.onPushNotificationToggle();
  }

  setBadgeFunctionalityEnabled(enabled: boolean): void {
    if (
      !this.badgePreferencesLoaded ||
      this.savingBadge ||
      this.badgeFunctionalityEnabled === enabled
    ) {
      return;
    }
    if (!this.connectivity.requireOnline('save settings')) {
      return;
    }
    this.badgeFunctionalityEnabled = enabled;
    void this.onBadgeFunctionalityToggle();
  }

  setShowPrayForButton(enabled: boolean): void {
    if (
      !this.prayerEncouragementUiLoaded ||
      this.savingShowPrayForButton ||
      this.savingShowPrayingCount ||
      this.showPrayForButton === enabled
    ) {
      return;
    }
    if (!this.connectivity.requireOnline('save settings')) {
      return;
    }
    this.showPrayForButton = enabled;
    void this.onShowPrayForButtonToggle();
  }

  setShowPrayingCount(enabled: boolean): void {
    if (
      !this.prayerEncouragementUiLoaded ||
      this.savingShowPrayForButton ||
      this.savingShowPrayingCount ||
      this.showPrayingCount === enabled
    ) {
      return;
    }
    if (!this.connectivity.requireOnline('save settings')) {
      return;
    }
    this.showPrayingCount = enabled;
    void this.onShowPrayingCountToggle();
  }

  selectDefaultPrayerView(view: "current" | "personal"): void {
    if (
      !this.defaultViewPreferencesLoaded ||
      this.savingDefaultView ||
      this.defaultPrayerView === view
    ) {
      return;
    }
    void this.onDefaultViewChange(view);
  }


  setMemorizationStrictMode(enabled: boolean): void {
    if (
      !this.memorizationStrictModeLoaded ||
      this.savingMemorizationStrictMode ||
      this.memorizationStrictMode === enabled
    ) {
      return;
    }
    this.memorizationStrictMode = enabled;
    void this.onMemorizationStrictModeToggle();
  }

  async onMemorizationStrictModeToggle(): Promise<void> {
    const email = this.email.toLowerCase().trim();
    if (!email) {
      this.error = "Email not found. Please log in again.";
      return;
    }
    const tenantId = this.tenantContext.getActiveTenant()?.id;
    if (!tenantId) {
      this.error = "Select an organization first.";
      this.memorizationStrictMode = !this.memorizationStrictMode;
      return;
    }

    this.savingMemorizationStrictMode = true;
    this.error = null;

    try {
      const result = await this.membershipPrefs.updateOnly(email, {
        memorization_strict_mode: this.memorizationStrictMode,
      });
      if (!result.ok) {
        throw result.error;
      }

      await this.userSessionService.updateUserSession({
        memorizationStrictMode: this.memorizationStrictMode,
      });
    } catch (err) {
      console.error("Error updating memorization strict mode:", err);
      this.error =
        err instanceof Error
          ? err.message
          : "Failed to update memorization practice preference";
      this.memorizationStrictMode = !this.memorizationStrictMode;
    } finally {
      this.savingMemorizationStrictMode = false;
      this.cdr.markForCheck();
    }
  }

  async onNotificationToggle(): Promise<void> {
    // Use the email that was loaded from userSession
    const email = this.email.toLowerCase().trim();

    if (!email) {
      this.error = "Email not found. Please log in again.";
      return;
    }

    this.savingNotification = true;
    this.error = null;
    this.success = null;

    try {
      const result = await this.membershipPrefs.upsert(
        email,
        { is_active: this.receiveNotifications },
        { name: this.name || "" }
      );
      if (!result.ok) {
        throw result.error;
      }

      this.success = `✅ Notifications ${
        this.receiveNotifications ? "enabled" : "disabled"
      } successfully!`;

      // Update UserSessionService cache to keep it in sync
      await this.userSessionService.updateUserSession({
        isActive: this.receiveNotifications ?? true,
      });

      this.savingNotification = false;
      this.cdr.markForCheck();
      this.successNotification = this.receiveNotifications
        ? "✅ Prayer notifications enabled"
        : "✅ Prayer notifications disabled";
      setTimeout(() => {
        this.successNotification = null;
        this.cdr.markForCheck();
      }, 3000);
    } catch (err) {
      console.error("Error updating notification preference:", err);
      this.error =
        err instanceof Error ? err.message : "Failed to update preference";
      this.receiveNotifications = !this.receiveNotifications; // Revert toggle on error
      this.savingNotification = false;
      this.cdr.markForCheck();
    }
  }

  async onPushNotificationToggle(): Promise<void> {
    const email = this.email.toLowerCase().trim();
    if (!email) {
      this.error = "Email not found. Please log in again.";
      return;
    }

    this.savingPushNotification = true;
    this.error = null;
    this.successPushNotification = null;

    try {
      const result = await this.membershipPrefs.upsert(
        email,
        { receive_push: this.receivePushNotifications },
        {
          is_active: this.receiveNotifications ?? true,
          name: this.name || "",
        }
      );
      if (!result.ok) {
        throw result.error;
      }

      await this.userSessionService.updateUserSession({
        receivePush: this.receivePushNotifications ?? false,
      });

      this.successPushNotification = this.receivePushNotifications
        ? "✅ Push notifications enabled"
        : "✅ Push notifications disabled";
      setTimeout(() => {
        this.successPushNotification = null;
        this.cdr.markForCheck();
      }, 3000);
    } catch (err) {
      console.error("Error updating push notification preference:", err);
      this.error =
        err instanceof Error ? err.message : "Failed to update preference";
      this.receivePushNotifications = !this.receivePushNotifications; // Revert toggle on error
      this.cdr.markForCheck();
    } finally {
      this.savingPushNotification = false;
      this.cdr.markForCheck();
    }
  }

  async onBadgeFunctionalityToggle(): Promise<void> {
    const email = this.email.toLowerCase().trim();

    if (!email) {
      this.error = "Email not found. Please log in again.";
      return;
    }

    this.savingBadge = true;
    this.error = null;
    this.success = null;

    try {
      const result = await this.membershipPrefs.upsert(email, {
        badge_functionality_enabled: this.badgeFunctionalityEnabled,
      });
      if (!result.ok) {
        throw result.error;
      }

      // If enabling badge functionality, mark all current items as read
      if (this.badgeFunctionalityEnabled) {
        this.markAllItemsAsRead();
        this.successBadge = "✅ Notification badges enabled";
      } else {
        this.successBadge = "✅ Notification badges disabled";
      }

      // Update UserSessionService cache to keep it in sync (this will trigger BadgeService update)
      await this.userSessionService.updateUserSession({
        badgeFunctionalityEnabled: this.badgeFunctionalityEnabled ?? false,
      });

      this.savingBadge = false;
      this.cdr.markForCheck();

      // Auto-dismiss success message after 3 seconds
      setTimeout(() => {
        this.successBadge = null;
        this.cdr.markForCheck();
      }, 3000);
    } catch (err) {
      console.error("Error updating badge preference:", err);
      this.error =
        err instanceof Error
          ? err.message
          : "Failed to update badge preference";
      this.badgeFunctionalityEnabled = !this.badgeFunctionalityEnabled; // Revert toggle on error
      this.savingBadge = false;
      this.cdr.markForCheck();
    } finally {
      this.savingBadge = false;
      this.cdr.markForCheck();
    }
  }

  async onShowPrayForButtonToggle(): Promise<void> {
    const email = this.email.toLowerCase().trim();
    if (!email) {
      this.error = "Email not found. Please log in again.";
      return;
    }
    const next = this.showPrayForButton ?? true;
    this.savingShowPrayForButton = true;
    this.error = null;
    this.successPrayerEncouragementUi = null;

    try {
      const result = await this.membershipPrefs.upsert(
        email,
        { show_pray_for_button: next },
        { name: this.name || "" }
      );
      if (!result.ok) {
        throw result.error;
      }

      await this.userSessionService.updateUserSession({
        showPrayForButton: next,
      });
      this.successPrayerEncouragementUi = next
        ? "Pray For button shown on cards"
        : "Pray For button hidden on cards";
      setTimeout(() => {
        this.successPrayerEncouragementUi = null;
        this.cdr.markForCheck();
      }, 3000);
    } catch (err) {
      console.error("Error updating show Pray For preference:", err);
      this.error =
        err instanceof Error ? err.message : "Failed to update preference";
      this.showPrayForButton = !next;
    } finally {
      this.savingShowPrayForButton = false;
      this.cdr.markForCheck();
    }
  }

  async onShowPrayingCountToggle(): Promise<void> {
    const email = this.email.toLowerCase().trim();
    if (!email) {
      this.error = "Email not found. Please log in again.";
      return;
    }
    const next = this.showPrayingCount ?? true;
    this.savingShowPrayingCount = true;
    this.error = null;
    this.successPrayerEncouragementUi = null;

    try {
      const result = await this.membershipPrefs.upsert(
        email,
        { show_praying_count: next },
        { name: this.name || "" }
      );
      if (!result.ok) {
        throw result.error;
      }

      await this.userSessionService.updateUserSession({
        showPrayingCount: next,
      });
      this.successPrayerEncouragementUi = next
        ? "Praying count shown when available"
        : "Praying count hidden on cards";
      setTimeout(() => {
        this.successPrayerEncouragementUi = null;
        this.cdr.markForCheck();
      }, 3000);
    } catch (err) {
      console.error("Error updating show praying count preference:", err);
      this.error =
        err instanceof Error ? err.message : "Failed to update preference";
      this.showPrayingCount = !next;
    } finally {
      this.savingShowPrayingCount = false;
      this.cdr.markForCheck();
    }
  }

    async onDefaultViewChange(newView: "current" | "personal"): Promise<void> {
    const email = this.email.toLowerCase().trim();

    if (!email) {
      this.error = "Email not found. Please log in again.";
      return;
    }

    if (!this.connectivity.requireOnline('save settings')) {
      return;
    }

    this.defaultPrayerView = newView;
    this.savingDefaultView = true;
    this.error = null;
    this.success = null;

    try {
      const result = await this.membershipPrefs.upsert(email, {
        default_prayer_view: newView,
      });
      if (!result.ok) {
        throw result.error;
      }

      this.successDefaultView = `✅ Default view set to ${
        newView === "current" ? "Current Prayers" : "Personal Prayers"
      }`;

      // Update UserSessionService cache to keep it in sync
      await this.userSessionService.updateUserSession({
        defaultPrayerView: newView,
      });

      this.savingDefaultView = false;
      this.cdr.markForCheck();

      // Auto-dismiss success message after 3 seconds
      setTimeout(() => {
        this.successDefaultView = null;
        this.cdr.markForCheck();
      }, 3000);
    } catch (err) {
      console.error("Error updating default view preference:", err);
      this.error =
        err instanceof Error
          ? err.message
          : "Failed to update default view preference";
      this.defaultPrayerView =
        this.defaultPrayerView === "current" ? "personal" : "current"; // Revert on error
      this.savingDefaultView = false;
      this.cdr.markForCheck();
    }
  }

  private markAllItemsAsRead(): void {
    try {
      // Get all prayers and prompts from cache
      const prayersCache = localStorage.getItem("prayers_cache");
      const promptsCache = localStorage.getItem("prompts_cache");

      // Mark all prayers as read
      if (prayersCache) {
        const parsedCache = JSON.parse(prayersCache);
        const prayers = parsedCache?.data || parsedCache || [];
        if (Array.isArray(prayers)) {
          const prayerIds = prayers.map((p: any) => p.id);
          const updateIds = prayers.flatMap(
            (p: any) => p.updates?.map((u: any) => u.id) || []
          );

          const readData = localStorage.getItem("read_prayers_data");
          const data = readData
            ? JSON.parse(readData)
            : { prayers: [], updates: [] };
          data.prayers = Array.from(new Set([...data.prayers, ...prayerIds]));
          data.updates = Array.from(new Set([...data.updates, ...updateIds]));
          localStorage.setItem("read_prayers_data", JSON.stringify(data));
        }
      }

      // Mark all prompts as read
      if (promptsCache) {
        const parsedCache = JSON.parse(promptsCache);
        const prompts = parsedCache?.data || parsedCache || [];
        if (Array.isArray(prompts)) {
          const promptIds = prompts.map((p: any) => p.id);
          const updateIds = prompts.flatMap(
            (p: any) => p.updates?.map((u: any) => u.id) || []
          );

          const readData = localStorage.getItem("read_prompts_data");
          const data = readData
            ? JSON.parse(readData)
            : { prompts: [], updates: [] };
          data.prompts = Array.from(new Set([...data.prompts, ...promptIds]));
          data.updates = Array.from(new Set([...data.updates, ...updateIds]));
          localStorage.setItem("read_prompts_data", JSON.stringify(data));
        }
      }

      // Refresh badge counts
      this.badgeService.refreshBadgeCounts();
    } catch (err) {
      console.error("Error marking all items as read:", err);
    }
  }

  private getUserInfo(): {
    firstName: string;
    lastName: string;
    email: string;
  } {
    return getUserInfo();
  }

  getCurrentUserEmail(): string {
    const userInfo = this.getUserInfo();
    return userInfo.email || this.email || "";
  }

  getCurrentUserName(): string {
    // First try to use the name property which is updated from localStorage and database
    if (this.name) {
      return this.name;
    }

    // Fallback to getUserInfo from localStorage
    const userInfo = this.getUserInfo();
    const firstName = userInfo.firstName || "";
    const lastName = userInfo.lastName || "";
    return (firstName + (lastName ? " " + lastName : "")).trim();
  }

  async logout(): Promise<void> {
    await this.adminAuthService.logout();
  }

  closeDeleteAccountVerification(): void {
    if (!this.deletingAccount) {
      this.showDeleteAccountVerification = false;
      this.error = null;
      this.cdr.markForCheck();
    }
  }

  async deleteAccountKeepPrayers(): Promise<void> {
    const email =
      this.email?.toLowerCase?.()?.trim?.() || this.email?.trim?.() || "";
    if (!email) {
      this.error = "Could not determine your email. Please try again.";
      this.cdr.markForCheck();
      return;
    }
    this.deletingAccount = true;
    this.error = null;
    this.cdr.markForCheck();
    try {
      const { error } = await this.supabase.client
        .from("tenant_memberships")
        .delete()
        .match(this.membershipPrefs.matchFilter(email));
      if (error) throw error;
      this.showDeleteAccountVerification = false;
      this.deletingAccount = false;
      this.cdr.markForCheck();
      await this.logout();
    } catch (err) {
      this.deletingAccount = false;
      this.error = "Could not delete account. Please try again.";
      this.showDeleteAccountVerification = false;
      this.cdr.markForCheck();
    }
  }

  async deleteAccountAndPrayers(): Promise<void> {
    const email =
      this.email?.toLowerCase?.()?.trim?.() || this.email?.trim?.() || "";
    if (!email) {
      this.error = "Could not determine your email. Please try again.";
      this.cdr.markForCheck();
      return;
    }
    this.deletingAccount = true;
    this.error = null;
    this.cdr.markForCheck();
    try {
      const client = this.supabase.client;
      const { error: err1 } = await client
        .from("prayer_updates")
        .delete()
        .eq("author_email", email);
      if (err1) throw err1;
      const { error: err2 } = await client
        .from("prayers")
        .delete()
        .eq("email", email);
      if (err2) throw err2;
      const { error: err3 } = await client
        .from("personal_prayers")
        .delete()
        .eq("user_email", email);
      if (err3) throw err3;
      const { error: err4 } = await client
        .from("tenant_memberships")
        .delete()
        .match(this.membershipPrefs.matchFilter(email));
      if (err4) throw err4;
      this.showDeleteAccountVerification = false;
      this.deletingAccount = false;
      this.cdr.markForCheck();
      await this.logout();
    } catch (err) {
      this.deletingAccount = false;
      this.error = "Could not delete account. Please try again.";
      this.showDeleteAccountVerification = false;
      this.cdr.markForCheck();
    }
  }
}
