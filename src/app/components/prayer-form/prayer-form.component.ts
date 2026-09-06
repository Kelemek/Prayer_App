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
  ElementRef,
  DestroyRef,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { NgClass, NgStyle } from "@angular/common";
import { Observable, Subject, takeUntil } from "rxjs";
import type { User } from "@supabase/supabase-js";
import { PrayerService } from "../../services/prayer.service";
import { AdminAuthService } from "../../services/admin-auth.service";
import { UserSessionService } from "../../services/user-session.service";
import { resolveAuthorName } from "../../utils/display-name";
import { SupabaseService } from "../../services/supabase.service";
import { ToastService } from "../../services/toast.service";
import { TenantContextService } from "../../services/tenant-context.service";
import { TenantPermissionService } from "../../services/tenant-permission.service";
import { PrayerGroupService } from "../../services/prayer-group.service";
import type { PrayerGroup } from "../../types/prayer-group";
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
  isNodeInsidePersonalCategoryField,
  nextCategorySelectionIndex,
  prayerFormCategoryKeyAction,
} from "../../lib/prayer-form-category";
import {
  ANCHORED_FIXED_DROPDOWN_MAX_HEIGHT,
  buildAnchoredFixedDropdownStyleFromTrigger,
} from "../../lib/fixed-popover-placement";

