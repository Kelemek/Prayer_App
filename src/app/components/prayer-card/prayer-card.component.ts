import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  TemplateRef,
} from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PrayerRequest, PrayerService, type PrayerUpdate } from '../../services/prayer.service';
import { RichTextEditorsSettingsService } from '../../services/rich-text-editors-settings.service';
import { UserSessionService } from '../../services/user-session.service';
import { BadgeService } from '../../services/badge.service';
import { PrayerEncouragementService } from '../../services/prayer-encouragement.service';
import type { PrayerUpdateRecord } from '../../lib/prayer-update-header';
import {
  getPrayerCardVariantLayout,
  type PrayerCardVariant,
} from '../../lib/prayer-card-layout';
import {
  type PrayerCardActiveFilter,
} from '../../lib/prayer-card-display';
import { applyPersonalPrayerCategoryUpdate } from '../../lib/prayer-card-personal-answered';
import {
  persistPrayForModalDoNotShowAgain,
  shouldSkipPrayForExplanationModal,
} from '../../lib/prayer-card-pray-for-modal';
import { runPrayerCardPrayFor } from '../../lib/prayer-card-pray-for-run';
import {
  type PrayerCardPermissionContext,
} from '../../lib/prayer-card-permissions';
import {
  getPrayerCardAddUpdateTourElementIds,
  type PrayerCardAddUpdateTourElementIds,
} from '../../lib/prayer-card-tour-ids';
import {
  getDisplayedPrayerCardUpdates,
  shouldShowPrayerCardUpdatesToggle,
} from '../../lib/prayer-card-updates-display';
import {
  buildPrayerCardDeletionRequest,
  buildPrayerCardUpdateDeletionRequest,
} from '../../lib/prayer-card-delete-requests';
import { getPrayerCardUserEmail } from '../../lib/prayer-card-user-context';
import { PrayerCardBadgeWire } from '../../lib/prayer-card-badge-wire';
import {
  applyPrayerCardDeleteUiPatch,
  prayerCardPrayerDeleteClickPatch,
  prayerCardToggleAddUpdatePatch,
  prayerCardUpdateDeleteClickPatch,
  type PrayerCardDeleteUiState,
} from '../../lib/prayer-card-delete-ui';
import {
  buildPrayerCardAddUpdateEvent,
  personalAnsweredStatusModalMode,
  prayerCardUpdateActionsMode,
  prayerUpdateFromRecord,
} from '../../lib/prayer-card-mutations';
import { computePrayerCardViewState } from '../../lib/prayer-card-view-state';
import type {
  PrayerCardAddUpdateEvent,
  PrayerCardDeleteUpdateEvent,
  PrayerCardDeletionRequest,
  PrayerCardToggleAnsweredEvent,
  PrayerCardUpdateDeletionRequest,
} from '../../lib/prayer-card-events';
import { PrayerCardActionsRowComponent } from './prayer-card-actions-row.component';
import { PrayerCardModalsStackComponent } from './prayer-card-modals-stack.component';
import { PrayerCardTitleBodyComponent } from './prayer-card-title-body.component';
import { PrayerCardUpdatesSectionComponent } from './prayer-card-updates-section.component';
import type { PrayerAddUpdatePayload } from '../prayer-add-update-modal/prayer-add-update-modal.component';
import { PrayerDeleteRequestPayload } from '../prayer-delete-request-modal/prayer-delete-request-modal.component';
import { PrayerCardMetaHeaderComponent } from '../prayer-card-meta-header/prayer-card-meta-header.component';
import type { PersonalPrayerAnsweredStatusMode } from '../personal-prayer-answered-status-modal/personal-prayer-answered-status-modal.component';
import {
  getPrayerStatusLabel,
  getPrayerStatusPillClasses,
} from '../../lib/prayer-status-header';
import { formatPrayerCardShortDate } from '../../lib/prayer-update-header';

