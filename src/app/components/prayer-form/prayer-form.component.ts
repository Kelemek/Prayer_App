import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  ChangeDetectorRef,
  HostListener,
  ChangeDetectionStrategy,
  ViewChild,
  DestroyRef,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import { Observable, Subject, takeUntil } from "rxjs";
import type { User } from "@supabase/supabase-js";
import { PrayerService } from "../../services/prayer.service";
import { AdminAuthService } from "../../services/admin-auth.service";
import { UserSessionService } from "../../services/user-session.service";
import { resolveAuthorName } from "../../utils/display-name";
import { SupabaseService } from "../../services/supabase.service";
import { ToastService } from "../../services/toast.service";
import { TenantContextService } from "../../services/tenant-context.service";
import { RichTextEditorsSettingsService } from "../../services/rich-text-editors-settings.service";
import { PersonalCategoryColorService } from "../../services/personal-category-color.service";
import { PersonalCategoryColorPickerComponent } from "../personal-category-color-picker/personal-category-color-picker.component";
import { RichTextEditorComponent } from "../rich-text-editor/rich-text-editor.component";
import { ModalShellComponent } from "../modal-shell/modal-shell.component";
import {
  EMPTY_PRAYER_FORM_FIELDS,
  buildPrayerFormSubmitPayload,
  submitPrayerFormRequest,
} from "../../lib/prayer-form-submit";
import {
  filterPersonalPrayerCategories,
  nextCategorySelectionIndex,
  prayerFormCategoryKeyAction,
} from "../../lib/prayer-form-category";