@Component({
  selector: "app-prayer-form",
  standalone: true,
  imports: [FormsModule, NgClass, NgStyle, RichTextEditorComponent, ModalShellComponent, PersonalCategoryColorPickerComponent],
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
              #prayerForInput
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
            <div [class]="visibilityGridClass">
              @if (showPublicOption) {
              <button
                type="button"
                (click)="setVisibility('public')"
                [class.ring-2]="visibility === 'public'"
                class="relative flex flex-col items-center justify-start py-3 px-4 rounded-lg border-2 transition-all font-medium cursor-pointer text-left"
                [ngClass]="
                  visibility === 'public'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-blue-500 dark:ring-blue-400 ring-offset-2 dark:ring-offset-gray-800'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
                "
                aria-pressed="visibility === 'public'"
                aria-label="Select church prayer - requires admin approval"
              >
                <div class="flex items-center justify-center gap-2 text-left">
                  <div class="text-left min-w-0">
                    <div class="text-sm sm:text-base font-semibold">
                      Church Prayer
                    </div>
                    <div class="text-xs opacity-75">Pending admin approval</div>
                  </div>
                </div>
              </button>
              }
              @if (showGroupOption) {
              <button
                type="button"
                (click)="setVisibility('group')"
                [class.ring-2]="visibility === 'group'"
                class="relative flex flex-col items-center justify-start py-3 px-4 rounded-lg border-2 transition-all font-medium cursor-pointer text-left"
                [ngClass]="
                  visibility === 'group'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-blue-500 dark:ring-blue-400 ring-offset-2 dark:ring-offset-gray-800'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
                "
                aria-pressed="visibility === 'group'"
                aria-label="Select group prayer - visible to group members, no approval"
              >
                <div class="flex items-center justify-center gap-2 text-left">
                  <div class="text-left min-w-0">
                    <div class="text-sm sm:text-base font-semibold">
                      Group Prayer
                    </div>
                    <div class="text-xs opacity-75">Group, no approval</div>
                  </div>
                </div>
              </button>
              }
              <button
                type="button"
                (click)="setVisibility('personal')"
                [class.ring-2]="visibility === 'personal'"
                class="relative flex flex-col items-center justify-start py-3 px-4 rounded-lg border-2 transition-all font-medium cursor-pointer text-left"
                [ngClass]="
                  visibility === 'personal'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-blue-500 dark:ring-blue-400 ring-offset-2 dark:ring-offset-gray-800'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
                "
                aria-pressed="visibility === 'personal'"
                aria-label="Select personal prayer - private, no approval needed"
              >
                <div class="flex items-center justify-center gap-2 text-left">
                  <div class="text-left min-w-0">
                    <div class="text-sm sm:text-base font-semibold">
                      Personal Prayer
                    </div>
                    <div class="text-xs opacity-75">Private, no approval</div>
                  </div>
                </div>
              </button>
            </div>
            @if (visibility === 'group' && groups.length > 0) {
            <div class="space-y-2">
              <span
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Group
              </span>
              <div class="relative">
                <div
                  data-group-dropdown-field
                  [ngClass]="{
                    'border-blue-500 ring-2 ring-blue-500 bg-white dark:bg-gray-800':
                      showGroupDropdown,
                    'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600':
                      !showGroupDropdown
                  }"
                  class="flex w-full rounded-lg border-2 transition-all overflow-hidden"
                >
                  <button
                    type="button"
                    id="prayer-form-group-trigger"
                    data-group-dropdown-trigger
                    (click)="toggleGroupDropdown($event)"
                    [attr.aria-expanded]="showGroupDropdown"
                    aria-haspopup="listbox"
                    aria-label="Group"
                    class="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm transition-all cursor-pointer text-left focus:outline-none"
                  >
                    <span
                      class="font-medium truncate"
                      [class.text-gray-500]="!selectedGroupId"
                      [class.dark:text-gray-400]="!selectedGroupId"
                      [class.text-gray-800]="!!selectedGroupId"
                      [class.dark:text-gray-100]="!!selectedGroupId"
                    >
                      {{ selectedGroupLabel }}
                    </span>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-gray-600 dark:text-gray-400 transition-transform shrink-0"
                      [class.rotate-180]="showGroupDropdown"
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            }
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
          @if (visibility === 'public') {
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
          @if (visibility === 'personal') {
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
              <div class="relative min-w-0" data-personal-category-field>
            <input
              type="text"
              id="category"
              [(ngModel)]="formData.category"
              name="category"
              autocomplete="off"
              maxlength="50"
              aria-label="Prayer category"
              (focus)="onCategoryFocus()"
              (blur)="onCategoryBlur($event)"
              (input)="onCategoryInput($event)"
              (keydown)="onCategoryKeyDown($event)"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-inset-surface text-gray-900 dark:text-gray-100"
              placeholder="e.g., Health, Family, Work (or create a new category)"
            />
            <!-- Category Dropdown -->
            @if (showCategoryDropdown && filteredCategories.length > 0) {
            <div
              data-personal-category-suggestions
              class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto"
              (mousedown)="$event.preventDefault()"
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
    @if (showGroupDropdown) {
    <div
      #groupDropdownBackdrop
      class="fixed inset-0 z-modal-dropdown-backdrop"
      (click)="closeGroupDropdown()"
    ></div>
    <div
      #groupDropdownPanel
      role="listbox"
      aria-label="Group"
      data-group-dropdown-panel
      class="fixed z-modal-dropdown-panel bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 overflow-y-auto"
      [ngStyle]="groupDropdownPanelStyle"
    >
      @for (group of groups; track group.id) {
      <button
        type="button"
        role="option"
        [attr.aria-selected]="selectedGroupId === group.id"
        (click)="selectGroup(group.id)"
        class="flex w-full cursor-pointer items-center justify-between px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        [class.bg-blue-50]="selectedGroupId === group.id"
        [class.dark:bg-blue-900/30]="selectedGroupId === group.id"
      >
        <span>{{ group.name }}</span>
        @if (selectedGroupId === group.id) {
        <span class="ml-2 shrink-0 text-blue-600 dark:text-blue-400">✓</span>
        }
      </button>
      }
    </div>
    }
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [],
})
export class PrayerFormComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild("descriptionEditor") descriptionEditor?: RichTextEditorComponent;

  @ViewChild("prayerForInput")
  set prayerForInput(ref: ElementRef<HTMLInputElement> | undefined) {
    this.prayerForInputRef = ref;
    this.focusPrayerForInputIfNeeded();
  }

  @Input() isOpen = false;
  /** When true and the modal opens, default to Personal Prayer. */
  @Input() defaultPersonalPrayer = false;
  @Input() defaultGroupPrayer = false;
  @Input() defaultGroupId: string | null = null;
  @Output() close = new EventEmitter<{ isPersonal?: boolean }>();

  visibility: "public" | "group" | "personal" = "public";
  selectedGroupId: string | null = null;

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
  showGroupDropdown = false;
  groupDropdownPanelStyle: Record<string, string> = {};
  private groupDropdownTrigger: HTMLElement | null = null;
  categoryColor = '#2563EB';
  private categoryColorDirty = false;
  user$!: Observable<User | null>;
  private destroy$ = new Subject<void>();
  private prayerForInputRef?: ElementRef<HTMLInputElement>;
  private shouldFocusPrayerForInput = false;

  constructor(
    private prayerService: PrayerService,
    private adminAuthService: AdminAuthService,
    private userSessionService: UserSessionService,
    private supabase: SupabaseService,
    private toast: ToastService,
    private personalCategoryColorService: PersonalCategoryColorService,
    private cdr: ChangeDetectorRef,
    private tenantContext: TenantContextService,
    private tenantPermission: TenantPermissionService,
    private prayerGroupService: PrayerGroupService,
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
    this.bindCategoryDropdownOutsideClose();
  }

  ngOnInit(): void {
    this.refreshCurrentUserEmail();
    this.userSessionService.userSession$
      .pipe(takeUntil(this.destroy$))
      .subscribe((session) => {
        this.currentUserEmail = session?.email?.trim() || "";
        this.cdr.markForCheck();
      });
    this.loadAvailableCategories();
    this.user$ = this.adminAuthService.user$;
    this.adminAuthService.isAdmin$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isAdmin) => {
        this.isAdmin = isAdmin;
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["isOpen"]) {
      this.closeGroupDropdown();
      if (changes["isOpen"].currentValue === true) {
        this.shouldFocusPrayerForInput = true;
        this.applyDefaultVisibility();
        this.focusPrayerForInputIfNeeded();
      }
    }
    if (this.isOpen) {
      this.refreshCurrentUserEmail();
      this.categoryColorDirty = false;
      this.loadAvailableCategories();
      void this.personalCategoryColorService.loadColors();
    }
  }

  @ViewChild("groupDropdownBackdrop")
  set groupDropdownBackdrop(ref: ElementRef<HTMLElement> | undefined) {
    if (ref) {
      document.body.appendChild(ref.nativeElement);
    }
  }

  @ViewChild("groupDropdownPanel")
  set groupDropdownPanel(ref: ElementRef<HTMLElement> | undefined) {
    if (!ref || !this.groupDropdownTrigger) {
      return;
    }
    document.body.appendChild(ref.nativeElement);
    this.groupDropdownPanelStyle =
      buildAnchoredFixedDropdownStyleFromTrigger(
        this.groupDropdownTrigger,
        ref.nativeElement.offsetHeight || this.estimateGroupDropdownHeight()
      );
  }

  private loadAvailableCategories(): void {
    this.prayerService.getUniqueCategoriesForUser().then((cats) => {
      this.availableCategories = cats;
      if (this.showCategoryDropdown) {
        this.updateFilteredCategories();
        this.showCategoryDropdown = this.filteredCategories.length > 0;
      }
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.closeGroupDropdown();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private focusPrayerForInputIfNeeded(): void {
    if (!this.shouldFocusPrayerForInput || !this.isOpen) {
      return;
    }
    const input = this.prayerForInputRef?.nativeElement;
    if (!input) {
      return;
    }
    this.shouldFocusPrayerForInput = false;
    requestAnimationFrame(() => {
      input.focus({ preventScroll: true });
    });
  }

  private refreshCurrentUserEmail(): void {
    this.currentUserEmail =
      this.userSessionService.getUserEmail()?.trim() ||
      this.userSessionService.getCurrentSession()?.email?.trim() ||
      "";
  }

  get groups(): PrayerGroup[] {
    return this.prayerGroupService.getGroups();
  }

  get showPublicOption(): boolean {
    return this.tenantPermission.canAccessShared();
  }

  get showGroupOption(): boolean {
    return this.groups.length > 0;
  }

  get visibilityGridClass(): string {
    const count =
      1 + (this.showPublicOption ? 1 : 0) + (this.showGroupOption ? 1 : 0);
    return count >= 3 ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3";
  }

  get selectedGroupLabel(): string {
    const match = this.groups.find((group) => group.id === this.selectedGroupId);
    return match?.name ?? "Select a group...";
  }

  setVisibility(visibility: "public" | "group" | "personal"): void {
    this.visibility = visibility;
    this.formData.is_personal = visibility === "personal";
    if (visibility === "group" && !this.selectedGroupId) {
      this.selectedGroupId = this.defaultGroupId || this.groups[0]?.id || null;
    }
    if (visibility !== "group") {
      this.closeGroupDropdown();
    }
  }

  toggleGroupDropdown(event: Event): void {
    if (this.showGroupDropdown) {
      this.closeGroupDropdown();
      return;
    }
    const current = event.currentTarget;
    if (!(current instanceof HTMLElement)) {
      return;
    }
    const field = current.closest("[data-group-dropdown-field]");
    const trigger = field instanceof HTMLElement ? field : current;
    this.groupDropdownTrigger = trigger;
    this.showGroupDropdown = true;
    this.groupDropdownPanelStyle = buildAnchoredFixedDropdownStyleFromTrigger(
      trigger,
      this.estimateGroupDropdownHeight()
    );
  }

  closeGroupDropdown(): void {
    this.showGroupDropdown = false;
    this.groupDropdownPanelStyle = {};
    this.groupDropdownTrigger = null;
  }

  private estimateGroupDropdownHeight(): number {
    return Math.min(
      ANCHORED_FIXED_DROPDOWN_MAX_HEIGHT,
      this.groups.length * 36 + 8
    );
  }

  selectGroup(groupId: string): void {
    this.selectedGroupId = groupId;
    this.closeGroupDropdown();
  }

  private applyDefaultVisibility(): void {
    if (this.defaultPersonalPrayer) {
      this.setVisibility("personal");
    } else if (this.defaultGroupPrayer && this.showGroupOption) {
      this.setVisibility("group");
      this.selectedGroupId = this.defaultGroupId || this.groups[0]?.id || null;
    } else if (this.showPublicOption) {
      this.setVisibility("public");
    } else if (this.showGroupOption) {
      this.setVisibility("group");
      this.selectedGroupId = this.defaultGroupId || this.groups[0]?.id || null;
    } else {
      this.setVisibility("personal");
    }
    if (this.showGroupOption && !this.selectedGroupId) {
      this.selectedGroupId = this.defaultGroupId || this.groups[0]?.id || null;
    }
  }

  /** Public prayers require an active tenant with a churches plan (RLS). */
  get publicPrayerBlockedReason(): string | null {
    if (this.visibility !== "public") return null;
    const tenant = this.tenantContext.getActiveTenant();
    if (!tenant) {
      return "Church prayers require an active organization. Open Tenant Management (admin) or pick an organization you belong to, then try again.";
    }
    if (tenant.plan_tier === "free") {
      return "Church prayers require a Church plan for this organization. Use a personal or group prayer instead.";
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
    if (this.visibility === "personal") return true;
    if (this.visibility === "group") {
      return !!this.selectedGroupId;
    }
    const tenant = this.tenantContext.getActiveTenant();
    if (!tenant) return false;
    if (tenant.plan_tier === "free") return false;
    return true;
  }

  onCategoryFocus(): void {
    this.updateFilteredCategories();
    this.showCategoryDropdown = this.filteredCategories.length > 0;
  }

  onCategoryBlur(event: FocusEvent): void {
    if (isNodeInsidePersonalCategoryField(event.relatedTarget)) {
      return;
    }
    this.showCategoryDropdown = false;
    this.cdr.markForCheck();
  }

  onCategoryInput(event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    this.formData.category = input;
    this.syncCategoryColorForInput(input);
    this.updateFilteredCategories();
    this.showCategoryDropdown = this.filteredCategories.length > 0;
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
      if (this.visibility === "group") {
        if (!this.selectedGroupId) {
          this.toast.error("Select a group for this prayer");
          return;
        }
        const success = await this.prayerGroupService.addGroupPrayer(
          this.selectedGroupId,
          prayerData
        );
        if (!success) return;
        this.closeGroupDropdown();
        this.showSuccessMessage = true;
        this.cdr.markForCheck();
        this.close.emit({ isPersonal: false });
        this.formData = { ...EMPTY_PRAYER_FORM_FIELDS };
        this.visibility = "public";
        this.categoryColor = '#2563EB';
        this.categoryColorDirty = false;
        setTimeout(() => {
          this.showSuccessMessage = false;
          this.cdr.markForCheck();
        }, 5000);
        return;
      }

      const result = await submitPrayerFormRequest(
        this.prayerService,
        this.personalCategoryColorService,
        this.formData,
        prayerData,
        this.categoryColor,
        this.categoryColorDirty
      );

      if (result.ok) {
        this.closeGroupDropdown();
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
    this.visibility = "public";
    this.showSuccessMessage = false;
    this.isSubmitting = false;
    this.showCategoryDropdown = false;
    this.closeGroupDropdown();
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

  @HostListener("document:keydown.escape")
  onEscape(): void {
    if (this.showGroupDropdown) {
      this.closeGroupDropdown();
    }
  }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.showGroupDropdown) {
      if (
        !target.closest("[data-group-dropdown-trigger]") &&
        !target.closest("[data-group-dropdown-panel]")
      ) {
        this.closeGroupDropdown();
      }
    }
    if (this.showCategoryDropdown) {
      this.closeCategoryDropdownIfOutside(event.target);
    }
  }

  private bindCategoryDropdownOutsideClose(): void {
    const onPointerDown = (event: Event) => {
      this.closeCategoryDropdownIfOutside(event.target);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    });
  }

  private closeCategoryDropdownIfOutside(target: EventTarget | null): void {
    if (!this.showCategoryDropdown) {
      return;
    }
    if (isNodeInsidePersonalCategoryField(target)) {
      return;
    }
    this.showCategoryDropdown = false;
    this.cdr.markForCheck();
  }
}