@Component({
  selector: 'app-prayer-card',
  standalone: true,
  imports: [
    CommonModule,
    NgTemplateOutlet,
    PrayerCardMetaHeaderComponent,
    PrayerCardActionsRowComponent,
    PrayerCardTitleBodyComponent,
    PrayerCardModalsStackComponent,
    PrayerCardUpdatesSectionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.contents]': 'variant === "presentation"',
    '[class.block]': 'variant !== "presentation"',
  },
  templateUrl: './prayer-card.component.html',
  styles: [],
})
export class PrayerCardComponent
  implements OnInit, OnChanges, OnDestroy, PrayerCardDeleteUiState
{
  @Input() variant: PrayerCardVariant = 'home';
  @Input() prayer!: PrayerRequest;
  @Input() isAdmin = false;
  @Input() isPersonal = false;
  @Input() isDragging = false;
  @Input() dragHandle: TemplateRef<unknown> | null = null;
  @Input() personalDragHandle = false;
  @Input() personalDragTourId: string | null = null;
  @Input() deletionsAllowed: PrayerCardPermissionContext['deletionsAllowed'] =
    'everyone';
  @Input() updatesAllowed: PrayerCardPermissionContext['updatesAllowed'] =
    'everyone';
  @Input() activeFilter: PrayerCardActiveFilter = 'total';
  @Input() tourUpdateAnchors = false;
  @Input() tourPrayForEncouragementAnchors = false;
  @Input() tourPrayerReminderBellAnchors = false;
  @Input() tourPersonalWalkthroughAnchors = false;

  @Output() delete = new EventEmitter<string>();
  @Output() addUpdate = new EventEmitter<PrayerCardAddUpdateEvent>();
  @Output() deleteUpdate = new EventEmitter<PrayerCardDeleteUpdateEvent>();
  @Output() requestDeletion = new EventEmitter<PrayerCardDeletionRequest>();
  @Output() requestUpdateDeletion =
    new EventEmitter<PrayerCardUpdateDeletionRequest>();
  @Output() editPersonalPrayer = new EventEmitter<PrayerRequest>();
  @Output() editPersonalUpdate = new EventEmitter<{
    update: PrayerUpdate;
    prayerId: string;
  }>();
  @Output() edit = new EventEmitter<PrayerRequest>();
  @Output() editMemberUpdate = new EventEmitter<{
    update: PrayerUpdate;
    prayerId: string;
  }>();
  @Output() toggleUpdateAnswered =
    new EventEmitter<PrayerCardToggleAnsweredEvent>();
  @Output() toggleMemberUpdateAnswered =
    new EventEmitter<PrayerCardToggleAnsweredEvent>();
  @Output() categoryPickerOpenChange = new EventEmitter<boolean>();
  @Output() prayedForCountChange = new EventEmitter<{
    prayerId: string;
    count: number;
  }>();
  @Output() personalPrayerCategoryChange = new EventEmitter<{
    prayerId: string;
    category: string | null;
    status: string;
  }>();

  prayerBadge$: Observable<boolean> | null = null;
  canPrayFor$ = of(true);
  private badgeWire!: PrayerCardBadgeWire;
  private destroy$ = new Subject<void>();

  showAddUpdateForm = false;
  showDeleteRequestForm = false;
  showUpdateDeleteRequestForm: string | null = null;
  showAllUpdates = false;
  showConfirmationDialog = false;
  showShareModal = false;
  isShareLoading = false;
  showUpdateConfirmationDialog = false;
  personalAnsweredStatusModalMode: PersonalPrayerAnsweredStatusMode | null =
    null;
  updateConfirmationTitle = '';
  updateConfirmationMessage = '';
  updateConfirmationId: string | null = null;
  showPrayForModal = false;
  richTextEditorsEnabled = true;
  categoryPickerOpen = false;
  private isTogglingPersonalAnswered = false;

  constructor(
    public userSessionService: UserSessionService,
    public badgeService: BadgeService,
    private prayerService: PrayerService,
    public prayerEncouragementService: PrayerEncouragementService,
    private cdr: ChangeDetectorRef,
    richTextEditorsSettings: RichTextEditorsSettingsService
  ) {
    this.badgeWire = new PrayerCardBadgeWire(this.badgeService, () => this.prayer);
    richTextEditorsSettings
      .getRichTextEditorsEnabled$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((v) => {
        this.richTextEditorsEnabled = v;
        this.cdr.markForCheck();
      });
  }

  get updateBadges$(): PrayerCardBadgeWire['updateBadges$'] {
    return this.badgeWire.updateBadges$;
  }

  ngOnInit(): void {
    this.prayerBadge$ = this.badgeWire.prayerBadge$;
    this.badgeWire.init(this.destroy$);
    this.refreshCanPrayFor$();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['prayer'] || changes['isPersonal'] || changes['variant']) {
      this.refreshCanPrayFor$();
    }
    if (changes['prayer']) {
      const previousId = changes['prayer'].previousValue?.id;
      const currentId = changes['prayer'].currentValue?.id;
      if (previousId !== currentId) {
        this.showPrayForModal = false;
        this.cdr.markForCheck();
      }
      if (!changes['prayer'].firstChange) {
        this.badgeWire.onPrayerChanged(
          changes['prayer'].previousValue as PrayerRequest,
          changes['prayer'].currentValue as PrayerRequest
        );
      }
    }
  }

  ngOnDestroy(): void {
    this.badgeWire.destroy();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get variantLayout() {
    return getPrayerCardVariantLayout(this.variant);
  }

  get showTourAnchors(): boolean {
    return this.variantLayout.showTourAnchors;
  }

  get prayerUpdateList(): PrayerUpdateRecord[] {
    return this.prayer.updates ?? [];
  }

  get viewState() {
    return computePrayerCardViewState({
      variant: this.variant,
      prayer: this.prayer,
      isAdmin: this.isAdmin,
      isPersonal: this.isPersonal,
      activeFilter: this.activeFilter,
      deletionsAllowed: this.deletionsAllowed,
      updatesAllowed: this.updatesAllowed,
      reminderSessionEmail: '',
      currentUserEmail: getPrayerCardUserEmail(this.userSessionService),
    });
  }

  getBorderClass(): string {
    return this.viewState.borderClass;
  }

  shellClasses(): string {
    return this.viewState.shellClasses;
  }

  displayRequester(): string {
    return this.viewState.displayRequester;
  }

  getStatusLabel(): string {
    return getPrayerStatusLabel(this.prayer.status);
  }

  getStatusBadgeClasses(): string {
    return getPrayerStatusPillClasses(this.prayer.status);
  }

  showDeleteButton(): boolean {
    return this.viewState.showDeleteButton;
  }

  showAddUpdateButton(): boolean {
    return this.viewState.showAddUpdateButton;
  }

  showUpdateDeleteButton(): boolean {
    return this.viewState.showUpdateDeleteButton;
  }

  showPrayedForBadge(): boolean {
    return this.viewState.showPrayedForBadge;
  }

  recentUpdatesNeedsTopMargin(): boolean {
    return this.viewState.showAddUpdateButton;
  }

  formatDate(dateString: string): string {
    return formatPrayerCardShortDate(dateString);
  }

  getUpdateDisplayDate(update: PrayerUpdateRecord): string {
    return formatPrayerCardShortDate(update.updated_at || update.created_at);
  }

  private refreshCanPrayFor$(): void {
    if (!this.prayer?.id || !this.prayerEncouragementService?.getCanPrayFor$) {
      this.canPrayFor$ = of(true);
      return;
    }
    this.canPrayFor$ = this.prayerEncouragementService.getCanPrayFor$(
      this.prayer.id,
      this.viewState.usesPersonalCooldown
    );
  }

  onPrayForClick(): void {
    if (shouldSkipPrayForExplanationModal()) {
      void this.confirmPrayFor();
      return;
    }
    this.showPrayForModal = true;
    this.cdr.markForCheck();
  }

  onConfirmPrayForFromModal(doNotShowAgain: boolean): void {
    if (doNotShowAgain) {
      persistPrayForModalDoNotShowAgain();
    }
    this.showPrayForModal = false;
    void this.confirmPrayFor();
    this.cdr.markForCheck();
  }

  onCancelPrayForModal(): void {
    this.showPrayForModal = false;
    this.cdr.markForCheck();
  }

  async confirmPrayFor(): Promise<void> {
    this.showPrayForModal = false;
    const prayedForPrayer = this.prayer;
    const prayerId = prayedForPrayer.id;
    const { isMember, usesPersonalCooldown } = this.viewState;

    const newCount = await runPrayerCardPrayFor(
      {
        prayerService: this.prayerService,
        prayerEncouragementService: this.prayerEncouragementService,
      },
      {
        prayerId,
        isMember,
        isPersonal: this.isPersonal,
        usePersonalCooldown: usesPersonalCooldown,
      }
    );

    if (newCount === null) {
      this.cdr.markForCheck();
      return;
    }

    prayedForPrayer.prayed_for_count = newCount;
    if (this.prayer?.id === prayerId) {
      this.prayer = { ...this.prayer, prayed_for_count: newCount };
    }
    this.prayedForCountChange.emit({ prayerId, count: newCount });
    this.cdr.markForCheck();
  }

  handleDeleteClick(): void {
    applyPrayerCardDeleteUiPatch(
      this,
      prayerCardPrayerDeleteClickPatch(
        this.isAdmin,
        this.isPersonal,
        this.showDeleteRequestForm
      )
    );
    this.cdr.markForCheck();
  }

  onConfirmDelete(): void {
    this.delete.emit(this.prayer.id);
    this.showConfirmationDialog = false;
  }

  onCancelDelete(): void {
    this.showConfirmationDialog = false;
  }

  onConfirmUpdateDelete(): void {
    if (!this.updateConfirmationId) return;
    const updateId = this.updateConfirmationId;
    this.showUpdateConfirmationDialog = false;
    this.updateConfirmationId = null;
    this.deleteUpdate.emit({ updateId, prayerId: this.prayer.id });
  }

  onCancelUpdateDelete(): void {
    this.showUpdateConfirmationDialog = false;
    this.updateConfirmationId = null;
  }

  toggleAddUpdate(): void {
    applyPrayerCardDeleteUiPatch(
      this,
      prayerCardToggleAddUpdatePatch(this.showAddUpdateForm)
    );
    this.cdr.markForCheck();
  }

  get addUpdateTourElementIds(): PrayerCardAddUpdateTourElementIds | null {
    return getPrayerCardAddUpdateTourElementIds(
      this.tourPersonalWalkthroughAnchors,
      this.tourUpdateAnchors
    );
  }

  closeAddUpdateForm(): void {
    this.showAddUpdateForm = false;
    this.cdr.markForCheck();
  }

  onAddUpdateSubmit(payload: PrayerAddUpdatePayload): void {
    this.addUpdate.emit(
      buildPrayerCardAddUpdateEvent(
        this.prayer.id,
        payload,
        this.userSessionService
      )
    );
    this.showAddUpdateForm = false;
    this.cdr.markForCheck();
  }

  closeAllDeleteRequestForms(): void {
    this.showDeleteRequestForm = false;
    this.showUpdateDeleteRequestForm = null;
    this.cdr.markForCheck();
  }

  onDeleteRequestModalSubmit(payload: PrayerDeleteRequestPayload): void {
    if (this.showUpdateDeleteRequestForm) {
      this.onUpdateDeleteRequestSubmit(payload);
    } else {
      this.onDeleteRequestSubmit(payload);
    }
  }

  onDeleteRequestSubmit(payload: PrayerDeleteRequestPayload): void {
    this.requestDeletion.emit(
      buildPrayerCardDeletionRequest(
        this.prayer.id,
        payload.reason,
        this.userSessionService
      )
    );
    this.showDeleteRequestForm = false;
    this.cdr.markForCheck();
  }

  handleDeleteUpdate(updateId: string): void {
    applyPrayerCardDeleteUiPatch(
      this,
      prayerCardUpdateDeleteClickPatch(
        this.isAdmin,
        this.isPersonal,
        updateId,
        this.showUpdateDeleteRequestForm
      )
    );
    this.cdr.markForCheck();
  }

  getDisplayedUpdates(): PrayerUpdateRecord[] {
    return getDisplayedPrayerCardUpdates(
      this.prayerUpdateList,
      this.showAllUpdates
    );
  }

  shouldShowToggleButton(): boolean {
    return shouldShowPrayerCardUpdatesToggle(
      this.prayerUpdateList,
      this.getDisplayedUpdates(),
      this.showAllUpdates
    );
  }

  toggleShowAllUpdates(): void {
    this.showAllUpdates = !this.showAllUpdates;
    this.cdr.markForCheck();
  }

  onUpdateDeleteRequestSubmit(payload: PrayerDeleteRequestPayload): void {
    if (!this.showUpdateDeleteRequestForm) return;

    this.requestUpdateDeletion.emit(
      buildPrayerCardUpdateDeletionRequest(
        this.showUpdateDeleteRequestForm,
        payload.reason,
        this.userSessionService
      )
    );
    this.showUpdateDeleteRequestForm = null;
    this.cdr.markForCheck();
  }

  markPrayerAsRead(): void {
    this.badgeService.markPrayerAsRead(this.prayer.id);
  }

  markUpdateAsRead(updateId: string): void {
    try {
      this.badgeWire.markUpdateRead(updateId, this.prayer.id);
    } catch (error) {
      console.warn('Failed to mark update as read:', error);
    }
  }

  getUpdateActionsMode() {
    return prayerCardUpdateActionsMode(
      this.isPersonal,
      this.viewState.isMember
    );
  }

  onUpdateEdit(update: PrayerUpdateRecord): void {
    const payload = prayerUpdateFromRecord(update, this.prayer.id);
    if (this.isPersonal) {
      this.editPersonalUpdate.emit({
        update: payload,
        prayerId: this.prayer.id,
      });
      return;
    }
    if (this.viewState.isMember) {
      this.editMemberUpdate.emit({ update: payload, prayerId: this.prayer.id });
    }
  }

  onMemberUpdateAnsweredToggle(update: PrayerUpdateRecord): void {
    const event = {
      updateId: update.id,
      prayerId: this.prayer.id,
      isAnswered: !update.is_answered,
    };
    this.toggleUpdateAnswered.emit(event);
    this.toggleMemberUpdateAnswered.emit(event);
  }

  onPersonalAnsweredClick(): void {
    if (!this.isPersonal || this.isTogglingPersonalAnswered) {
      return;
    }

    this.personalAnsweredStatusModalMode =
      personalAnsweredStatusModalMode(this.prayer.category);
    this.cdr.markForCheck();
  }

  closePersonalAnsweredStatusModal(): void {
    this.personalAnsweredStatusModalMode = null;
    this.cdr.markForCheck();
  }

  onConfirmPersonalAnswered(): void {
    this.personalAnsweredStatusModalMode = null;
    void this.applyPersonalAnsweredCategory('Answered');
  }

  onConfirmPersonalUnanswered(category: string | null): void {
    this.personalAnsweredStatusModalMode = null;
    void this.applyPersonalAnsweredCategory(category);
  }

  async applyPersonalAnsweredCategory(category: string | null): Promise<void> {
    if (!this.isPersonal || this.isTogglingPersonalAnswered) {
      return;
    }

    this.isTogglingPersonalAnswered = true;
    this.cdr.markForCheck();
    try {
      const result = await applyPersonalPrayerCategoryUpdate(
        this.prayerService,
        this.prayer.id,
        category
      );
      if (result) {
        this.prayer = {
          ...this.prayer,
          category: result.category ?? undefined,
          status: result.status,
        };
        this.personalPrayerCategoryChange.emit({
          prayerId: this.prayer.id,
          category: result.category,
          status: result.status,
        });
      }
    } finally {
      this.isTogglingPersonalAnswered = false;
      this.cdr.markForCheck();
    }
  }

  async handleSharePrayer(): Promise<void> {
    if (!this.isPersonal) return;

    try {
      this.isShareLoading = true;
      await this.prayerService.sharePrayerForApproval(this.prayer.id);
      this.showShareModal = false;
      this.delete.emit(this.prayer.id);
    } catch (error) {
      console.error('Error sharing prayer:', error);
    } finally {
      this.isShareLoading = false;
    }
  }
}
