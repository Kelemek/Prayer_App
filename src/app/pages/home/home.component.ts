import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  RouterModule,
  Router,
  ActivatedRoute,
  NavigationEnd,
} from "@angular/router";
import { ChangeDetectorRef } from "@angular/core";
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from "@angular/cdk/drag-drop";
import { PrayerFormComponent } from "../../components/prayer-form/prayer-form.component";
import {
  PrayerFiltersComponent,
  PrayerFilters,
} from "../../components/prayer-filters/prayer-filters.component";
import { SkeletonLoaderComponent } from "../../components/skeleton-loader/skeleton-loader.component";
import { AppLogoComponent } from "../../components/app-logo/app-logo.component";
import { PrayerCardComponent } from "../../components/prayer-card/prayer-card.component";
import {
  PromptCardComponent,
  PrayerPrompt,
} from "../../components/prompt-card/prompt-card.component";
import { UserSettingsComponent } from "../../components/user-settings/user-settings.component";
import { VerificationDialogComponent } from "../../components/verification-dialog/verification-dialog.component";
import { HelpModalComponent } from "../../components/help-modal/help-modal.component";
import { PersonalPrayerEditModalComponent } from "../../components/personal-prayer-edit-modal/personal-prayer-edit-modal.component";
import { PersonalPrayerUpdateEditModalComponent } from "../../components/personal-prayer-update-edit-modal/personal-prayer-update-edit-modal.component";
import { ConfirmationDialogComponent } from "../../components/confirmation-dialog/confirmation-dialog.component";
import {
  PrayerService,
  PrayerRequest,
  PrayerUpdate,
} from "../../services/prayer.service";
import { PromptService } from "../../services/prompt.service";
import { AdminAuthService } from "../../services/admin-auth.service";
import { UserSessionService, type UserSessionData } from "../../services/user-session.service";
import { SupabaseService } from "../../services/supabase.service";
import { BadgeService } from "../../services/badge.service";
import { Observable, take, Subject, takeUntil, filter, map, distinctUntilChanged, skip, combineLatest } from "rxjs";
import { ToastService } from "../../services/toast.service";
import { PersonalCategoryColorService } from "../../services/personal-category-color.service";
import { AnalyticsService } from "../../services/analytics.service";
import { PullToRefreshDirective } from "../../directives/pull-to-refresh.directive";
import { TenantPermissionService } from "../../services/tenant-permission.service";
import { TenantContextService } from "../../services/tenant-context.service";
import { ConnectivityService } from "../../services/connectivity.service";
import { MemorizationService } from "../../services/memorization.service";
import { MemorizationRecommendationsService } from "../../services/memorization-recommendations.service";
import { ScriptureService } from "../../services/scripture.service";
import { MemorizationActionBarComponent } from "../../components/memorization-action-bar/memorization-action-bar.component";
import { MemorizedVerseCardComponent } from "../../components/memorized-verse-card/memorized-verse-card.component";
import { MemorizationRecommendationsModalComponent } from "../../components/memorization-recommendations-modal/memorization-recommendations-modal.component";
import { AddMemorizedVerseModalComponent } from "../../components/add-memorized-verse-modal/add-memorized-verse-modal.component";
import { AddMemorizedBibleBooksModalComponent } from "../../components/add-memorized-bible-books-modal/add-memorized-bible-books-modal.component";
import {
  PROMPT_TYPE_CHIP_ACTIVE_CLASS,
  PROMPT_TYPE_CHIP_INACTIVE_CLASS,
} from "../../lib/prompt-type-chip-classes";
import { MemorizationPracticeSessionComponent } from "../../components/memorization-practice-session/memorization-practice-session.component";
import { groupItemsByMasterLevel } from "../../lib/memorization/memorization-mastery";
import { memorizationNeedsKeyboardOnOpen } from "../../lib/memorization/memorizationKeyboardPractice";
import type {
  MemorizedItem,
  MemorizationInProgressSavePayload,
  BibleTranslation,
  MemorizationRecommendation,
  MemorizationRecommendationAddPayload,
} from "../../types/memorization";
import {
  BRANDING_CACHE_KEYS,
  getBrandingCacheKey,
} from "../../utils/branding-cache-keys";
import type { Tenant, TenantMembership } from "../../types/tenant";
import {
  buildPresentationHomeHandoff,
  PRESENTATION_HOME_HANDOFF_STATE_KEY,
  HOME_RETURN_CONTEXT_STATE_KEY,
  parseHomeReturnContextFromState,
  serializePresentationHomeHandoffQueryParams,
  type HomePresentationFilter,
  type SelectablePresentationContentType,
  type HomeReturnContext,
} from "../../types/presentation";
import { mapHomeFilterToContentType } from "../../services/presentation-settings.service";
@Component({
  selector: "app-home",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    DragDropModule,
    PrayerFormComponent,
    PrayerFiltersComponent,
    SkeletonLoaderComponent,
    AppLogoComponent,
    PrayerCardComponent,
    PromptCardComponent,
    UserSettingsComponent,
    HelpModalComponent,
    PersonalPrayerEditModalComponent,
    PersonalPrayerUpdateEditModalComponent,
    ConfirmationDialogComponent,
    PullToRefreshDirective,
    MemorizationActionBarComponent,
    MemorizedVerseCardComponent,
    MemorizationRecommendationsModalComponent,
    AddMemorizedVerseModalComponent,
    AddMemorizedBibleBooksModalComponent,
    MemorizationPracticeSessionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      /*
        Always-mounted bridge for resume keyboard open. WebKit only opens the software
        keyboard when focus happens on an already-present field inside the user gesture;
        newly created session inputs are too late after close→reopen.
      */
      .memorize-keyboard-bridge {
        position: fixed;
        left: 0;
        bottom: 0;
        width: 100%;
        height: 1px;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: transparent;
        caret-color: transparent;
        outline: none;
        box-shadow: none;
        opacity: 0.01;
        font-size: 16px;
        overflow: hidden;
        z-index: 0;
        -webkit-appearance: none;
        appearance: none;
        -webkit-tap-highlight-color: transparent;
      }
      .memorize-keyboard-bridge:focus {
        outline: none;
        box-shadow: none;
      }
      .memorize-keyboard-bridge::-webkit-contacts-auto-fill-button,
      .memorize-keyboard-bridge::-webkit-credentials-auto-fill-button {
        visibility: hidden;
        display: none !important;
        pointer-events: none;
        position: absolute;
        right: 0;
        opacity: 0;
      }
    `,
  ],
  template: `
    <div
      class="main-page-shell w-full min-h-screen bg-gray-50 dark:bg-gray-900"
    >
      <!-- Pre-mounted so resume can focus inside the verse-card tap (iOS keyboard). -->
      <form autocomplete="off" class="contents" (submit)="$event.preventDefault()">
        <input
          #memorizeKeyboardBridge
          type="text"
          name="search"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          enterkeyhint="done"
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          aria-hidden="true"
          tabindex="-1"
          class="memorize-keyboard-bridge"
          data-testid="memorize-keyboard-bridge"
        />
      </form>
      @if (!isOnline) {
      <div
        class="sticky top-0 z-40 border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
        role="status"
      >
        You’re offline. You can view previously loaded prayers. Connect to submit or update.
      </div>
      }
      <!-- Scroll viewport below safe area: header sticky inside so content scrolls under header to top of header, never into safe area -->
      <div
        class="safe-area-viewport w-full bg-gray-50 dark:bg-gray-900"
        appPullToRefresh
        [refreshing]="isRefreshing"
        (refresh)="onPullToRefresh()"
      >
        <!-- Header -->
        <header
          class="w-full bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50"
        >
          <div class="w-full max-w-6xl mx-auto px-4 py-4 sm:py-6">
            <!-- Mobile layout: indicator in top row with logo -->
            <div class="sm:hidden flex items-start justify-between gap-2 mb-3">
              <!-- Logo on left -->
              <div class="flex items-center gap-3">
                <app-logo (logoStatusChange)="hasLogo = $event"></app-logo>
              </div>

              <div class="flex flex-col items-end gap-2 min-w-0">
                <!-- Email Indicator - Top Right -->
                @if ((userSessionService.userSession$ | async); as session) {
                <button
                  (click)="showLogoutConfirmation = true"
                  class="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 px-2 py-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors cursor-pointer shrink-0"
                  title="Click to log out"
                >
                  <span class="hidden xs:inline">{{ session.email }}</span>
                  <span class="xs:hidden">Logged In</span>
                </button>
                } @else {
                <button
                  (click)="showLogoutConfirmation = true"
                  class="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 px-2 py-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors cursor-pointer shrink-0"
                  title="Click to log out"
                >
                  <span class="hidden xs:inline">{{ getUserEmail() }}</span>
                  <span class="xs:hidden">Logged In</span>
                </button>
                }
              </div>
            </div>

            <!-- Mobile buttons row - flex-nowrap so title/buttons stay on one line on smallest screens -->
            <div class="sm:hidden flex items-center gap-2 flex-nowrap">
              <button
                (click)="showHelp = true"
                class="flex items-center gap-1 px-2 py-2 text-sm font-medium btn-chip btn-chip-gray"
                title="Help"
              >
                <svg
                  class="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  ></circle>
                  <text
                    x="12"
                    y="16"
                    text-anchor="middle"
                    fill="currentColor"
                    font-size="14"
                    font-weight="bold"
                  >
                    ?
                  </text>
                </svg>
              </button>
              <button
                (click)="showSettings = true"
                class="flex items-center gap-1 px-2 py-2 text-sm font-medium btn-chip btn-chip-gray"
                title="Settings"
              >
                <svg
                  class="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path
                    d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
                  ></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <a
                id="tour-btn-prayer-mode-mobile"
                routerLink="/presentation"
                [queryParams]="presentationHandoffQueryParams"
                (click)="onPresentationLinkClick($event)"
                class="flex items-center gap-1 px-3 py-2 text-sm font-medium btn-chip btn-chip-green"
                title="Prayer Mode"
              >
                <span>Pray</span>
              </a>
              <button
                (click)="openPrayerRequest()"
                class="flex items-center gap-1 px-3 py-2 text-sm font-medium btn-chip btn-chip-blue"
              >
                <span>Request</span>
              </button>
              @if (canAccessAdminFeatures) {
              <button
                (click)="navigateToAdmin()"
                class="flex items-center gap-1 border border-red-600 dark:border-red-500 text-red-600 dark:text-red-500 px-2 py-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors text-sm cursor-pointer"
                title="Admin Portal"
              >
                <span>Admin</span>
              </button>
              }
            </div>

            <!-- Desktop layout: Logo on left, controls on right -->
            <div class="hidden sm:flex items-start justify-between">
              <!-- Logo on left -->
              <div class="flex items-center gap-3">
                <app-logo (logoStatusChange)="hasLogo = $event"></app-logo>
              </div>

              <!-- Right side: Email and controls -->
              <div class="flex flex-col items-end gap-2">
                <!-- Top row: Admin button and Email Indicator -->
                <div class="flex items-center gap-2">
                  @if (canAccessAdminFeatures) {
                  <button
                    (click)="navigateToAdmin()"
                    class="flex items-center gap-1 border border-red-600 dark:border-red-500 text-red-600 dark:text-red-500 px-2 py-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors text-xs cursor-pointer"
                    title="Admin Portal"
                  >
                    <span>Admin</span>
                  </button>
                  } @if ((userSessionService.userSession$ | async); as session)
                  {
                  <button
                    (click)="showLogoutConfirmation = true"
                    class="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 px-2 py-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors cursor-pointer"
                    title="Click to log out"
                  >
                    <span class="hidden sm:inline">{{ session.email }}</span>
                    <span class="sm:hidden">Logged In</span>
                  </button>
                  } @else {
                  <button
                    (click)="showLogoutConfirmation = true"
                    class="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 px-2 py-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors cursor-pointer"
                    title="Click to log out"
                  >
                    <span class="hidden sm:inline">{{ getUserEmail() }}</span>
                    <span class="sm:hidden">Logged In</span>
                  </button>
                  }
                </div>

                <!-- Controls: Desktop only - h-12 for uniform button height -->
                <div class="flex items-center gap-2">
                  <button
                    (click)="showHelp = true"
                    class="flex items-center justify-center h-12 gap-1 px-3 text-sm font-medium btn-chip btn-chip-gray"
                    title="Help & Guidance"
                  >
                    <svg
                      class="w-6 h-6 flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      ></circle>
                      <text
                        x="12"
                        y="16"
                        text-anchor="middle"
                        fill="currentColor"
                        font-size="14"
                        font-weight="bold"
                      >
                        ?
                      </text>
                    </svg>
                  </button>
                  <button
                    (click)="showSettings = true"
                    class="flex items-center justify-center h-12 gap-1 px-3 text-sm font-medium btn-chip btn-chip-gray"
                    title="Settings"
                  >
                    <svg
                      class="w-6 h-6 flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path
                        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
                      ></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                  <a
                    id="tour-btn-prayer-mode-desktop"
                    routerLink="/presentation"
                    [queryParams]="presentationHandoffQueryParams"
                    (click)="onPresentationLinkClick($event)"
                    class="flex items-center justify-center h-12 gap-1 px-3 text-sm font-medium btn-chip btn-chip-green"
                    title="Prayer Mode"
                  >
                    <span>Pray</span>
                  </a>
                  <button
                    (click)="openPrayerRequest()"
                    class="flex items-center justify-center h-12 gap-1 px-3 text-sm font-medium btn-chip btn-chip-blue"
                  >
                    <span>Request</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- Main Content -->
        <main class="w-full max-w-6xl mx-auto px-4 py-6">
          <!-- Top refresh indicator -->
          <div
            *ngIf="isRefreshing"
            class="flex items-center justify-center mb-3 text-xs text-gray-500 dark:text-gray-400"
            aria-live="polite"
          >
            <svg
              class="animate-spin mr-2 h-4 w-4 text-gray-500 dark:text-gray-300"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              ></path>
            </svg>
            <span>Refreshing prayers…</span>
          </div>

          <!-- Prayer Filters -->
          <app-prayer-filters
            [filters]="filters"
            (filtersChange)="onFiltersChange($event)"
          ></app-prayer-filters>
          <!-- Stats Cards -->
          <div
            [class]="
              'grid gap-4 mb-6 ' +
              (canAccessShared ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2')
            "
          >
            @if (canAccessShared) {
            <button
              (click)="setFilter('current')"
              title="Show current prayers"
              [class]="
                'rounded-lg shadow-md p-2 sm:p-4 text-center transition-all duration-200 cursor-pointer relative flex flex-col items-center justify-center ' +
                (activeFilter === 'current'
                  ? 'border !border-[#0047AB] dark:!border-[#0047AB] bg-blue-100 dark:bg-blue-950 ring ring-[#0047AB] dark:ring-[#0047AB] ring-offset-0'
                  : 'bg-white dark:bg-gray-800 border-[2px] !border-gray-200 dark:!border-gray-700 hover:!border-[#0047AB] dark:hover:!border-[#0047AB] hover:shadow-lg')
              "
            >
              @let currentCount = (currentPrayerBadge$ | async) || 0; @if
              ((currentCount > 0) &&
              (badgeService.getBadgeFunctionalityEnabled$() | async)) {
              <button
                (click)="$event.stopPropagation(); markAllCurrentAsRead()"
                class="absolute -top-2 -right-2 inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-[#39704D] dark:bg-[#39704D] text-white rounded-full text-xs font-bold hover:bg-[#2d5a3f] dark:hover:bg-[#2d5a3f] focus:outline-none focus:ring-2 focus:ring-[#39704D] focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
                title="Mark all current prayers as read"
                aria-label="Mark all current prayers as read"
              >
                {{ currentCount }}
              </button>
              }
              <div
                class="text-sm sm:text-xl sm:sm:text-2xl font-bold text-gray-700 dark:text-gray-300 tabular-nums"
              >
                {{ currentPrayersCount }}
              </div>
              <div class="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                Current
              </div>
            </button>
            <button
              (click)="setFilter('answered')"
              title="Show answered prayers"
              [class]="
                'rounded-lg shadow-md p-2 sm:p-4 text-center transition-all duration-200 cursor-pointer relative flex flex-col items-center justify-center ' +
                (activeFilter === 'answered'
                  ? 'border !border-[#39704D] dark:!border-[#39704D] bg-green-100 dark:bg-green-950 ring ring-[#39704D] dark:ring-[#39704D] ring-offset-0'
                  : 'bg-white dark:bg-gray-800 border-[2px] !border-gray-200 dark:!border-gray-700 hover:!border-[#39704D] dark:hover:!border-[#39704D] hover:shadow-lg')
              "
            >
              @let answeredCount = (answeredPrayerBadge$ | async) || 0; @if
              ((answeredCount > 0) &&
              (badgeService.getBadgeFunctionalityEnabled$() | async)) {
              <button
                (click)="$event.stopPropagation(); markAllAnsweredAsRead()"
                class="absolute -top-2 -right-2 inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-[#39704D] dark:bg-[#39704D] text-white rounded-full text-xs font-bold hover:bg-[#2d5a3f] dark:hover:bg-[#2d5a3f] focus:outline-none focus:ring-2 focus:ring-[#39704D] focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
                title="Mark all answered prayers as read"
                aria-label="Mark all answered prayers as read"
              >
                {{ answeredCount }}
              </button>
              }
              <div
                class="text-sm sm:text-xl sm:sm:text-2xl font-bold text-gray-700 dark:text-gray-300 tabular-nums"
              >
                {{ answeredPrayersCount }}
              </div>
              <div class="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                Answered
              </div>
            </button>
            <button
              (click)="setFilter('total')"
              title="Show all prayers"
              [class]="
                'rounded-lg shadow-md p-2 sm:p-4 text-center transition-all duration-200 cursor-pointer relative flex flex-col items-center justify-center ' +
                (activeFilter === 'total'
                  ? 'border !border-[#C9A961] dark:!border-[#C9A961] bg-amber-100 dark:bg-amber-900/40 ring ring-[#C9A961] dark:ring-[#C9A961] ring-offset-0'
                  : 'bg-white dark:bg-gray-800 border-[2px] !border-gray-200 dark:!border-gray-700 hover:!border-[#C9A961] dark:hover:!border-[#C9A961] hover:shadow-lg')
              "
            >
              <div
                class="text-sm sm:text-xl sm:sm:text-2xl font-bold text-gray-700 dark:text-gray-300 tabular-nums"
              >
                {{ totalPrayersCount }}
              </div>
              <div class="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                Total
              </div>
            </button>
            <button
              (click)="setFilter('prompts')"
              title="Show prayer prompts"
              [class]="
                'rounded-lg shadow-md p-2 sm:p-4 text-center transition-all duration-200 cursor-pointer relative flex flex-col items-center justify-center ' +
                (activeFilter === 'prompts'
                  ? 'border !border-[#988F83] dark:!border-[#988F83] bg-stone-100 dark:bg-stone-900/40 ring ring-[#988F83] dark:ring-[#988F83] ring-offset-0'
                  : 'bg-white dark:bg-gray-800 border-[2px] !border-gray-200 dark:!border-gray-700 hover:!border-[#988F83] dark:hover:!border-[#988F83] hover:shadow-lg')
              "
            >
              @let promptCount = (promptBadge$ | async) || 0; @if ((promptCount
              > 0) && (badgeService.getBadgeFunctionalityEnabled$() | async)) {
              <button
                (click)="$event.stopPropagation(); markAllPromptsAsRead()"
                class="absolute -top-2 -right-2 inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-[#39704D] dark:bg-[#39704D] text-white rounded-full text-xs font-bold hover:bg-[#2d5a3f] dark:hover:bg-[#2d5a3f] focus:outline-none focus:ring-2 focus:ring-[#39704D] focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
                title="Mark all prompts as read"
                aria-label="Mark all prompts as read"
              >
                {{ promptCount }}
              </button>
              }
              <div
                class="text-sm sm:text-xl sm:sm:text-2xl font-bold text-gray-700 dark:text-gray-300 tabular-nums"
              >
                {{ promptsCount }}
              </div>
              <div class="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Prompts
              </div>
            </button>
            }

            <!-- Personal Prayers Filter -->
            <button
              (click)="setFilter('personal')"
              title="Show your personal prayers"
              [class]="
                'rounded-lg shadow-md p-2 sm:p-4 text-center transition-all duration-200 cursor-pointer relative flex flex-col items-center justify-center ' +
                (activeFilter === 'personal'
                  ? 'border !border-[#2F5F54] dark:!border-[#2F5F54] bg-slate-100 dark:bg-green-900/40 ring ring-[#2F5F54] dark:ring-[#2F5F54] ring-offset-0'
                  : 'bg-white dark:bg-gray-800 border-[2px] !border-gray-200 dark:!border-gray-700 hover:!border-[#2F5F54] dark:hover:!border-[#2F5F54] hover:shadow-lg')
              "
            >
              <div
                class="text-sm sm:text-xl sm:sm:text-2xl font-bold text-gray-700 dark:text-gray-300 tabular-nums"
              >
                {{ personalPrayersCount }}
              </div>
              <div class="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Personal
              </div>
            </button>

            <button
              (click)="setFilter('memorize')"
              title="Memorize Bible verses"
              [class]="
                'rounded-lg shadow-md p-2 sm:p-4 text-center transition-all duration-200 cursor-pointer relative flex flex-col items-center justify-center ' +
                (activeFilter === 'memorize'
                  ? 'border !border-[#0047AB] dark:!border-[#0047AB] bg-blue-100 dark:bg-blue-950 ring ring-[#0047AB] dark:ring-[#0047AB] ring-offset-0'
                  : 'bg-white dark:bg-gray-800 border-[2px] !border-gray-200 dark:!border-gray-700 hover:!border-[#0047AB] dark:hover:!border-[#0047AB] hover:shadow-lg')
              "
            >
              <div
                class="text-sm sm:text-xl sm:sm:text-2xl font-bold text-gray-700 dark:text-gray-300 tabular-nums"
              >
                {{ memorizedItemsCount }}
              </div>
              <div class="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Memorize
              </div>
            </button>
          </div>

          <!-- Loading State -->
          @if (!viewReady || (loading$ | async) || (activeFilter === 'personal'
          && (prayerService.loadingPersonalPrayers$ | async)) || (activeFilter ===
          'memorize' && (memorizationService.loading$ | async))) {
          <app-skeleton-loader [count]="5" type="card"></app-skeleton-loader>
          }

          <!-- Error State -->
          @if ((error$ | async); as error) {
          <div
            class="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg mb-6"
          >
            {{ error }}
          </div>
          }

          <!-- Prompt Type Filters -->
          @if (activeFilter === 'prompts' && promptsCount > 0) {
          <div class="flex flex-wrap gap-2 mb-4">
            <!-- All Types Button -->
            <button
              (click)="selectedPromptTypes = []"
              [class]="
                'flex-1 whitespace-nowrap px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ' +
                (selectedPromptTypes.length === 0
                  ? promptTypeActiveClass
                  : promptTypeInactiveClass)
              "
            >
              All Types ({{ promptsCount }})
            </button>

            <!-- Individual Type Buttons -->
            @for (type of getUniquePromptTypes(); track type) {
            <button
              (click)="togglePromptType(type)"
              [class]="
                'flex-1 whitespace-nowrap px-3 py-2 rounded-lg text-xs font-medium transition-all relative cursor-pointer ' +
                (isPromptTypeSelected(type)
                  ? promptTypeActiveClass
                  : promptTypeInactiveClass)
              "
            >
              {{ type }} ({{ getPromptCountByType(type) }}) @if
              ((badgeService.getBadgeFunctionalityEnabled$() | async) &&
              getUnreadPromptCountByType(type) > 0) {
              <span
                class="absolute -top-2 -right-2 inline-flex items-center justify-center w-5 h-5 bg-[#39704D] dark:bg-[#39704D] text-white rounded-full text-xs font-bold"
              >
                {{ getUnreadPromptCountByType(type) }}
              </span>
              }
            </button>
            }
          </div>
          }

          <!-- Personal Category Filters -->
          @if (activeFilter === 'personal' && uniquePersonalCategories.length >
          0) {
          <div
            cdkDropList
            cdkDropListOrientation="mixed"
            [cdkDropListData]="uniquePersonalCategories"
            (cdkDropListDropped)="onCategoryDrop($event)"
            [cdkDropListDisabled]="isSwappingCategories"
            class="flex flex-wrap gap-2 mb-4"
          >
            <!-- All Categories Button -->
            <button
              (click)="selectedPersonalCategories = []"
              [disabled]="isSwappingCategories"
              [class]="
                'flex-1 whitespace-nowrap px-3 py-2 rounded-lg text-xs font-medium transition-all ' +
                (selectedPersonalCategories.length === 0
                  ? personalCategoryActiveClass
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-[#2F5F54] dark:hover:border-[#2F5F54]') +
                (isSwappingCategories
                  ? ' opacity-50 cursor-not-allowed'
                  : ' cursor-pointer')
              "
            >
              All Categories ({{ personalPrayersCount }})
            </button>

            <!-- Individual Category Buttons -->
            @for (category of uniquePersonalCategories; let i = $index; track
            category) {
            <div
              cdkDrag
              [cdkDragData]="category"
              [cdkDragDisabled]="isSwappingCategories"
              (cdkDragStarted)="onCategoryDragStarted()"
              (cdkDragEnded)="onCategoryDragEnded()"
              class="flex-1 relative"
            >
              <button
                (click)="togglePersonalCategory(category)"
                [disabled]="isSwappingCategories"
                [class]="
                  'w-full whitespace-nowrap pl-7 pr-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 relative ' +
                  (isPersonalCategorySelected(category)
                    ? personalCategoryActiveClass
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-[#2F5F54] dark:hover:border-[#2F5F54]') +
                  (isSwappingCategories
                    ? ' opacity-50 cursor-not-allowed'
                    : ' cursor-pointer')
                "
              >
                <svg
                  cdkDragHandle
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  [class]="
                    'flex-shrink-0 absolute left-2 top-1/2 -translate-y-1/2 ' +
                    (isSwappingCategories
                      ? 'cursor-not-allowed'
                      : 'cursor-grab')
                  "
                >
                  <circle cx="9" cy="5" r="1"></circle>
                  <circle cx="9" cy="12" r="1"></circle>
                  <circle cx="9" cy="19" r="1"></circle>
                  <circle cx="15" cy="5" r="1"></circle>
                  <circle cx="15" cy="12" r="1"></circle>
                  <circle cx="15" cy="19" r="1"></circle>
                </svg>
                <span class="cursor-pointer flex-1 text-center"
                  >{{ category }} ({{
                    getPersonalCategoryCount(category)
                  }})</span
                >
                @if (isSwappingCategories) {
                <svg
                  class="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                }
              </button>
            </div>
            }
          </div>
          }

          <!-- Prayers or Prompts List -->
          @if (viewReady && !(loading$ | async) && !(error$ | async) &&
          !(activeFilter === 'personal' &&
          (prayerService.loadingPersonalPrayers$ | async)) && !(activeFilter ===
          'memorize' && (memorizationService.loading$ | async))) {
          <div class="space-y-4">
            <!-- Empty State for Prayers -->
            @if (activeFilter !== 'prompts' && activeFilter !== 'personal' &&
            activeFilter !== 'memorize' && (prayers$ | async)?.length === 0) {
            <div
              class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center border border-gray-200 dark:border-gray-700"
            >
              @if (filters.searchTerm && filters.searchTerm.trim()) {
              <svg
                class="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
              }
              <h3
                class="text-lg font-medium text-gray-700 dark:text-gray-200 mb-2"
              >
                @if (filters.searchTerm && filters.searchTerm.trim()) {
                <span>No prayers found</span>
                } @else { @if (activeFilter === 'current') {
                <span>No current prayer requests yet</span>
                } @if (activeFilter === 'answered') {
                <span>No answered prayers yet</span>
                } @if (activeFilter === 'total') {
                <span>No prayer requests yet</span>
                } }
              </h3>
              <p class="text-gray-500 dark:text-gray-400">
                @if (filters.searchTerm && filters.searchTerm.trim()) {
                <span>Try adjusting your search terms</span>
                } @else {
                <span
                  >Be the first to add a prayer request to build your church's
                  prayer community.</span
                >
                }
              </p>
            </div>
            }

            <!-- Empty State for Personal Prayers -->
            @if (activeFilter === 'personal' &&
            !(prayerService.loadingPersonalPrayers$ | async) &&
            getFilteredPersonalPrayers().length === 0) {
            <div
              class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center border border-gray-200 dark:border-gray-700"
            >
              @if (filters.searchTerm && filters.searchTerm.trim()) {
              <svg
                class="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
              }
              <h3
                class="text-lg font-medium text-gray-700 dark:text-gray-200 mb-2"
              >
                @if (filters.searchTerm && filters.searchTerm.trim()) {
                <span>No prayers found</span>
                } @else {
                <span>No personal prayers yet</span>
                }
              </h3>
              <p class="text-gray-500 dark:text-gray-400">
                @if (filters.searchTerm && filters.searchTerm.trim()) {
                <span>Try adjusting your search terms</span>
                } @else {
                <span
                  >Click the Add Request button and choose Personal Prayer to
                  create prayers that stays private to you.</span
                >
                }
              </p>
            </div>
            }

            <!-- Prayer Cards (only show when not on prompts, personal, or memorize filter) -->
            @if (activeFilter !== 'prompts' && activeFilter !== 'personal' &&
            activeFilter !== 'memorize') {
            @for (prayer of prayers$ | async; track prayer.id) {
            <app-prayer-card
              [prayer]="prayer"
              [isAdmin]="(isAdmin$ | async) || false"
              [activeFilter]="activeFilter"
              [deletionsAllowed]="deletionsAllowed"
              [updatesAllowed]="updatesAllowed"
              (delete)="deletePrayer($event)"
              (addUpdate)="addUpdate($event)"
              (deleteUpdate)="deleteUpdate($event)"
              (requestDeletion)="requestDeletion($event)"
              (requestUpdateDeletion)="requestUpdateDeletion($event)"
            ></app-prayer-card>
            } }

            <!-- Personal Prayer Cards (show when personal filter is active) -->
            @if (activeFilter === 'personal') {
            <div
              cdkDropList
              (cdkDropListDropped)="onPersonalPrayerDrop($event)"
              [cdkDropListDisabled]="selectedPersonalCategories.length !== 1"
              class="space-y-3"
            >
              @for (prayer of getFilteredPersonalPrayers(); track prayer.id) {
              <div cdkDrag>
                <ng-template #dragHandle>
                  <div
                    cdkDragHandle
                    class="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400 flex-shrink-0 absolute left-3 top-1/2 -translate-y-1/2 pr-2"
                  >
                    <svg
                      class="block"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="9" cy="5" r="1"></circle>
                      <circle cx="9" cy="12" r="1"></circle>
                      <circle cx="9" cy="19" r="1"></circle>
                      <circle cx="15" cy="5" r="1"></circle>
                      <circle cx="15" cy="12" r="1"></circle>
                      <circle cx="15" cy="19" r="1"></circle>
                    </svg>
                  </div>
                </ng-template>
                <app-prayer-card
                  [prayer]="prayer"
                  [isAdmin]="(isAdmin$ | async) || false"
                  [activeFilter]="activeFilter"
                  [isPersonal]="true"
                  [deletionsAllowed]="'everyone'"
                  [updatesAllowed]="'everyone'"
                  [isDragging]="true"
                  (delete)="deletePersonalPrayer($event)"
                  (addUpdate)="addPersonalUpdate($event)"
                  (deleteUpdate)="deletePersonalUpdate($event)"
                  (editPersonalPrayer)="openEditModal($event)"
                  (editPersonalUpdate)="openEditUpdateModal($event)"
                  [dragHandle]="
                    selectedPersonalCategories.length === 1 ? dragHandle : null
                  "
                ></app-prayer-card>
              </div>
              }
            </div>
            }

            @if (activeFilter === 'memorize') {
            <app-memorization-action-bar
              [addVersesActive]="showAddMemorizedVerse"
              [bibleBooksActive]="showAddMemorizedBibleBooks"
              [recommendedActive]="showMemorizationRecommendations"
              (addVerses)="showAddMemorizedVerse = true"
              (addBibleBooks)="showAddMemorizedBibleBooks = true"
              (openRecommended)="openMemorizationRecommendations()"
            />
            @if (!(memorizationService.loading$ | async) && memorizedItems.length
            === 0) {
            <div
              class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center border border-gray-200 dark:border-gray-700"
            >
              <h3 class="text-lg font-medium text-gray-700 dark:text-gray-200 mb-2">
                No memorized passages yet
              </h3>
              <p class="text-gray-500 dark:text-gray-400">
                @if (memorizationRecommendationsService.hasRecommendations$ | async) {
                  Add verses, Bible books, or pick from Recommended to start practicing.
                } @else {
                  Add verses or Bible books to start practicing.
                }
              </p>
            </div>
            } @for (section of memorizedVerseSections; track section.title) {
            <p [class]="section.headingClass">
              {{ section.title }}
            </p>
            <div [class]="memorizedVerseGridClass" role="list">
            @for (item of section.items; track item.id) {
            <app-memorized-verse-card
              [item]="item"
              (practice)="openMemorizationPractice($event)"
              (remove)="confirmRemoveMemorizedItem($event)"
            />
            }
            </div>
            } }

            <!-- Empty State for Prompts -->
            @if (activeFilter === 'prompts' && (prompts$ | async)?.length === 0)
            {
            <div
              class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center border border-gray-200 dark:border-gray-700"
            >
              <h3
                class="text-lg font-medium text-gray-700 dark:text-gray-200 mb-2"
              >
                No prayer prompts yet
              </h3>
              <p class="text-gray-500 dark:text-gray-400">
                Prompts help guide prayer requests.
              </p>
            </div>
            }

            <!-- Prompt Cards (only show when on prompts filter) -->
            @if (activeFilter === 'prompts') { @for (prompt of
            getDisplayedPrompts(); track prompt.id) {
            <app-prompt-card
              [prompt]="prompt"
              [isAdmin]="(isAdmin$ | async) || false"
              [isTypeSelected]="isPromptTypeSelected(prompt.type)"
              (delete)="deletePrompt($event)"
              (onTypeClick)="togglePromptType($event)"
            ></app-prompt-card>
            } }
          </div>
          }
        </main>
        <!-- Native app: bottom safe zone bar - matches header (bg-white/50 dark:bg-gray-800/50 backdrop-blur-md) -->
        <footer
          class="bottom-safe-bar w-full bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 sticky bottom-0 z-50"
          aria-hidden="true"
        ></footer>
      </div>

      <!-- Overlays outside scroll viewport so position:fixed covers full screen on iOS Safari -->
      <app-prayer-form
        [isOpen]="showPrayerForm"
        [defaultPersonalPrayer]="activeFilter === 'personal'"
        (close)="onPrayerFormClose($event)"
      ></app-prayer-form>

      <app-user-settings
        [isOpen]="showSettings"
        (onClose)="showSettings = false"
      ></app-user-settings>

      <app-help-modal
        [isOpen]="showHelp"
        (closeModal)="showHelp = false"
      ></app-help-modal>

      @if (showLogoutConfirmation) {
      <app-confirmation-dialog
        title="Log Out?"
        message="Are you sure you want to log out?"
        confirmText="Log Out"
        cancelText="Cancel"
        [isDangerous]="false"
        (confirm)="handleLogout()"
        (cancel)="showLogoutConfirmation = false"
      ></app-confirmation-dialog>
      }

      <app-personal-prayer-edit-modal
        [isOpen]="showEditPersonalPrayer"
        [prayer]="editingPrayer"
        (close)="showEditPersonalPrayer = false"
        (save)="onPersonalPrayerSaved()"
      ></app-personal-prayer-edit-modal>

      <app-personal-prayer-update-edit-modal
        [isOpen]="showEditPersonalUpdate"
        [update]="editingUpdate"
        [prayerId]="editingUpdatePrayerId"
        (close)="showEditPersonalUpdate = false"
        (save)="onPersonalUpdateSaved()"
      ></app-personal-prayer-update-edit-modal>

      <app-add-memorized-verse-modal
        [isOpen]="showAddMemorizedVerse"
        (onClose)="showAddMemorizedVerse = false"
        (translationChange)="preferredBibleTranslation = $event"
      />
      <app-add-memorized-bible-books-modal
        [isOpen]="showAddMemorizedBibleBooks"
        [translation]="preferredBibleTranslation"
        (onClose)="showAddMemorizedBibleBooks = false"
      />
      <app-memorization-recommendations-modal
        [isOpen]="showMemorizationRecommendations"
        [groups]="(memorizationRecommendationsService.grouped$ | async) ?? []"
        [alreadyAddedReferences]="memorizationRecommendationOwnedKeys"
        [busyId]="addingRecommendationId"
        [loading]="!!(memorizationRecommendationsService.loading$ | async)"
        [translation]="preferredBibleTranslation"
        (translationChange)="preferredBibleTranslation = $event"
        (onClose)="showMemorizationRecommendations = false"
        (add)="addRecommendedVerse($event)"
      />
      @if (practiceMemorizedItem) {
      <app-memorization-practice-session
        [item]="practiceMemorizedItem"
        [isOpen]="!!practiceMemorizedItem"
        (closed)="closeMemorizationPractice()"
        (completed)="onMemorizationPracticeComplete($event)"
        (persistInProgress)="onMemorizationPersistInProgress($event)"
        (clearInProgress)="onMemorizationClearInProgress()"
      />
      }
      @if (showRemoveMemorizedConfirm && memorizedItemToRemove) {
      <app-confirmation-dialog
        title="Remove from list?"
        [message]="'Remove ' + memorizedItemToRemove.reference + ' from your memorization list?'"
        confirmText="Remove"
        cancelText="Cancel"
        [isDangerous]="true"
        (confirm)="removeMemorizedItemConfirmed()"
        (cancel)="showRemoveMemorizedConfirm = false"
      />
      }

      <!-- No Footer Links -->
    </div>
  `,
})
export class HomeComponent implements OnInit, OnDestroy {
  readonly promptTypeActiveClass = PROMPT_TYPE_CHIP_ACTIVE_CLASS;
  readonly promptTypeInactiveClass = PROMPT_TYPE_CHIP_INACTIVE_CLASS;

  @ViewChild("memorizeKeyboardBridge")
  private memorizeKeyboardBridge?: ElementRef<HTMLInputElement>;

  prayers$!: Observable<PrayerRequest[]>;
  prompts$!: Observable<PrayerPrompt[]>;
  loading$!: Observable<boolean>;
  error$!: Observable<string | null>;
  isAdmin$!: Observable<boolean>;

  // Current prayers array for filtering
  currentPrayers: PrayerRequest[] = [];

  // Personal prayers
  personalPrayers: PrayerRequest[] = [];
  isReorderingPersonalPrayers = false;

  // Badge observables
  currentPrayerBadge$!: Observable<number>;
  answeredPrayerBadge$!: Observable<number>;
  promptBadge$!: Observable<number>;

  currentPrayersCount = 0;
  answeredPrayersCount = 0;
  totalPrayersCount = 0;
  promptsCount = 0;
  personalPrayersCount = 0;
  memorizedItems: MemorizedItem[] = [];
  memorizedItemsCount = 0;
  memorizedLearning: MemorizedItem[] = [];
  memorizedPracticing: MemorizedItem[] = [];
  memorizedMastered: MemorizedItem[] = [];
  readonly personalCategoryActiveClass =
    'border !border-[#2F5F54] dark:!border-[#2F5F54] bg-slate-100 dark:bg-green-900/40 ring ring-[#2F5F54] dark:ring-[#2F5F54] ring-offset-0 text-gray-700 dark:text-gray-300 shadow-md';
  readonly memorizedVerseGridClass =
    'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';
  memorizationRecommendationOwnedKeys = new Set<string>();
  addingRecommendationId: string | null = null;
  showAddMemorizedVerse = false;
  showAddMemorizedBibleBooks = false;
  showMemorizationRecommendations = false;
  practiceMemorizedItem: MemorizedItem | null = null;
  showRemoveMemorizedConfirm = false;
  memorizedItemToRemove: MemorizedItem | null = null;
  preferredBibleTranslation: BibleTranslation = 'esv';

  showPrayerForm = false;
  isOnline = true;
  showSettings = false;
  showHelp = false;
  showLogoutConfirmation = false;
  showEditPersonalPrayer = false;
  editingPrayer: PrayerRequest | null = null;
  showEditPersonalUpdate = false;
  editingUpdate: PrayerUpdate | null = null;
  editingUpdatePrayerId = "";
  filters: PrayerFilters = { status: "current" };
  hasLogo = false;
  activeFilter:
    | "current"
    | "answered"
    | "total"
    | "prompts"
    | "personal"
    | "memorize" = "current";
  viewReady = false;
  private pendingHomeReturnContext: HomeReturnContext | null = null;
  selectedPromptTypes: string[] = [];
  selectedPersonalCategories: string[] = [];
  isCategoryDragging = false;
  uniquePersonalCategories: string[] = [];
  isSwappingCategories = false;
  isRefreshing = false;
  private lastExplicitRefreshAt = 0;
  canAccessShared = false;
  get canAccessAdminFeatures(): boolean {
    return this.tenantPermissionService.canAccessAdmin();
  }
  tenantMemberships: TenantMembership[] = [];
  availableTenants: Tenant[] = [];
  tenantContextLoading = true;

  get activeTenantId(): string | null {
    return this.tenantContextService.getActiveTenant()?.id ?? null;
  }

  get isSuperAdmin(): boolean {
    return this.tenantContextService.getIsSuperAdmin();
  }

  get showTenantSwitcher(): boolean {
    return (
      !this.tenantContextLoading &&
      !!this.activeTenantId &&
      this.tenantSwitchOptions.length > 1
    );
  }

  isAdmin = false;
  // Admin settings for access control policies
  // These are loaded from admin_settings and control who can delete prayers/updates
  deletionsAllowed: "everyone" | "original-requestor" | "admin-only" =
    "everyone";
  updatesAllowed: "everyone" | "original-requestor" | "admin-only" = "everyone";

  // Subject for managing subscriptions
  private destroy$ = new Subject<void>();

  constructor(
    public prayerService: PrayerService,
    public promptService: PromptService,
    public adminAuthService: AdminAuthService,
    public userSessionService: UserSessionService,
    public badgeService: BadgeService,
    private toastService: ToastService,
    private analyticsService: AnalyticsService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private tenantPermissionService: TenantPermissionService,
    private tenantContextService: TenantContextService,
    private connectivity: ConnectivityService,
    public memorizationService: MemorizationService,
    public memorizationRecommendationsService: MemorizationRecommendationsService,
    private scriptureService: ScriptureService,
    private personalCategoryColorService: PersonalCategoryColorService
  ) {
    const windowCache = (window as { __cachedLogos?: { tenantId?: string | null; useLogo?: boolean } }).__cachedLogos;
    const tenantId = localStorage.getItem("active_tenant_id");
    const windowCacheApplies =
      !!windowCache &&
      (!tenantId || !windowCache.tenantId || windowCache.tenantId === tenantId);
    const useLogoKey = getBrandingCacheKey(BRANDING_CACHE_KEYS.useLogo, tenantId);
    const useLogoStored = localStorage.getItem(useLogoKey);
    const useLogo =
      useLogoStored !== null
        ? useLogoStored === "true"
        : windowCacheApplies && windowCache?.useLogo === true;
    this.hasLogo = useLogo;
  }

  ngOnInit(): void {
    this.pendingHomeReturnContext = this.consumeHomeReturnContext();

    // Track page view on home component load
    this.analyticsService.trackPageView();

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((e) => {
        if (!this.isRouterUrlHome(e.urlAfterRedirects)) {
          return;
        }
        const returnContext = this.consumeHomeReturnContext();
        if (returnContext) {
          if (this.viewReady) {
            this.applyHomeReturnContext(returnContext);
            this.cdr.markForCheck();
          } else {
            this.pendingHomeReturnContext = returnContext;
          }
        }
      });

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        if (!this.viewReady) {
          return;
        }
        if (params["filter"] === "memorize") {
          this.setFilter("memorize");
          this.clearMemorizeFilterQueryParam();
          this.cdr.markForCheck();
        }
      });

    this.isOnline = this.connectivity.isOnline();
    this.connectivity.isOnline$
      .pipe(takeUntil(this.destroy$))
      .subscribe((online) => {
        this.isOnline = online;
        this.cdr.markForCheck();
      });

    this.prayers$ = this.prayerService.prayers$;
    this.prompts$ = this.promptService.prompts$;
    this.loading$ = this.prayerService.loading$;
    this.error$ = this.prayerService.error$;
    this.isAdmin$ = this.adminAuthService.isAdmin$;

    // Initialize badge observables immediately so badges can show on first load
    // (no longer waiting for prompts$; refreshBadgeCounts runs when prayers/prompts load and once below)
    this.currentPrayerBadge$ = this.badgeService.getBadgeCount$(
      "prayers",
      "current"
    );
    this.answeredPrayerBadge$ = this.badgeService.getBadgeCount$(
      "prayers",
      "answered"
    );
    this.promptBadge$ = this.badgeService.getBadgeCount$("prompts");
    // Ensure prompts (and prompts_cache) are loaded when Home is shown. Required after logout:
    // logout invalidates prompts_cache, but PromptService does not re-run loadPrompts() until
    // next full page load; calling loadPrompts() here repopulates cache so badge counts are correct.
    this.promptService.loadPrompts();
    if (this.tenantContextService?.activeTenant$) {
      this.tenantContextService.activeTenant$
        .pipe(
          map((tenant) => tenant?.id ?? null),
          distinctUntilChanged(),
          skip(1),
          takeUntil(this.destroy$)
        )
        .subscribe(async () => {
          this.canAccessShared = this.tenantPermissionService.canAccessShared();
          if (
            !this.canAccessShared &&
            this.activeFilter !== "personal" &&
            this.activeFilter !== "memorize"
          ) {
            this.setFilter("personal");
          } else {
            await Promise.all([
              this.prayerService.loadPrayers(),
              this.promptService.loadPrompts(),
              this.prayerService.loadPersonalPrayers(false),
              this.memorizationService.loadItems(),
            ]);
          }
          this.cdr.markForCheck();
        });
    }

    if (this.tenantContextService?.memberships$) {
      this.tenantContextService.memberships$
        .pipe(takeUntil(this.destroy$))
        .subscribe((memberships) => {
          this.tenantMemberships = memberships;
          this.cdr.markForCheck();
        });
    }

    if (this.tenantContextService?.loading$) {
      this.tenantContextService.loading$
        .pipe(takeUntil(this.destroy$))
        .subscribe((loading) => {
          this.tenantContextLoading = loading;
          this.cdr.markForCheck();
        });
    }

    if (this.tenantContextService?.isSuperAdmin$) {
      this.tenantContextService.isSuperAdmin$
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.cdr.markForCheck());
    }

    if (this.tenantContextService?.availableTenants$) {
      this.tenantContextService.availableTenants$
        .pipe(takeUntil(this.destroy$))
        .subscribe((tenants) => {
          this.availableTenants = tenants;
          this.cdr.markForCheck();
        });
    }

    if (this.tenantContextService?.subscriberTenants$) {
      this.tenantContextService.subscriberTenants$
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.cdr.markForCheck());
    }

    this.badgeService.refreshBadgeCounts();
    this.cdr.markForCheck();

    // Subscribe to prayers for filtering
    this.prayers$.pipe(takeUntil(this.destroy$)).subscribe((prayers) => {
      this.currentPrayers = prayers;
      this.cdr.markForCheck();
    });

    // Load admin settings (deletion and update policies)
    this.loadAdminSettings();

    // Subscribe to ALL prayers to update counts (not filtered) - with cleanup
    this.prayerService.allPrayers$
      .pipe(takeUntil(this.destroy$))
      .subscribe((prayers) => {
        this.currentPrayersCount = prayers.filter(
          (p) => p.status === "current"
        ).length;
        this.answeredPrayersCount = prayers.filter(
          (p) => p.status === "answered"
        ).length;
        this.totalPrayersCount = prayers.length;

        // Refresh badge counts when prayers data loads/changes (ensures badges show on first load)
        this.badgeService.refreshBadgeCounts();
        this.cdr.markForCheck();
      });

    // Subscribe to prompts for count - with cleanup
    this.prompts$.pipe(takeUntil(this.destroy$)).subscribe((prompts) => {
      this.promptsCount = prompts.length;
      this.cdr.markForCheck();

      // Refresh badge counts when prompts data loads/changes (ensures badges show on first load)
      this.badgeService.refreshBadgeCounts();
      this.cdr.markForCheck();
    });

    // Subscribe to admin status - with cleanup
    this.adminAuthService.isAdmin$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isAdmin) => {
        this.isAdmin = isAdmin;
      });

    // Subscribe to personal prayers from the service (automatically loaded by service on session change)
    this.prayerService.allPersonalPrayers$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (prayers) => {
        this.personalPrayers = prayers;
        this.personalPrayersCount = prayers.length;
        if (prayers.length > 0) {
          await this.extractUniqueCategories(prayers);
        }
        this.cdr.markForCheck();
      });

    this.preferredBibleTranslation = this.memorizationService.getPreferredTranslation();

    this.memorizationService.memorizedItems$
      .pipe(takeUntil(this.destroy$))
      .subscribe((items) => {
        this.memorizedItems = items;
        this.memorizedItemsCount = items.length;
        const grouped = groupItemsByMasterLevel(items);
        this.memorizedLearning = grouped.learning;
        this.memorizedPracticing = grouped.practicing;
        this.memorizedMastered = grouped.mastered;
        this.memorizationRecommendationOwnedKeys = new Set(
          items
            .filter((item) => item.kind === "verse" || item.kind == null)
            .map((item) => `${item.translation}:${item.reference}`)
        );
        this.cdr.markForCheck();
      });

    // Apply default view only after tenant context and user session have finished loading.
    // Otherwise canAccessShared stays false and setFilter forces personal prayers.
    combineLatest([
      this.userSessionService.userSession$.pipe(
        filter((session): session is UserSessionData => !!session)
      ),
      this.userSessionService.isLoading$.pipe(filter((loading) => !loading), take(1)),
      this.tenantContextService.loading$.pipe(filter((loading) => !loading), take(1)),
    ])
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe(([session]) => {
        if (this.pendingHomeReturnContext) {
          this.canAccessShared = this.tenantPermissionService.canAccessShared();
          this.applyHomeReturnContext(this.pendingHomeReturnContext);
          this.pendingHomeReturnContext = null;
          this.viewReady = true;
          this.cdr.markForCheck();
        } else {
          this.applyInitialView(session);
        }
      });
  }

  onPrayerFormClose(event: { isPersonal?: boolean }): void {
    this.showPrayerForm = false;
    // Personal prayers are automatically updated by the service observable
    // No need for manual invalidation or reload
  }

  ngOnDestroy(): void {
    // Complete the subject to unsubscribe from all observables
    this.destroy$.next();
    this.destroy$.complete();
  }

  async onPullToRefresh(): Promise<void> {
    if (!this.connectivity.requireOnline('refresh prayers')) {
      return;
    }
    const now = Date.now();
    // Avoid hammering Supabase if user pulls repeatedly
    const minIntervalMs = 30_000; // 30 seconds
    if (now - this.lastExplicitRefreshAt < minIntervalMs) {
      return;
    }

    this.lastExplicitRefreshAt = now;
    this.isRefreshing = true;
    this.cdr.markForCheck();

    try {
      const tasks: Promise<unknown>[] = [];
      // Always refresh public prayers from DB (cache-first still shows existing data immediately)
      tasks.push(this.prayerService.loadPrayers(false));

      // If user is logged in, refresh personal prayers as well
      const session = this.userSessionService.getCurrentSession();
      if (session && session.email) {
        tasks.push(this.prayerService.loadPersonalPrayers(false));
        tasks.push(this.personalCategoryColorService.loadColors(true));
        tasks.push(this.memorizationService.loadItems());
      }

      await Promise.all(tasks);
    } catch (error) {
      console.error("[HomeComponent] Error during pull-to-refresh:", error);
      this.toastService.error("Failed to refresh. Showing last saved data.");
    } finally {
      this.isRefreshing = false;
      this.cdr.markForCheck();
    }
  }

  private async loadAdminSettings(): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.client
        .from("admin_settings")
        .select("deletions_allowed, updates_allowed")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        console.error("Error loading admin settings:", error);
        return;
      }

      if (data) {
        // Load deletion and update policies from admin settings
        // These control who can delete prayers/updates and who can submit updates
        this.deletionsAllowed = data.deletions_allowed || "everyone";
        this.updatesAllowed = data.updates_allowed || "everyone";
        this.cdr.detectChanges();
      }
    } catch (err) {
      console.error("Error loading admin settings:", err);
    }
  }

  onFiltersChange(filters: PrayerFilters): void {
    // Preserve current filter state when search changes
    this.filters = {
      ...this.filters,
      searchTerm: filters.searchTerm,
    };
    this.prayerService.applyFilters({
      status: this.filters.status,
      type: this.filters.type,
      search: this.filters.searchTerm,
    });
  }

  setFilter(
    filter:
      | "current"
      | "answered"
      | "total"
      | "prompts"
      | "personal"
      | "memorize"
  ): void {
    this.canAccessShared = this.tenantPermissionService.canAccessShared();
    if (
      !this.canAccessShared &&
      filter !== "personal" &&
      filter !== "memorize"
    ) {
      this.activeFilter = "personal";
      this.prayerService.applyFilters({ search: this.filters.searchTerm });
      return;
    }
    this.activeFilter = filter;

    if (filter === "prompts") {
      // Clear prayer filters and reset prompt type selections
      this.filters = { searchTerm: this.filters.searchTerm };
      this.selectedPromptTypes = [];
      // Don't show any prayers when prompts filter is active
      this.prayerService.applyFilters({ search: "" }); // Empty results
    } else if (filter === "personal") {
      // Show personal prayers only
      this.filters = { searchTerm: this.filters.searchTerm };
      this.prayerService.applyFilters({ search: this.filters.searchTerm });
      // Personal prayers are automatically loaded via service observable subscription
    } else if (filter === "memorize") {
      this.filters = { searchTerm: this.filters.searchTerm };
      this.prayerService.applyFilters({ search: "" });
      void this.memorizationService.loadItems();
    } else if (filter === "total") {
      this.filters = { searchTerm: this.filters.searchTerm };
      this.prayerService.applyFilters({
        search: this.filters.searchTerm,
      });
    } else {
      this.filters = { status: filter, searchTerm: this.filters.searchTerm };
      this.prayerService.applyFilters({
        status: this.filters.status,
        search: this.filters.searchTerm,
      });
    }
  }

  private applyInitialView(session: UserSessionData): void {
    if (this.viewReady) {
      return;
    }

    if (this.route.snapshot.queryParamMap.get("filter") === "memorize") {
      this.setFilter("memorize");
      this.clearMemorizeFilterQueryParam();
      this.viewReady = true;
      this.cdr.markForCheck();
      return;
    }

    this.canAccessShared = this.tenantPermissionService.canAccessShared();
    const preferred = session.defaultPrayerView ?? "current";
    const filter =
      preferred === "current" || preferred === "personal"
        ? preferred
        : "current";
    this.setFilter(filter);
    this.viewReady = true;
    this.cdr.markForCheck();
  }

  private clearMemorizeFilterQueryParam(): void {
    if (this.route.snapshot.queryParamMap.get("filter") !== "memorize") {
      return;
    }
    void this.router.navigate([], {
      queryParams: { filter: null },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }

  /**
   * Update the user's default prayer view preference in database
   */
  async updateDefaultViewPreference(
    preference: "current" | "personal"
  ): Promise<boolean> {
    const email = this.userSessionService.getUserEmail();

    if (!email) {
      return false;
    }

    const tenantId = this.tenantContextService.getActiveTenant()?.id;
    if (!tenantId) {
      return false;
    }

    try {
      // Check if subscriber record exists
      const { data: existingRecord, error: fetchError } =
        await this.supabaseService.client
          .from("tenant_memberships")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("user_email", email.toLowerCase().trim())
          .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (existingRecord) {
        // Update existing record
        const { error: updateError } = await this.supabaseService.client
          .from("tenant_memberships")
          .update({ default_prayer_view: preference })
          .eq("tenant_id", tenantId)
          .eq("user_email", email.toLowerCase().trim());

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new record
        const { error: insertError } = await this.supabaseService.client
          .from("tenant_memberships")
          .insert({
            user_email: email.toLowerCase().trim(),
            name: email.split("@")[0] || "User",
            is_active: true,
            role: "member",
            receive_admin_emails: false,
            tenant_id: tenantId,
            default_prayer_view: preference,
          });

        if (insertError) {
          throw insertError;
        }
      }

      // Update UserSessionService cache to keep it in sync
      await this.userSessionService.updateUserSession({
        defaultPrayerView: preference,
      });

      return true;
    } catch (err) {
      console.error("Error updating default view preference:", err);
      return false;
    }
  }

  markAsAnswered(id: string): void {
    this.prayerService.updatePrayerStatus(id, "answered");
  }

  deletePrayer(id: string): void {
    this.prayerService.deletePrayer(id);
  }

  deletePersonalPrayer(id: string): void {
    this.prayerService.deletePersonalPrayer(id).catch((error) => {
      console.error("Error deleting personal prayer:", error);
    });
    // Service updates cache and observable automatically
  }

  async addUpdate(updateData: any): Promise<void> {
    try {
      await this.submitUpdate(updateData);
    } catch (error) {
      console.error("Error adding update:", error);
      this.toastService.error("Failed to submit update");
    }
  }

  async addPersonalUpdate(updateData: any): Promise<void> {
    try {
      const userSession = this.userSessionService.getCurrentSession();
      const author = userSession?.fullName || "Anonymous";
      const authorEmail = userSession?.email || "";

      const success = await this.prayerService.addPersonalPrayerUpdate(
        updateData.prayer_id,
        updateData.content,
        author,
        authorEmail,
        updateData.mark_as_answered || false
      );

      if (success) {
        // If update is marked as answered, set the prayer category to "Answered"
        if (updateData.mark_as_answered) {
          await this.prayerService.updatePersonalPrayer(updateData.prayer_id, {
            category: "Answered",
          });
        }
        // Service updates observable and cache automatically
      }
    } catch (error) {
      console.error("Error adding personal prayer update:", error);
      this.toastService.error("Failed to add update");
    }
  }

  async deleteUpdate(event: {
    updateId: string;
    prayerId: string;
  }): Promise<void> {
    try {
      const { updateId } = event;
      await this.prayerService.deleteUpdate(updateId);
    } catch (error) {
      console.error("Error deleting update:", error);
      this.toastService.error("Failed to delete update");
    }
  }

  async deletePersonalUpdate(event: {
    updateId: string;
    prayerId: string;
  }): Promise<void> {
    try {
      const { updateId } = event;
      const success = await this.prayerService.deletePersonalPrayerUpdate(
        updateId
      );
      if (success) {
        // Service updates cache and observable automatically
      }
    } catch (error) {
      console.error("Error deleting personal prayer update:", error);
      this.toastService.error("Failed to delete update");
    }
  }

  async onPersonalPrayerDrop(
    event: CdkDragDrop<PrayerRequest[]>
  ): Promise<void> {
    // If the index hasn't changed, no need to do anything
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    // Only allow reordering when viewing a single category
    if (this.selectedPersonalCategories.length !== 1) {
      this.toastService.error("Select a single category to reorder prayers");
      return;
    }

    try {
      this.isReorderingPersonalPrayers = true;

      // Get the filtered prayers (what the user sees)
      const filteredPrayers = this.getFilteredPersonalPrayers();

      // Get the prayer being moved
      const movedPrayer = filteredPrayers[event.previousIndex];

      // Save the original personalPrayers state for potential rollback
      const originalPersonalPrayers = [...this.personalPrayers];

      // Reorder the filtered array
      moveItemInArray(filteredPrayers, event.previousIndex, event.currentIndex);

      // Update the personalPrayers array immediately for instant visual feedback
      // Remove the moved prayer from its old position
      const oldIndex = this.personalPrayers.findIndex(
        (p) => p.id === movedPrayer.id
      );
      if (oldIndex !== -1) {
        this.personalPrayers.splice(oldIndex, 1);
      }

      // Find where to insert it based on the prayers around it in the filtered array
      const newPositionInFiltered = event.currentIndex;
      if (newPositionInFiltered === 0) {
        // Moving to first position - find the first prayer in filtered list and insert before it
        const firstPrayer = filteredPrayers[1]; // The prayer now after the moved one
        if (firstPrayer) {
          const firstIndex = this.personalPrayers.findIndex(
            (p) => p.id === firstPrayer.id
          );
          this.personalPrayers.splice(firstIndex, 0, movedPrayer);
        } else {
          // Only one prayer in category, just add it
          this.personalPrayers.push(movedPrayer);
        }
      } else {
        // Moving to middle or end - insert after the previous prayer
        const previousPrayer = filteredPrayers[newPositionInFiltered - 1];
        const previousIndex = this.personalPrayers.findIndex(
          (p) => p.id === previousPrayer.id
        );
        this.personalPrayers.splice(previousIndex + 1, 0, movedPrayer);
      }

      // Trigger immediate change detection for instant visual feedback
      this.cdr.detectChanges();

      // Persist the new order to the database (only the filtered prayers in this category)
      const success = await this.prayerService.updatePersonalPrayerOrder(
        filteredPrayers
      );

      if (success) {
        // Service updates cache and observable automatically
        this.cdr.detectChanges();
      } else {
        this.toastService.error("Failed to reorder prayers");
        // Rollback the UI to the original state
        this.personalPrayers = originalPersonalPrayers;
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error("Error reordering personal prayers:", error);
      this.toastService.error("Failed to reorder prayers");
    } finally {
      this.isReorderingPersonalPrayers = false;
    }
  }

  onCategoryDragStarted(): void {
    this.isCategoryDragging = true;
    document.body.style.cursor = "grabbing";
  }

  onCategoryDragEnded(): void {
    this.isCategoryDragging = false;
    document.body.style.cursor = "";
  }

  async onCategoryDrop(event: CdkDragDrop<string[]>): Promise<void> {
    // If the index hasn't changed, no need to do anything
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    // Prevent multiple concurrent swaps
    if (this.isSwappingCategories) {
      return;
    }

    // Make a copy of the original array to compare after
    const originalCategories = [...this.uniquePersonalCategories];

    // Immediately move item in the array for instant visual feedback
    moveItemInArray(
      this.uniquePersonalCategories,
      event.previousIndex,
      event.currentIndex
    );
    this.isSwappingCategories = true;
    this.cdr.detectChanges();

    try {
      let success = false;

      // Check if this is a simple adjacent swap (more efficient RPC method)
      const isAdjacentSwap =
        Math.abs(event.previousIndex - event.currentIndex) === 1;

      if (isAdjacentSwap) {
        // Use efficient RPC-based swap for adjacent categories (95% less egress)
        const categoryA = originalCategories[event.previousIndex];
        const categoryB = originalCategories[event.currentIndex];
        success = await this.prayerService.swapCategoryRanges(
          categoryA,
          categoryB
        );
      } else {
        // Use full reorder for non-adjacent moves (e.g., dragging from last to first)
        success = await this.prayerService.reorderCategories(
          this.uniquePersonalCategories
        );
      }

      if (success) {
        // Service updates cache and observable automatically
        // Re-extract categories from the prayers to match the new database order
        await this.extractUniqueCategories(this.personalPrayers);

        this.cdr.detectChanges();
      } else {
        this.toastService.error("Failed to reorder categories");
        // Move back to original position in UI since swap failed
        moveItemInArray(
          this.uniquePersonalCategories,
          event.currentIndex,
          event.previousIndex
        );
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error("Error reordering categories:", error);
      this.toastService.error("Failed to reorder categories");
      // Move back to original position
      moveItemInArray(
        this.uniquePersonalCategories,
        event.currentIndex,
        event.previousIndex
      );
      this.cdr.detectChanges();
    } finally {
      this.isSwappingCategories = false;
      this.cdr.detectChanges();
    }
  }

  async requestDeletion(requestData: any): Promise<void> {
    try {
      // User is logged in - submit directly without verification
      await this.submitDeletion(requestData);
    } catch (error) {
      console.error("Error requesting deletion:", error);
      this.toastService.error("Failed to submit deletion request");
    }
  }
  async requestUpdateDeletion(requestData: any): Promise<void> {
    try {
      // User is logged in - submit directly without verification
      await this.submitUpdateDeletion(requestData);
    } catch (error) {
      console.error("Error requesting update deletion:", error);
      this.toastService.error("Failed to submit update deletion request");
    }
  }

  async deletePrompt(id: string): Promise<void> {
    await this.promptService.deletePrompt(id);
  }

  togglePromptType(type: string): void {
    // If clicking the currently selected type, deselect it (show all)
    if (
      this.selectedPromptTypes.length === 1 &&
      this.selectedPromptTypes[0] === type
    ) {
      this.selectedPromptTypes = [];
    } else {
      // Select only this type (deselect all others)
      this.selectedPromptTypes = [type];
    }
  }

  isPromptTypeSelected(type: string): boolean {
    return this.selectedPromptTypes.includes(type);
  }

  togglePersonalCategory(category: string): void {
    // If clicking the currently selected category, deselect it (show all)
    if (
      this.selectedPersonalCategories.length === 1 &&
      this.selectedPersonalCategories[0] === category
    ) {
      this.selectedPersonalCategories = [];
    } else {
      // Select only this category (deselect all others)
      this.selectedPersonalCategories = [category];
    }
  }

  isPersonalCategorySelected(category: string): boolean {
    return this.selectedPersonalCategories.includes(category);
  }

  get memorizedVerseSections(): Array<{
    title: string;
    items: MemorizedItem[];
    headingClass: string;
  }> {
    const heading =
      'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2';
    const sections: Array<{
      title: string;
      items: MemorizedItem[];
      headingClass: string;
    }> = [];
    if (this.memorizedLearning.length > 0) {
      sections.push({
        title: 'Learning',
        items: this.memorizedLearning,
        headingClass: heading,
      });
    }
    if (this.memorizedPracticing.length > 0) {
      sections.push({
        title: 'Practicing',
        items: this.memorizedPracticing,
        headingClass: `${heading} mt-4`,
      });
    }
    if (this.memorizedMastered.length > 0) {
      sections.push({
        title: 'Mastered',
        items: this.memorizedMastered,
        headingClass: `${heading} mt-4`,
      });
    }
    return sections;
  }

  private async extractUniqueCategories(
    prayers: PrayerRequest[]
  ): Promise<void> {
    // Use prayer service method which sorts by display_order, pass the prayers directly
    this.uniquePersonalCategories =
      await this.prayerService.getUniqueCategoriesForUser(prayers);
    // Force immediate change detection to ensure categories render
    this.cdr.detectChanges();
  }

  getPersonalCategoryCount(category: string): number {
    return this.personalPrayers.filter((p) => p.category === category).length;
  }

  getDisplayedPrompts(): PrayerPrompt[] {
    let prompts = this.promptService.promptsSubject.value;
    if (this.activeFilter !== "prompts") return [];

    // Filter by search term if present
    if (this.filters.searchTerm && this.filters.searchTerm.trim()) {
      const searchLower = this.filters.searchTerm.toLowerCase().trim();
      prompts = prompts.filter(
        (p) =>
          p.title.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower) ||
          p.type.toLowerCase().includes(searchLower)
      );
    }

    // Filter by selected types
    if (this.selectedPromptTypes.length > 0) {
      prompts = prompts.filter((p) =>
        this.selectedPromptTypes.includes(p.type)
      );
    }

    return prompts;
  }

  getUniquePromptTypes(): string[] {
    const prompts = this.promptService.promptsSubject.value;
    const seenTypes = new Set<string>();
    const orderedTypes: string[] = [];

    prompts.forEach((p) => {
      if (!seenTypes.has(p.type)) {
        seenTypes.add(p.type);
        orderedTypes.push(p.type);
      }
    });

    return orderedTypes;
  }

  getPromptCountByType(type: string): number {
    const prompts = this.promptService.promptsSubject.value;
    return prompts.filter((p) => p.type === type).length;
  }

  /**
   * Get count of unread prompts by type (prompts with badges)
   */
  getUnreadPromptCountByType(type: string): number {
    const prompts = this.promptService.promptsSubject.value;
    return prompts.filter(
      (p) => p.type === type && this.badgeService.isPromptUnread(p.id)
    ).length;
  }

  /**
   * Get personal prayers filtered by search term and category
   */
  getFilteredPersonalPrayers(): PrayerRequest[] {
    let filtered = this.personalPrayers;

    // Filter by search term if present
    if (this.filters.searchTerm && this.filters.searchTerm.trim()) {
      const searchLower = this.filters.searchTerm.toLowerCase().trim();
      filtered = filtered.filter((p) => {
        // Search in prayer fields
        const prayerMatch =
          p.prayer_for.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower) ||
          p.title.toLowerCase().includes(searchLower);

        // Search in update content
        const updateMatch =
          p.updates &&
          p.updates.length > 0 &&
          p.updates.some(
            (update) =>
              update.content &&
              update.content.toLowerCase().includes(searchLower)
          );

        return prayerMatch || updateMatch;
      });
    }

    // Filter by selected categories
    if (this.selectedPersonalCategories.length > 0) {
      filtered = filtered.filter(
        (p) =>
          p.category && this.selectedPersonalCategories.includes(p.category)
      );
    }

    return filtered;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  private async submitUpdate(updateData: any): Promise<void> {
    await this.prayerService.addUpdate(updateData);
  }

  private async submitDeletion(requestData: any): Promise<void> {
    await this.prayerService.requestDeletion(requestData);
  }

  private async submitUpdateDeletion(requestData: any): Promise<void> {
    await this.prayerService.requestUpdateDeletion(requestData);
  }

  async logout(): Promise<void> {
    await this.adminAuthService.logout();
  }

  async handleLogout(): Promise<void> {
    this.showLogoutConfirmation = false;
    await this.logout();
  }

  openPrayerRequest(): void {
    if (!this.connectivity.requireOnline('submit a prayer')) {
      return;
    }
    this.showPrayerForm = true;
  }

  navigateToAdmin(): void {
    if (!this.connectivity.requireOnline('open the admin portal')) {
      return;
    }
    if (!this.canAccessAdminFeatures && this.tenantMemberships.length > 0) {
      this.toastService.error("Admin access is not available for this account");
      return;
    }
    this.router.navigate(["/admin"]);
  }

  getUserEmail(): string {
    // Get email from cached UserSessionService
    const cachedEmail = this.userSessionService.getUserEmail();
    if (cachedEmail) return cachedEmail;

    // Fall back to localStorage if service doesn't have it yet
    const approvalEmail = localStorage.getItem("approvalAdminEmail");
    if (approvalEmail) return approvalEmail;

    const userEmail = localStorage.getItem("userEmail");
    if (userEmail) return userEmail;

    const prayerappEmail = localStorage.getItem("prayerapp_user_email");
    if (prayerappEmail) return prayerappEmail;

    return "Not logged in";
  }

  getTenantName(membership: TenantMembership): string {
    if (Array.isArray(membership.tenants)) {
      return membership.tenants[0]?.name || membership.tenant_id;
    }
    return membership.tenants?.name || membership.tenant_id;
  }

  get tenantSwitchOptions(): Tenant[] {
    const ctx = this.tenantContextService;
    const options = ctx.getTenantSwitcherOptions();
    const unique = new Map(options.map((tenant) => [tenant.id, tenant]));
    const activeTenant = ctx.getActiveTenant();
    if (activeTenant?.id && !unique.has(activeTenant.id)) {
      unique.set(activeTenant.id, activeTenant);
    }

    return Array.from(unique.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  markAllCurrentAsRead(): void {
    this.badgeService.markAllAsReadByStatus("prayers", "current");
  }

  markAllAnsweredAsRead(): void {
    this.badgeService.markAllAsReadByStatus("prayers", "answered");
  }

  markAllPromptsAsRead(): void {
    this.badgeService.markAllAsRead("prompts");
  }

  openMemorizationPractice(item: MemorizedItem): void {
    // Focus a pre-mounted bridge input *before* creating the session. iOS only opens
    // the keyboard when focus happens on an already-present field in the tap gesture;
    // a newly mounted practice input after close→reopen is too late.
    if (memorizationNeedsKeyboardOnOpen(item)) {
      this.primeMemorizeKeyboardBridge();
    }
    this.practiceMemorizedItem = item;
    // Sync CD so the practice session mounts inside the same user-gesture turn.
    this.cdr.markForCheck();
    try {
      this.cdr.detectChanges();
    } catch {
      // Test doubles / detached views may not support full CD.
    }
  }

  /** Keep the software keyboard open across close→reopen for type/initials resume. */
  private primeMemorizeKeyboardBridge(): void {
    const input = this.memorizeKeyboardBridge?.nativeElement;
    if (!input) return;
    try {
      input.focus({ preventScroll: true });
    } catch {
      try {
        input.focus();
      } catch {
        return;
      }
    }
    try {
      input.click();
    } catch {
      // ignore
    }
  }

  openMemorizationRecommendations(): void {
    this.showMemorizationRecommendations = true;
    this.cdr.markForCheck();
    void this.memorizationRecommendationsService.load(true);
  }

  isRecommendationAlreadyAdded(
    rec: MemorizationRecommendation,
    translation: BibleTranslation
  ): boolean {
    return this.memorizedItems.some(
      (item) =>
        (item.kind === "verse" || item.kind == null) &&
        item.reference === rec.reference &&
        item.translation === translation
    );
  }

  async addRecommendedVerse(payload: MemorizationRecommendationAddPayload): Promise<void> {
    const rec = payload.recommendation;
    const translation = payload.translation;
    if (this.addingRecommendationId || this.isRecommendationAlreadyAdded(rec, translation)) {
      return;
    }
    this.addingRecommendationId = rec.id;
    this.cdr.markForCheck();
    try {
      const passage = await this.scriptureService.getPassage(
        rec.reference,
        translation
      );
      const text = passage.text?.trim();
      if (!text) {
        this.toastService.error("No text returned for this passage.");
        return;
      }
      const result = await this.memorizationService.addVerse(
        rec.reference,
        translation,
        text
      );
      if (result.ok) {
        this.toastService.success("Added to memorization list.");
      } else if (result.reason === "duplicate") {
        this.toastService.error(
          "This passage is already in your memorization list."
        );
      } else if (result.reason === "no_user") {
        this.toastService.error("Sign in to add verses to memorize.");
      } else if (result.reason === "no_tenant") {
        this.toastService.error("Select an organization to memorize verses.");
      } else {
        this.toastService.error("Could not save this passage.");
      }
    } catch (e) {
      console.error(e);
      this.toastService.error("Could not save this passage.");
    } finally {
      this.addingRecommendationId = null;
      this.cdr.markForCheck();
    }
  }

  closeMemorizationPractice(): void {
    this.practiceMemorizedItem = null;
    this.cdr.markForCheck();
  }

  async onMemorizationPracticeComplete(result: {
    wrongAttempts: number;
    correctKeystrokes: number;
    completed: boolean;
  }): Promise<void> {
    const id = this.practiceMemorizedItem?.id;
    if (!id) return;
    await this.memorizationService.updatePracticeStats(id, result);
    const updated = this.memorizationService.items.find((v) => v.id === id);
    if (updated) {
      this.practiceMemorizedItem = updated;
    }
    this.cdr.markForCheck();
  }

  onMemorizationPersistInProgress(payload: MemorizationInProgressSavePayload): void {
    const id = this.practiceMemorizedItem?.id;
    if (!id) return;
    void this.memorizationService.saveInProgress(id, payload);
  }

  onMemorizationClearInProgress(): void {
    const id = this.practiceMemorizedItem?.id;
    if (!id) return;
    void this.memorizationService.clearInProgress(id);
  }

  confirmRemoveMemorizedItem(item: MemorizedItem): void {
    this.memorizedItemToRemove = item;
    this.showRemoveMemorizedConfirm = true;
    this.cdr.markForCheck();
  }

  async removeMemorizedItemConfirmed(): Promise<void> {
    const item = this.memorizedItemToRemove;
    this.showRemoveMemorizedConfirm = false;
    this.memorizedItemToRemove = null;
    if (!item) return;
    if (this.practiceMemorizedItem?.id === item.id) {
      this.practiceMemorizedItem = null;
    }
    await this.memorizationService.removeItem(item.id);
    this.cdr.markForCheck();
  }

  openEditModal(prayer: PrayerRequest): void {
    this.editingPrayer = prayer;
    this.showEditPersonalPrayer = true;
    this.cdr.markForCheck();
  }

  onPersonalPrayerSaved(): void {
    this.showEditPersonalPrayer = false;
    this.editingPrayer = null;
    this.cdr.markForCheck();
    // Personal prayers will be refreshed via service observable subscription
  }

  openEditUpdateModal(event: { update: PrayerUpdate; prayerId: string }): void {
    this.editingUpdate = event.update;
    this.editingUpdatePrayerId = event.prayerId;
    this.showEditPersonalUpdate = true;
    this.cdr.markForCheck();
  }

  onPersonalUpdateSaved(): void {
    this.showEditPersonalUpdate = false;
    this.editingUpdate = null;
    this.editingUpdatePrayerId = "";
    this.cdr.markForCheck();
    // Personal prayers will be refreshed via service observable subscription
  }

  get presentationHandoffQueryParams(): Record<string, string> | null {
    const params = serializePresentationHomeHandoffQueryParams(
      this.getPresentationHomeHandoff()
    );
    return Object.keys(params).length > 0 ? params : null;
  }

  onPresentationLinkClick(event: MouseEvent): void {
    if (this.shouldUseNativePresentationNavigation(event)) {
      return;
    }
    event.preventDefault();
    void this.router.navigate(["/presentation"], {
      state: {
        [PRESENTATION_HOME_HANDOFF_STATE_KEY]: this.getPresentationHomeHandoff(),
      },
    });
  }

  private shouldUseNativePresentationNavigation(event: MouseEvent): boolean {
    return (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    );
  }

  private getPresentationHomeHandoff() {
    const defaultPrayerView =
      this.userSessionService.getDefaultPrayerView() ?? "current";
    const contentTypes: SelectablePresentationContentType[] = [
      mapHomeFilterToContentType(
        this.activeFilter as HomePresentationFilter,
        defaultPrayerView
      ),
    ];
    return buildPresentationHomeHandoff({
      contentTypes,
      activeFilter: this.activeFilter as HomePresentationFilter,
      selectedPromptTypes: this.selectedPromptTypes,
      selectedPersonalCategories: this.selectedPersonalCategories,
    });
  }

  private consumeHomeReturnContext(): HomeReturnContext | null {
    const state = history.state as Record<string, unknown> | null;
    const returnContext = parseHomeReturnContextFromState(state);
    if (!returnContext) {
      return null;
    }

    history.replaceState(
      { ...state, [HOME_RETURN_CONTEXT_STATE_KEY]: undefined },
      ""
    );
    return returnContext;
  }

  /** True when the post-redirect URL is the app root (home). */
  private isRouterUrlHome(urlAfterRedirects: string): boolean {
    const path =
      (urlAfterRedirects.split(/[?#]/)[0] ?? "").replace(/\/+$/, "") || "/";
    return path === "/" || path === "";
  }

  private applyHomeReturnContext(context: HomeReturnContext): void {
    this.setFilter(context.activeFilter);
    if (
      context.activeFilter === "prompts" &&
      context.selectedPromptTypes?.length
    ) {
      this.selectedPromptTypes = [...context.selectedPromptTypes];
    }
    if (
      context.activeFilter === "personal" &&
      context.selectedPersonalCategories?.length
    ) {
      this.selectedPersonalCategories = [...context.selectedPersonalCategories];
    }
    this.cdr.markForCheck();
  }
}