@Component({
  selector: "app-prayer-form",
  standalone: true,
  imports: [FormsModule, NgClass, RichTextEditorComponent, ModalShellComponent, PersonalCategoryColorPickerComponent],
  template: `
    @if (isOpen) {
    <app-modal-shell
      title="New Prayer Request"
      titleId="prayer-form-title"
      closeAriaLabel="Close prayer form dialog"
      (close)="cancel()"
    >
        <form
          #prayerForm="ngForm"
          (ngSubmit)="prayerForm.valid && handleSubmit()"
          class="p-6 space-y-4"
        >
          <!-- Success Message -->
          @if (showSuccessMessage) {
          <div
            class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div
              class="flex items-center gap-2 text-green-800 dark:text-green-200"
            >
              <div
                class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0"
              >
                <div class="w-2 h-2 bg-white rounded-full"></div>
              </div>
              <div>
                <p class="font-medium">
                  Prayer request submitted successfully!
                </p>
                <p class="text-sm text-green-600 dark:text-green-300">
                  Your request is pending admin approval and will appear in the
                  list once reviewed.
                </p>
              </div>
            </div>
          </div>
          }

          <!-- Prayer For -->
          <div>
            <label
              for="prayer_for"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Prayer For <span aria-label="required">*</span>
            </label>
            <input
              type="text"
              id="prayer_for"
              [(ngModel)]="formData.prayer_for"
              name="prayer_for"
              required
              aria-required="true"
              aria-label="Prayer For"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-inset-surface text-gray-900 dark:text-gray-100"
              placeholder="Who or what this prayer is for"
            />
          </div>

          <!-- Description -->
          <div>
            <label
              for="description"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Prayer Request Details <span aria-label="required">*</span>
            </label>
            @if (richTextEditorsEnabled) {
            <app-rich-text-editor
              #descriptionEditor
              [(ngModel)]="formData.description"
              name="description"
              ngDefaultControl
              required
              ariaLabel="Prayer Request Details"
              placeholder="Describe the prayer request in detail"
              minHeight="6rem"
            ></app-rich-text-editor>
            } @else {
            <textarea
              id="description"
              name="description"
              [(ngModel)]="formData.description"
              required
              rows="8"
              aria-label="Prayer Request Details"
              placeholder="Describe the prayer request in detail"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-inset-surface text-gray-900 dark:text-gray-100 min-h-[6rem] whitespace-pre-wrap"
            ></textarea>
            }
          </div>

          <!-- Prayer Visibility Toggle Buttons -->
          <div class="space-y-2">
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Prayer Visibility
            </label>
            <div class="grid grid-cols-2 gap-3">
              <!-- Public Prayer Button -->
              <button
                type="button"
                (click)="formData.is_personal = false"
                [class.ring-2]="!formData.is_personal"
                class="relative flex flex-col items-center justify-start py-3 px-4 rounded-lg border-2 transition-all font-medium cursor-pointer text-left"
                [ngClass]="
                  !formData.is_personal
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-blue-500 dark:ring-blue-400 ring-offset-2 dark:ring-offset-gray-800'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
                "
                aria-pressed="!formData.is_personal"
                aria-label="Select public prayer - requires admin approval"
              >
                <div class="flex items-center justify-center gap-2 text-left">
                  <svg
                    class="hidden sm:block w-6 h-6 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <div class="text-left min-w-0">
                    <div class="text-sm sm:text-base font-semibold">
                      Public Prayer
                    </div>
                    <div class="text-xs opacity-75">Pending admin approval</div>
                  </div>
                </div>
              </button>

              <!-- Personal Prayer Button -->
              <button
                type="button"
                (click)="formData.is_personal = true"
                [class.ring-2]="formData.is_personal"
                class="relative flex flex-col items-center justify-start py-3 px-4 rounded-lg border-2 transition-all font-medium cursor-pointer text-left"
                [ngClass]="
                  formData.is_personal
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-blue-500 dark:ring-blue-400 ring-offset-2 dark:ring-offset-gray-800'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
                "
                aria-pressed="formData.is_personal"
                aria-label="Select personal prayer - private, no approval needed"
              >
                <div class="flex items-center justify-center gap-2 text-left">
                  <svg
                    class="hidden sm:block w-6 h-6 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <div class="text-left min-w-0">
                    <div class="text-sm sm:text-base font-semibold">
                      Personal Prayer
                    </div>
                    <div class="text-xs opacity-75">Private, no approval</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          @if (publicPrayerBlockedReason) {
          <div
            class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100"
            role="alert"
          >
            {{ publicPrayerBlockedReason }}
          </div>
          }

          <!-- Anonymous Checkbox - only show for public prayers -->
          @if (!formData.is_personal) {
          <div class="flex items-center cursor-pointer">
            <input
              type="checkbox"
              [(ngModel)]="formData.is_anonymous"
              name="is_anonymous"
              id="is_anonymous"
              class="w-4 h-4 text-blue-600 border-gray-900 dark:border-white rounded focus:ring-blue-500 bg-white dark:bg-gray-800"
            />
            <label
              for="is_anonymous"
              class="ml-2 text-sm text-gray-700 dark:text-gray-300"
            >
              Make this prayer anonymous (your name will not be shown publicly)
            </label>
          </div>
          }

          <!-- Category Field - only show for personal prayers -->
          @if (formData.is_personal) {
          <div class="relative">
            <label
              for="category"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Category
              <span class="text-gray-500 dark:text-gray-400"
                >(optional, {{ formData.category.length }}/50 characters
                max)</span
              >
            </label>
            <div class="space-y-2">
              <div class="relative min-w-0">
            <input
              type="text"
              id="category"
              [(ngModel)]="formData.category"
              name="category"
              autocomplete="off"
              maxlength="50"
              aria-label="Prayer category"
              (focus)="showCategoryDropdown = true"
              (input)="onCategoryInput($event)"
              (keydown)="onCategoryKeyDown($event)"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-inset-surface text-gray-900 dark:text-gray-100"
              placeholder="e.g., Health, Family, Work (or create a new category)"
            />
            <!-- Category Dropdown -->
            @if (showCategoryDropdown && filteredCategories.length > 0) {
            <div
              class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto"
            >
              @for (category of filteredCategories; track category; let i =
              $index) {
              <button
                type="button"
                (click)="selectCategory(category)"
                [class.bg-blue-100]="i === selectedCategoryIndex"
                [class.dark:bg-gray-600]="i === selectedCategoryIndex"
                class="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:bg-blue-100 dark:focus:bg-gray-600 transition-colors cursor-pointer"
              >
                {{ category }}
              </button>
              }
            </div>
            }
              </div>
              @if (formData.category.trim()) {
              <app-personal-category-color-picker
                layout="inline"
                [color]="categoryColor"
                [categoryLabel]="formData.category"
                (colorChange)="onCategoryColorChange($event)"
              />
              }
            </div>
          </div>
          }

          <!-- Buttons -->
          <div class="flex justify-end pt-4">
            <button
              type="submit"
              [disabled]="
                !prayerForm.valid ||
                !isFormValid() ||
                isSubmitting ||
                showSuccessMessage
              "
              [title]="
                !isFormValid() && prayerForm.valid ? submitBlockedTitle : null
              "
              class="min-h-11 px-6 py-2.5 text-base font-medium btn-chip btn-chip-blue disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              aria-label="Submit prayer request"
            >
              {{
                isSubmitting
                  ? "Submitting..."
                  : showSuccessMessage
                  ? "Submitted"
                  : "Submit Prayer Request"
              }}
            </button>
          </div>
        </form>
    </app-modal-shell>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [],
})
export class PrayerFormComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild("descriptionEditor") descriptionEditor?: RichTextEditorComponent;

  @Input() isOpen = false;
  /** When true and the modal opens, default to Personal Prayer. */
  @Input() defaultPersonalPrayer = false;
  @Output() close = new EventEmitter<{ isPersonal?: boolean }>();

  formData: {
    title: string;
    description: string;
    prayer_for: string;
    is_anonymous: boolean;
    is_personal: boolean;
    category: string;
  } = {
    title: "",
    description: "",
    prayer_for: "",
    is_anonymous: false,
    is_personal: false,
    category: "",
  };

  isSubmitting = false;
  showSuccessMessage = false;
  richTextEditorsEnabled = true;
  isAdmin = false;
  currentUserEmail = "";
  availableCategories: string[] = [];
  filteredCategories: string[] = [];
  selectedCategoryIndex = -1;
  showCategoryDropdown = false;
  categoryColor = '#2563EB';
  private categoryColorDirty = false;
  user$!: Observable<User | null>;
  private destroy$ = new Subject<void>();

  constructor(
    private prayerService: PrayerService,
    private adminAuthService: AdminAuthService,
    private userSessionService: UserSessionService,
    private supabase: SupabaseService,
    private toast: ToastService,
    private personalCategoryColorService: PersonalCategoryColorService,
    private cdr: ChangeDetectorRef,
    private tenantContext: TenantContextService,
    private destroyRef: DestroyRef,
    richTextEditorsSettings: RichTextEditorsSettingsService
  ) {
    richTextEditorsSettings
      .getRichTextEditorsEnabled$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        this.richTextEditorsEnabled = v;
        this.cdr.markForCheck();
      });
  }

  ngOnInit(): void {
    this.refreshCurrentUserEmail();
    this.userSessionService.userSession$
      .pipe(takeUntil(this.destroy$))
      .subscribe((session) => {
        this.currentUserEmail = session?.email?.trim() || "";
        this.cdr.markForCheck();
      });
    this.user$ = this.adminAuthService.user$;
    this.adminAuthService.isAdmin$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isAdmin) => {
        this.isAdmin = isAdmin;
      });
    // Load available categories for personal prayers
    this.prayerService.getUniqueCategoriesForUser().then((cats) => {
      this.availableCategories = cats;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["isOpen"]?.currentValue === true) {
      this.formData.is_personal = this.defaultPersonalPrayer;
    }
    if (this.isOpen) {
      this.refreshCurrentUserEmail();
      this.categoryColorDirty = false;
      this.prayerService.getUniqueCategoriesForUser().then((cats) => {
        this.availableCategories = cats;
      });
      void this.personalCategoryColorService.loadColors();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private refreshCurrentUserEmail(): void {
    this.currentUserEmail =
      this.userSessionService.getUserEmail()?.trim() ||
      this.userSessionService.getCurrentSession()?.email?.trim() ||
      "";
  }

  /** Public prayers require an active tenant with a groups or churches plan (RLS). */
  get publicPrayerBlockedReason(): string | null {
    if (this.formData.is_personal) return null;
    const tenant = this.tenantContext.getActiveTenant();
    if (!tenant) {
      return "Public prayers require an active organization. Open Tenant Management (admin) or pick an organization you belong to, then try again.";
    }
    if (tenant.plan_tier === "free") {
      return "Public prayers are not available on the free plan for this organization. Use a personal prayer, or ask an admin to upgrade the tenant to groups or churches.";
    }
    return null;
  }

  get submitBlockedTitle(): string {
    return (
      this.publicPrayerBlockedReason || "Complete required fields to submit."
    );
  }

  private saveUserInfo(): void {
    // Names are no longer saved - they come from localStorage managed by home component
  }

  private getCurrentUserName(): string {
    const firstName = localStorage.getItem("prayerapp_user_first_name") || "";
    const lastName = localStorage.getItem("prayerapp_user_last_name") || "";
    return `${firstName} ${lastName}`.trim();
  }

  isFormValid(): boolean {
    const base =
      !!this.currentUserEmail.trim() &&
      !!this.formData.prayer_for.trim() &&
      !!this.formData.description.trim();
    if (!base) return false;
    if (this.formData.is_personal) return true;
    const tenant = this.tenantContext.getActiveTenant();
    if (!tenant) return false;
    if (tenant.plan_tier === "free") return false;
    return true;
  }

  onCategoryInput(event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    this.formData.category = input;
    this.syncCategoryColorForInput(input);
    this.updateFilteredCategories();
    // Show dropdown if there are filtered results
    if (this.filteredCategories.length > 0) {
      this.showCategoryDropdown = true;
    }
  }

  private updateFilteredCategories(): void {
    this.filteredCategories = filterPersonalPrayerCategories(
      this.availableCategories,
      this.formData.category
    );
    this.selectedCategoryIndex = -1;
  }

  selectCategory(category: string): void {
    this.formData.category = category;
    this.categoryColor = this.personalCategoryColorService.getColor(category);
    this.categoryColorDirty = false;
    this.showCategoryDropdown = false;
    this.filteredCategories = [];
    this.selectedCategoryIndex = -1;
    this.cdr.markForCheck();
  }

  onCategoryKeyDown(event: KeyboardEvent): void {
    const action = prayerFormCategoryKeyAction(
      event.key,
      this.showCategoryDropdown,
      this.filteredCategories,
      this.selectedCategoryIndex
    );
    if (action.type === "noop") {
      if (
        event.key === "Enter" &&
        (!this.showCategoryDropdown || this.filteredCategories.length === 0)
      ) {
        event.preventDefault();
      }
      return;
    }

    event.preventDefault();
    this.selectedCategoryIndex = nextCategorySelectionIndex(
      action,
      this.selectedCategoryIndex,
      this.filteredCategories.length
    );
    switch (action.type) {
      case "move-down":
      case "move-up":
        break;
      case "select":
        this.selectCategory(action.category);
        break;
      case "close":
        this.showCategoryDropdown = false;
        break;
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
    this.cdr.markForCheck();
  }

  async handleSubmit(): Promise<void> {
    if (this.isSubmitting) return;
    if (!this.isFormValid()) {
      const msg =
        this.publicPrayerBlockedReason ||
        (!this.currentUserEmail.trim()
          ? "Your email could not be loaded. Refresh the page or sign in again."
          : null);
      if (msg) this.toast.error(msg);
      return;
    }

    try {
      this.descriptionEditor?.flushMarkdownToForm();
      this.isSubmitting = true;
      this.cdr.markForCheck();

      // Get user name from UserSessionService cache
      const userSession = this.userSessionService.getCurrentSession();
      const fullName = resolveAuthorName(
        userSession?.fullName || this.getCurrentUserName(),
        this.currentUserEmail
      );

      const prayerData = buildPrayerFormSubmitPayload(
        this.formData,
        this.currentUserEmail,
        fullName
      );

      await this.submitPrayer(prayerData);
    } catch (error) {
      console.error("Failed to initiate prayer submission:", error);
      this.isSubmitting = false;
      this.cdr.markForCheck();
      this.toast.error("Failed to submit prayer request. Please try again.");
    }
  }

  private async submitPrayer(
    prayerData: ReturnType<typeof buildPrayerFormSubmitPayload>
  ): Promise<void> {
    try {
      const result = await submitPrayerFormRequest(
        this.prayerService,
        this.personalCategoryColorService,
        this.formData,
        prayerData,
        this.categoryColor,
        this.categoryColorDirty
      );

      if (result.ok) {
        this.showSuccessMessage = true;
        this.cdr.markForCheck();

        this.close.emit({ isPersonal: result.isPersonal });

        this.formData = { ...EMPTY_PRAYER_FORM_FIELDS };
        this.categoryColor = '#2563EB';
        this.categoryColorDirty = false;

        setTimeout(() => {
          this.showSuccessMessage = false;
          this.cdr.markForCheck();
        }, 5000);
      }
    } catch (error) {
      console.error("Failed to add prayer:", error);
      throw error;
    } finally {
      this.isSubmitting = false;
      this.cdr.markForCheck();
    }
  }

  cancel(): void {
    this.formData = { ...EMPTY_PRAYER_FORM_FIELDS };
    this.showSuccessMessage = false;
    this.isSubmitting = false;
    this.showCategoryDropdown = false;
    this.categoryColor = '#2563EB';
    this.categoryColorDirty = false;
    this.close.emit();
  }

  onCategoryColorChange(color: string): void {
    this.categoryColor = color;
    this.categoryColorDirty = true;
    this.cdr.markForCheck();
  }

  private syncCategoryColorForInput(category: string): void {
    const trimmed = category.trim();
    if (!trimmed) {
      return;
    }
    this.categoryColor = this.personalCategoryColorService.getColor(trimmed);
    this.categoryColorDirty = false;
    this.cdr.markForCheck();
  }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    if (this.showCategoryDropdown) {
      const target = event.target as HTMLElement;
      // Close dropdown if click is outside the category input area
      if (
        !target.closest("#category") &&
        !target.closest('[class*="dropdown"]')
      ) {
        this.showCategoryDropdown = false;
        this.cdr.markForCheck();
      }
    }
  }
}
