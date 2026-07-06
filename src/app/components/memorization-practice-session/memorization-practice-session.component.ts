import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ScriptureService } from '../../services/scripture.service';
import type { PracticeSessionResult } from '../../services/memorization.service';
import {
  isMemorizationListenTranslation,
  type MemorizationInProgressSavePayload,
  type MemorizationPracticeMode,
  type MemorizedItem,
} from '../../types/memorization';
import {
  pickRandomAllDoneMessage,
  pickRandomRoundAffirmation,
} from '../../lib/memorization/memorizationEncouragementMessages';
import { scrollMemorizeBlankNearestInPracticeColumn } from '../../lib/memorization/memorizationScrollIntoPractice';
import {
  isMemorizeAndroidWebHost,
  isMemorizeIosWebHost,
} from '../../lib/memorization/memorizationViewportPlatform';
import { getMemorizationListenUtteranceText } from '../../lib/memorization/memorizationListenUtteranceText';
import {
  booksForScope,
  isBibleBooksMemorizationItem,
} from '../../lib/memorization/bibleBooksMemorization';
import {
  applyMemorizeListenPlaybackRateToMediaElement,
  MEMORIZE_LISTEN_REPEAT_GAP_MS,
  MemorizeListenSpeed,
  readMemorizeListenSpeedFromStorage,
  toMemorizeWebSpeechUtteranceRate,
  writeMemorizeListenSpeedToStorage,
} from '../../lib/memorization/memorizeListenSpeedStorage';
import {
  MEMORIZATION_FULL_HIDE_ROUND,
  buildInitialReorderSlotAssignment,
  buildBibleBooksReorderChunks,
  buildMemorizationChoiceLabels,
  buildMemorizationReorderChunks,
  buildMemorizationTokens,
  cueGlyphForTypableToken,
  firstLetterOfWord,
  formatMemorizationTokensPlain,
  generateMemorizationSessionSeed,
  getTypableTokenIndices,
  hiddenFractionForRound,
  pickHiddenCueTypableSlotIndices,
  pickHiddenWordIndices,
  pickReorderMovableIndices,
  reorderMovableCountForRound,
  reorderReferenceColonAfterSlotIndex,
  seedRandom,
  stringToSeed,
  type MemorizationToken,
} from '../../lib/memorization/memorizationPracticeUtils';
import { MemorizationReorderPanelComponent } from '../memorization-reorder-panel/memorization-reorder-panel.component';
import { MemorizeListenControlsDialogComponent } from '../memorize-listen-controls-dialog/memorize-listen-controls-dialog.component';
import { BibleBooksMemorizationListComponent } from '../bible-books-memorization-list/bible-books-memorization-list.component';

export type { PracticeSessionResult };

type Phase = 'intro' | 'practicing' | 'done';

const MAX_WRONG_BEFORE_REVEAL = 3;
const MEMORIZATION_WORD_CHOICE_COUNT_WORD = 8;
const MEMORIZATION_WORD_CHOICE_COUNT_DIGIT = 4;
const MEMORIZE_EXTRA_GAP_ABOVE_KEYBOARD_PX = 48;
const MEMORIZE_HINT_EXTRA_PEEK_INTERVAL_MS = 1000;
const ANDROID_SCROLL_CLAMP_MS = 600;
const MEMORIZE_LISTEN_CONTROLS_DIALOG_ID = 'memorize-listen-controls-dialog';
const MEMORIZE_LISTEN_CONTROLS_TITLE_ID = 'memorize-listen-controls-title';

const MEMORIZE_INTRO_START_ROUND_OPTIONS = Array.from(
  { length: MEMORIZATION_FULL_HIDE_ROUND },
  (_, i) => ({ value: i + 1, label: `Round ${i + 1}` })
);

function isKeyboardPracticeMode(mode: MemorizationPracticeMode | null): boolean {
  return mode === 'type' || mode === 'firstLetters';
}

function hiddenTypingTokenIndices(
  mode: MemorizationPracticeMode | null | undefined,
  roundIndex: number,
  seed: string,
  typableIndices: number[]
): Set<number> {
  if (mode === 'firstLetters') return new Set(typableIndices);
  const localHidden = pickHiddenWordIndices(typableIndices.length, roundIndex, seed);
  return new Set([...localHidden].map((li) => typableIndices[li]!));
}

@Component({
  selector: 'app-memorization-practice-session',
  standalone: true,
  imports: [
    CommonModule,
    MemorizationReorderPanelComponent,
    MemorizeListenControlsDialogComponent,
    BibleBooksMemorizationListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './memorization-practice-session.component.html',
})
export class MemorizationPracticeSessionComponent
  implements OnChanges, OnDestroy, AfterViewInit
{
  private readonly document = inject(DOCUMENT);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly scripture = inject(ScriptureService);

  @Input({ required: true }) item!: MemorizedItem;
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();
  @Output() completed = new EventEmitter<PracticeSessionResult>();
  @Output() persistInProgress = new EventEmitter<MemorizationInProgressSavePayload>();
  @Output() clearInProgress = new EventEmitter<void>();

  @ViewChild('practiceScroll') practiceScrollRef?: ElementRef<HTMLDivElement>;
  @ViewChild('firstLetterCuesViewport') firstLetterCuesViewportRef?: ElementRef<HTMLDivElement>;
  @ViewChild('practiceWordsWord') practiceWordsWordRef?: ElementRef<HTMLDivElement>;
  @ViewChild('practiceWordsType') practiceWordsTypeRef?: ElementRef<HTMLLabelElement>;
  @ViewChild('practiceInput') practiceInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('passageAudio') passageAudioRef?: ElementRef<HTMLAudioElement>;
  @ViewChild('hintButton') hintButtonRef?: ElementRef<HTMLButtonElement>;

  readonly MEMORIZATION_FULL_HIDE_ROUND = MEMORIZATION_FULL_HIDE_ROUND;
  readonly MEMORIZE_LISTEN_CONTROLS_DIALOG_ID = MEMORIZE_LISTEN_CONTROLS_DIALOG_ID;
  readonly MEMORIZE_LISTEN_CONTROLS_TITLE_ID = MEMORIZE_LISTEN_CONTROLS_TITLE_ID;
  readonly startRoundOptions = MEMORIZE_INTRO_START_ROUND_OPTIONS;
  readonly formatMemorizationTokensPlain = formatMemorizationTokensPlain;
  readonly hiddenFractionForRound = hiddenFractionForRound;
  readonly reorderMovableCountForRound = reorderMovableCountForRound;
  readonly cueGlyphForTypableToken = cueGlyphForTypableToken;
  readonly isKeyboardPracticeMode = isKeyboardPracticeMode;
  readonly Math = Math;

  phase: Phase = 'intro';
  practiceMode: MemorizationPracticeMode | null = null;
  modePickerOpen = false;
  startRoundChoice = 1;
  roundIndex = 0;
  hasTypedInRound = false;
  hiddenIndices = new Set<number>();
  revealed = new Set<number>();
  firstLetterCueRevealedSlots = new Set<number>();
  reorderSlotChunkIds: number[] = [];
  reorderRoundMovableIndices = new Set<number>();
  wrongAttemptsTotal = 0;
  correctKeystrokesTotal = 0;
  flashError = false;
  hintHeld = false;
  hintPeekCount = 1;
  awaitingRoundAdvance = false;
  roundAffirmation = '';
  completionMessage = '';
  keyboardInsetPx = 0;
  listenPanelOpen = false;
  listenPlaybackRate: MemorizeListenSpeed = 1;
  repeatListenOn = false;
  passageAudioPlaying = false;
  listenUiTick = 0;

  tokens: MemorizationToken[] = [];
  reorderChunks = reorderChunksEmpty();
  reorderColonAfterSlotIndex: number | null = null;
  typableIndices: number[] = [];
  isBibleBooks = false;
  memorizeAndroidHost = false;
  listenViaStreamingAudio = false;
  translationListenEnabled = false;
  passageAudioUrl: string | null = null;

  private sessionSeed = '';
  private practiceCompleted = false;
  private roundAdvanceHandled: number | null = null;
  private wrongAttemptsRef = 0;
  private correctKeystrokesRef = 0;
  private awaitingRoundAdvanceRef = false;
  private practiceModeRef: MemorizationPracticeMode | null = null;
  private androidScrollClampUntil = 0;
  private suppressInputFromKeydown = false;
  private openedLayoutOnceForVerseId: string | null = null;
  private lastVerseIdForLayout = '';
  private lastAudioResetVerseId: string | null = null;
  private memorizeListenTtsRateAtStart: MemorizeListenSpeed | null = null;
  private memorizeListenTtsUserPaused = false;
  private memorizeListenTtsPostResume = false;
  private memorizeWebSpeechUtteranceIsOurs = false;
  private listenPlaybackRateRef: MemorizeListenSpeed = 1;
  private repeatListenOnRef = false;
  private listenRepeatGapTimer: ReturnType<typeof setTimeout> | null = null;
  private hintIntervalId: ReturnType<typeof setInterval> | null = null;
  private flashErrorTimer: ReturnType<typeof setTimeout> | null = null;
  private viewportListenersAttached = false;
  private androidScrollListener: (() => void) | null = null;
  private verseTouchMoved = false;
  private verseTouchStart = { x: 0, y: 0 };
  private practiceInputDomId = `memorize-practice-input-${Math.random().toString(36).slice(2, 9)}`;
  private modePickerTitleId = `memorize-mode-picker-${Math.random().toString(36).slice(2, 9)}`;
  private resizeObserver: ResizeObserver | null = null;
  private hintCaptureListenersAttached = false;
  private typeCaptureListenersAttached = false;

  get hintActive(): boolean {
    return this.hintHeld && this.phase === 'practicing';
  }

  get hiddenSorted(): number[] {
    return [...this.hiddenIndices].sort((a, b) => a - b);
  }

  get unrevealedHiddenSorted(): number[] {
    return this.hiddenSorted.filter((i) => !this.revealed.has(i));
  }

  get hintPeekIndices(): Set<number> {
    if (!this.hintActive) return new Set();
    return new Set(this.unrevealedHiddenSorted.slice(0, this.hintPeekCount));
  }

  get currentTargetIndex(): number | null {
    for (const idx of this.hiddenSorted) {
      if (!this.revealed.has(idx)) return idx;
    }
    return null;
  }

  get currentTargetToken(): MemorizationToken | null {
    return this.currentTargetIndex !== null
      ? (this.tokens[this.currentTargetIndex] ?? null)
      : null;
  }

  get firstLetterCueHiddenSlots(): Set<number> {
    if (this.practiceMode !== 'firstLetters' || this.phase !== 'practicing') return new Set();
    const seed = this.sessionSeed || this.item.id;
    return pickHiddenCueTypableSlotIndices(this.typableIndices.length, this.roundIndex, seed);
  }

  get listenInteractionAllowed(): boolean {
    return (
      this.translationListenEnabled &&
      (this.phase === 'intro' || (this.phase === 'practicing' && !this.awaitingRoundAdvance))
    );
  }

  get showListenOpeners(): boolean {
    return this.listenInteractionAllowed;
  }

  get showStartOver(): boolean {
    return this.phase === 'practicing' || (this.phase === 'intro' && !!this.item.inProgressPractice);
  }

  get listenButtonLabel(): string {
    void this.listenUiTick;
    if (this.listenViaStreamingAudio) {
      const el = this.passageAudioRef?.nativeElement;
      if (el?.getAttribute('src')) {
        return !el.paused && !el.ended ? 'Pause' : 'Listen';
      }
      return this.passageAudioPlaying ? 'Pause' : 'Listen';
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return 'Listen';
    const syn = window.speechSynthesis;
    if (this.memorizeListenTtsUserPaused) return 'Listen';
    if (this.memorizeListenTtsPostResume && syn.speaking) return 'Pause';
    if (syn.speaking && !syn.paused) return 'Pause';
    return 'Listen';
  }

  get listenAriaPressed(): boolean {
    void this.listenUiTick;
    if (this.listenViaStreamingAudio) {
      const el = this.passageAudioRef?.nativeElement;
      if (el?.getAttribute('src')) return !el.paused && !el.ended;
      return this.passageAudioPlaying;
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    const syn = window.speechSynthesis;
    if (this.memorizeListenTtsUserPaused) return false;
    if (this.memorizeListenTtsPostResume && syn.speaking) return true;
    return syn.speaking && !syn.paused;
  }

  get readAloudDialogPrimaryLabel(): string {
    return this.listenButtonLabel === 'Listen' ? 'Play' : this.listenButtonLabel;
  }

  get readAloudDialogPrimaryAriaLabel(): string {
    if (this.listenButtonLabel === 'Pause') return 'Pause read-aloud of the passage';
    if (this.listenViaStreamingAudio) return 'Play the passage read aloud (ESV audio)';
    return 'Play: read the memorized text aloud using the device (same translation is not available as streaming audio)';
  }

  get wordChoiceLabels(): string[] {
    if (this.practiceMode !== 'word') return [];
    if (this.phase !== 'practicing' || this.awaitingRoundAdvance) return [];
    if (this.currentTargetIndex === null || !this.sessionSeed) return [];
    const rng = seedRandom(
      stringToSeed(`${this.sessionSeed}-mem-word-r${this.roundIndex}-t${this.currentTargetIndex}`)
    );
    const targetTok = this.tokens[this.currentTargetIndex];
    const choiceCount =
      targetTok?.kind === 'digit'
        ? MEMORIZATION_WORD_CHOICE_COUNT_DIGIT
        : MEMORIZATION_WORD_CHOICE_COUNT_WORD;
    return buildMemorizationChoiceLabels(
      this.tokens,
      this.typableIndices,
      this.currentTargetIndex,
      choiceCount,
      rng
    );
  }

  get practiceScrollElement(): HTMLDivElement | null {
    return this.practiceScrollRef?.nativeElement ?? null;
  }

  get practiceInputId(): string {
    return this.practiceInputDomId;
  }

  get modePickerTitle(): string {
    return this.modePickerTitleId;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item']) {
      this.recomputeDerivedFromItem();
      this.handleItemIdChange();
    }
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.onOpen();
      } else {
        this.onCloseCleanup();
      }
    }
  }

  ngAfterViewInit(): void {
    this.syncRefs();
    this.attachPracticeListeners();
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.onCloseCleanup();
    this.detachAllListeners();
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    if (!this.isOpen || event.key !== 'Escape') return;
    if (this.modePickerOpen) {
      this.modePickerOpen = false;
      this.cdr.markForCheck();
      return;
    }
    if (this.listenPanelOpen) {
      this.listenPanelOpen = false;
      this.cdr.markForCheck();
      return;
    }
    this.handleClose();
  }

  onBackdropNothing(): void {
    // Fullscreen modal — close only via explicit buttons / Escape.
  }

  handleClose(): void {
    this.listenPanelOpen = false;
    this.stopPassageAudio();
    if (this.sessionSeed && this.phase === 'practicing') {
      if (this.awaitingRoundAdvance) {
        this.persistPracticeSnapshot({ kind: 'betweenRounds', completedRoundIndex: this.roundIndex });
      } else {
        this.persistPracticeSnapshot({ kind: 'inRound', roundIndex: this.roundIndex });
      }
    }
    this.closed.emit();
  }

  handleStartOver(): void {
    this.listenPanelOpen = false;
    this.stopPassageAudio();
    this.clearInProgress.emit();
    this.sessionSeed = '';
    this.practiceCompleted = false;
    this.roundAdvanceHandled = null;
    this.openedLayoutOnceForVerseId = null;
    this.lastVerseIdForLayout = this.item.id;
    this.resetToIntro();
    this.cdr.markForCheck();
  }

  openModePicker(): void {
    this.modePickerOpen = true;
    this.cdr.markForCheck();
  }

  closeModePicker(): void {
    this.modePickerOpen = false;
    this.cdr.markForCheck();
  }

  beginPracticeWithMode(mode: MemorizationPracticeMode): void {
    this.stopPassageAudio();
    this.modePickerOpen = false;
    this.practiceCompleted = false;
    this.sessionSeed = generateMemorizationSessionSeed();
    this.practiceModeRef = mode;
    const r = Math.min(MEMORIZATION_FULL_HIDE_ROUND, Math.max(1, Math.floor(this.startRoundChoice)));
    this.practiceMode = mode;
    this.startRound(r);
    if (this.practiceScrollRef?.nativeElement) {
      this.practiceScrollRef.nativeElement.scrollTop = 0;
    }
    if (isKeyboardPracticeMode(mode)) {
      this.focusPracticeInput();
    }
    this.persistInProgress.emit({
      sessionSeed: this.sessionSeed,
      wrongAttempts: 0,
      correctKeystrokes: 0,
      phase: { kind: 'inRound', roundIndex: r },
      practiceMode: mode,
    });
    this.cdr.markForCheck();
  }

  startRoundAndFocusInput(r: number): void {
    this.startRound(r);
    if (this.practiceScrollRef?.nativeElement) {
      this.practiceScrollRef.nativeElement.scrollTop = 0;
    }
    if (isKeyboardPracticeMode(this.practiceModeRef)) {
      this.focusPracticeInput();
    }
    this.cdr.markForCheck();
  }

  repeatRound(): void {
    this.persistPracticeSnapshot({ kind: 'inRound', roundIndex: this.roundIndex });
    this.startRoundAndFocusInput(this.roundIndex);
  }

  nextRound(): void {
    this.persistPracticeSnapshot({ kind: 'inRound', roundIndex: this.roundIndex + 1 });
    this.startRoundAndFocusInput(this.roundIndex + 1);
  }

  onHintPointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.hintPeekCount = 1;
    this.hintHeld = true;
    this.startHintInterval();
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    this.cdr.markForCheck();
  }

  onHintPointerUp(event: PointerEvent): void {
    try {
      const el = event.currentTarget as HTMLElement;
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    this.hintPeekCount = 1;
    this.hintHeld = false;
    this.clearHintInterval();
    this.restorePracticeInputFocusAfterHint();
    this.cdr.markForCheck();
  }

  onHintPointerLeave(event: PointerEvent): void {
    if (event.buttons !== 0) return;
    this.hintPeekCount = 1;
    this.hintHeld = false;
    this.clearHintInterval();
    this.restorePracticeInputFocusAfterHint();
    this.cdr.markForCheck();
  }

  processWordGuess(label: string): void {
    if (this.hintActive || this.phase !== 'practicing' || this.currentTargetIndex === null) return;
    const token = this.tokens[this.currentTargetIndex];
    if (!token || token.kind === 'punct') return;
    this.hasTypedInRound = true;
    const correct = label === token.text;
    if (correct) {
      const idx = this.currentTargetIndex;
      const next = new Set(this.revealed);
      next.add(idx);
      this.revealed = next;
      this.consecutiveWrong = 0;
      this.correctKeystrokesTotal += 1;
      this.syncMetricRefs();
    } else {
      this.wrongAttemptsTotal += 1;
      this.consecutiveWrong += 1;
      if (this.consecutiveWrong >= MAX_WRONG_BEFORE_REVEAL && this.currentTargetIndex !== null) {
        const idx = this.currentTargetIndex;
        const next = new Set(this.revealed);
        next.add(idx);
        this.revealed = next;
        this.correctKeystrokesTotal += 1;
        this.consecutiveWrong = 0;
      }
      this.syncMetricRefs();
      this.flashErrorBriefly();
    }
    this.checkRoundCompletion();
    this.cdr.markForCheck();
  }

  onPracticeInputKeyDown(event: KeyboardEvent): void {
    if (this.hintActive || this.phase !== 'practicing' || this.currentTargetIndex === null) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    if (key.length !== 1) return;
    const token = this.tokens[this.currentTargetIndex];
    if (!token || token.kind === 'punct') return;
    const allow = token.kind === 'digit' ? /^[0-9]$/.test(key) : /^[a-zA-Z]$/.test(key);
    if (!allow) return;
    event.preventDefault();
    this.suppressInputFromKeydown = true;
    this.processKeystroke(key);
    setTimeout(() => {
      this.suppressInputFromKeydown = false;
    }, 0);
  }

  onPracticeInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    if (this.suppressInputFromKeydown) {
      el.value = '';
      return;
    }
    if (this.hintActive) {
      el.value = '';
      return;
    }
    if (this.phase !== 'practicing' || this.currentTargetIndex === null) {
      el.value = '';
      return;
    }
    const v = el.value;
    if (v.length === 0) return;
    const last = v.slice(-1);
    el.value = '';
    const token = this.tokens[this.currentTargetIndex];
    if (!token || token.kind === 'punct') return;
    const ok = token.kind === 'digit' ? /^[0-9]$/.test(last) : /^[a-zA-Z]$/.test(last);
    if (!ok) return;
    this.processKeystroke(last);
  }

  onReorderInvalidDrop(): void {
    this.wrongAttemptsTotal += 1;
    this.syncMetricRefs();
    this.flashErrorBriefly();
    this.cdr.markForCheck();
  }

  onReorderSlotsBecameCorrect(slots: number[]): void {
    if (slots.length === 0) return;
    this.correctKeystrokesTotal += slots.length;
    this.syncMetricRefs();
    this.checkRoundCompletion();
    this.cdr.markForCheck();
  }

  onReorderSlotChunkIdsChange(next: number[]): void {
    this.reorderSlotChunkIds = next;
    this.checkRoundCompletion();
    this.cdr.markForCheck();
  }

  onPassageAudioPlay(): void {
    const el = this.passageAudioRef?.nativeElement;
    if (el) applyMemorizeListenPlaybackRateToMediaElement(el, this.listenPlaybackRateRef);
    this.passageAudioPlaying = true;
    this.cdr.markForCheck();
  }

  onPassageAudioPause(): void {
    this.passageAudioPlaying = false;
    this.cdr.markForCheck();
  }

  onPassageAudioEnded(): void {
    this.passageAudioPlaying = false;
    this.bumpListen();
    if (!this.repeatListenOnRef) return;
    this.clearListenRepeatGapTimer();
    this.listenRepeatGapTimer = setTimeout(() => {
      this.listenRepeatGapTimer = null;
      if (!this.repeatListenOnRef) return;
      const el = this.passageAudioRef?.nativeElement;
      if (!el) return;
      el.currentTime = 0;
      applyMemorizeListenPlaybackRateToMediaElement(el, this.listenPlaybackRateRef);
      void el.play().catch(() => {
        this.passageAudioPlaying = false;
        this.bumpListen();
        this.cdr.markForCheck();
      });
    }, MEMORIZE_LISTEN_REPEAT_GAP_MS);
  }

  onPassageAudioError(): void {
    this.passageAudioPlaying = false;
    this.cdr.markForCheck();
  }

  openListenPanel(): void {
    this.listenPanelOpen = true;
    this.bumpListen();
    this.cdr.markForCheck();
  }

  closeListenPanel(): void {
    this.listenPanelOpen = false;
    this.cdr.markForCheck();
  }

  onSelectListenSpeed(rate: MemorizeListenSpeed): void {
    this.listenPlaybackRate = rate;
    this.listenPlaybackRateRef = rate;
    writeMemorizeListenSpeedToStorage(rate);
    const el = this.passageAudioRef?.nativeElement;
    if (el) applyMemorizeListenPlaybackRateToMediaElement(el, rate);
    this.bumpListen();
    this.cdr.markForCheck();
  }

  handleListenPassageClick(): void {
    if (!this.listenInteractionAllowed) return;
    if (this.listenViaStreamingAudio) {
      const el = this.passageAudioRef?.nativeElement;
      if (!el) return;
      if (!el.paused) {
        this.clearListenRepeatGapTimer();
        el.pause();
        this.passageAudioPlaying = false;
        this.bumpListen();
        return;
      }
      void this.playStreamingAudio(el);
      return;
    }
    this.handleTtsListenClick();
  }

  handleRepeatListenToggle(): void {
    if (!this.listenInteractionAllowed) return;
    const next = !this.repeatListenOnRef;
    this.repeatListenOnRef = next;
    this.repeatListenOn = next;
    if (next) {
      if (this.listenViaStreamingAudio) {
        const el = this.passageAudioRef?.nativeElement;
        if (el?.paused) void this.playStreamingAudio(el, true);
        this.cdr.markForCheck();
        return;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis && !window.speechSynthesis.speaking) {
        this.beginTtsUtterance();
      } else if (
        typeof window !== 'undefined' &&
        window.speechSynthesis?.speaking &&
        !this.memorizeWebSpeechUtteranceIsOurs
      ) {
        window.speechSynthesis.cancel();
        this.beginTtsUtterance();
      }
    } else {
      this.clearListenRepeatGapTimer();
    }
    this.bumpListen();
    this.cdr.markForCheck();
  }

  onVerseTouchStart(event: TouchEvent): void {
    this.verseTouchMoved = false;
    const t = event.touches[0];
    if (t) this.verseTouchStart = { x: t.clientX, y: t.clientY };
  }

  onVerseTouchMove(event: TouchEvent): void {
    const t = event.touches[0];
    if (!t) return;
    const dx = t.clientX - this.verseTouchStart.x;
    const dy = t.clientY - this.verseTouchStart.y;
    if (dx * dx + dy * dy > 144) this.verseTouchMoved = true;
  }

  onVerseTouchCancel(): void {
    this.verseTouchMoved = false;
  }

  onVerseTouchEnd(): void {
    if (this.awaitingRoundAdvance) return;
    const wasScroll = this.verseTouchMoved;
    this.verseTouchMoved = false;
    if (wasScroll) return;
    this.focusPracticeInput();
  }

  isTokenHidden(i: number): boolean {
    return this.hiddenIndices.has(i);
  }

  isTokenRevealed(i: number): boolean {
    return this.revealed.has(i);
  }

  showViaHint(i: number): boolean {
    return this.hintActive && this.isTokenHidden(i) && !this.isTokenRevealed(i) && this.hintPeekIndices.has(i);
  }

  isCurrentBlank(i: number): boolean {
    return this.isTokenHidden(i) && !this.isTokenRevealed(i) && i === this.currentTargetIndex;
  }

  private onOpen(): void {
    this.memorizeAndroidHost = isMemorizeAndroidWebHost();
    this.listenPlaybackRate = readMemorizeListenSpeedFromStorage();
    this.listenPlaybackRateRef = this.listenPlaybackRate;
    this.document.body.style.overflow = 'hidden';
    this.document.documentElement.style.overflow = 'hidden';
    this.recomputeDerivedFromItem();
    this.hydrateInProgressOnce();
    this.loadAudioUrl();
    this.attachViewportListeners();
    this.schedulePracticeEffects();
    this.cdr.markForCheck();
  }

  private onCloseCleanup(): void {
    this.stopPassageAudio();
    this.document.body.style.overflow = 'unset';
    this.document.documentElement.style.overflow = 'unset';
    this.detachAllListeners();
    this.clearHintInterval();
  }

  private recomputeDerivedFromItem(): void {
    this.isBibleBooks = isBibleBooksMemorizationItem(this.item);
    this.tokens = this.isBibleBooks
      ? buildMemorizationTokens(this.item.text, '')
      : buildMemorizationTokens(this.item.text, this.item.reference);
    this.reorderChunks = this.isBibleBooks
      ? buildBibleBooksReorderChunks(booksForScope(this.item.bibleBooksScope!).map((b) => b.name))
      : buildMemorizationReorderChunks(this.item.text, this.item.reference);
    this.reorderColonAfterSlotIndex = reorderReferenceColonAfterSlotIndex(
      this.reorderChunks.length,
      this.item.reference
    );
    this.typableIndices = getTypableTokenIndices(this.tokens);
  }

  private async loadAudioUrl(): Promise<void> {
    if (this.isBibleBooks) {
      this.passageAudioUrl = null;
      this.listenViaStreamingAudio = false;
      this.translationListenEnabled = !this.memorizeAndroidHost;
      this.cdr.markForCheck();
      return;
    }
    if (!isMemorizationListenTranslation(this.item.translation)) {
      this.passageAudioUrl = null;
      this.listenViaStreamingAudio = false;
      this.translationListenEnabled = false;
      this.cdr.markForCheck();
      return;
    }
    try {
      const result = await this.scripture.getAudioUrl(this.item.reference, this.item.translation);
      this.passageAudioUrl = result.audioUrl;
      this.listenViaStreamingAudio = !!result.audioUrl && !result.useSpeechSynthesis;
      this.translationListenEnabled = this.listenViaStreamingAudio || !this.memorizeAndroidHost;
    } catch {
      this.passageAudioUrl = null;
      this.listenViaStreamingAudio = false;
      this.translationListenEnabled = !this.memorizeAndroidHost;
    }
    this.cdr.markForCheck();
  }

  private handleItemIdChange(): void {
    if (this.lastAudioResetVerseId !== null && this.lastAudioResetVerseId !== this.item.id) {
      this.stopPassageAudio();
    }
    this.lastAudioResetVerseId = this.item.id;

    if (!this.item.inProgressPractice) {
      this.practiceCompleted = false;
      this.roundAdvanceHandled = null;
      this.awaitingRoundAdvance = false;
      this.roundAffirmation = '';
      this.completionMessage = '';
      this.sessionSeed = '';
      if (this.isOpen) {
        this.resetToIntro();
      }
    }
  }

  private resetToIntro(): void {
    this.phase = 'intro';
    this.startRoundChoice = 1;
    this.roundIndex = 0;
    this.hasTypedInRound = false;
    this.hiddenIndices = new Set();
    this.revealed = new Set();
    this.firstLetterCueRevealedSlots = new Set();
    this.reorderSlotChunkIds = [];
    this.reorderRoundMovableIndices = new Set();
    this.wrongAttemptsTotal = 0;
    this.correctKeystrokesTotal = 0;
    this.consecutiveWrong = 0;
    this.practiceMode = null;
    this.practiceModeRef = null;
    this.modePickerOpen = false;
    this.syncMetricRefs();
  }

  private hydrateInProgressOnce(): void {
    if (this.lastVerseIdForLayout !== this.item.id) {
      this.lastVerseIdForLayout = this.item.id;
      this.openedLayoutOnceForVerseId = null;
    }
    if (this.openedLayoutOnceForVerseId === this.item.id) return;
    this.openedLayoutOnceForVerseId = this.item.id;

    const ip = this.item.inProgressPractice;
    if (!ip) return;

    this.sessionSeed = ip.sessionSeed;
    this.practiceCompleted = false;
    this.wrongAttemptsTotal = ip.wrongAttempts;
    this.correctKeystrokesTotal = ip.correctKeystrokes;
    this.syncMetricRefs();

    if (ip.phase.kind === 'betweenRounds') {
      const r = ip.phase.completedRoundIndex;
      this.roundAdvanceHandled = r;
      const modeRaw = ip.practiceMode ?? 'type';
      this.practiceMode = modeRaw;
      this.practiceModeRef = modeRaw;
      this.roundIndex = r;
      this.hasTypedInRound = false;
      this.hiddenIndices = new Set();
      this.revealed = new Set();
      this.firstLetterCueRevealedSlots = new Set();
      if (modeRaw === 'reorder') {
        const n = this.reorderChunks.length;
        this.reorderSlotChunkIds = n === 0 ? [] : Array.from({ length: n }, (_, i) => i);
        this.reorderRoundMovableIndices = new Set();
      } else {
        this.hiddenIndices = hiddenTypingTokenIndices(
          modeRaw,
          r,
          this.sessionSeed || this.item.id,
          this.typableIndices
        );
      }
      this.awaitingRoundAdvance = true;
      this.roundAffirmation = pickRandomRoundAffirmation();
      this.phase = 'practicing';
    } else {
      this.roundAdvanceHandled = null;
      const r = ip.phase.roundIndex;
      const modeRaw = ip.practiceMode ?? 'type';
      this.practiceMode = modeRaw;
      this.practiceModeRef = modeRaw;
      this.roundIndex = r;
      this.hasTypedInRound = false;
      this.revealed = new Set();
      this.firstLetterCueRevealedSlots = new Set();
      this.awaitingRoundAdvance = false;
      this.roundAffirmation = '';
      if (modeRaw === 'reorder') {
        const n = this.reorderChunks.length;
        const movableArr = pickReorderMovableIndices(n, r, this.sessionSeed);
        const rng = seedRandom(stringToSeed(`${this.sessionSeed}-mem-reorder-assign-r${r}`));
        this.reorderSlotChunkIds = buildInitialReorderSlotAssignment(n, movableArr, rng);
        this.reorderRoundMovableIndices = new Set(movableArr);
        this.hiddenIndices = new Set();
        if (this.memorizeAndroidHost) {
          this.androidScrollClampUntil = Date.now() + ANDROID_SCROLL_CLAMP_MS;
        }
      } else {
        this.hiddenIndices = hiddenTypingTokenIndices(
          modeRaw,
          r,
          this.sessionSeed || this.item.id,
          this.typableIndices
        );
        if (this.memorizeAndroidHost) {
          this.androidScrollClampUntil = Date.now() + ANDROID_SCROLL_CLAMP_MS;
        }
      }
      this.phase = 'practicing';
    }

    requestAnimationFrame(() => {
      if (isMemorizeAndroidWebHost() && this.practiceScrollRef?.nativeElement) {
        this.practiceScrollRef.nativeElement.scrollTop = 0;
      }
      if (isKeyboardPracticeMode(ip.practiceMode ?? 'type')) {
        this.focusPracticeInput();
      }
    });
  }

  private startRound(r: number): void {
    this.roundAdvanceHandled = null;
    this.consecutiveWrong = 0;
    const seed = this.sessionSeed || this.item.id;
    if (this.practiceModeRef === 'reorder') {
      const n = this.reorderChunks.length;
      const movableArr = pickReorderMovableIndices(n, r, seed);
      const rng = seedRandom(stringToSeed(`${seed}-mem-reorder-assign-r${r}`));
      const assignment = buildInitialReorderSlotAssignment(n, movableArr, rng);
      if (this.memorizeAndroidHost) {
        this.androidScrollClampUntil = Date.now() + ANDROID_SCROLL_CLAMP_MS;
      }
      this.roundIndex = r;
      this.hasTypedInRound = false;
      this.reorderSlotChunkIds = assignment;
      this.reorderRoundMovableIndices = new Set(movableArr);
      this.hiddenIndices = new Set();
      this.revealed = new Set();
      this.firstLetterCueRevealedSlots = new Set();
      this.awaitingRoundAdvance = false;
      this.roundAffirmation = '';
      this.phase = 'practicing';
      return;
    }
    const hidden = hiddenTypingTokenIndices(this.practiceModeRef, r, seed, this.typableIndices);
    if (this.memorizeAndroidHost) {
      this.androidScrollClampUntil = Date.now() + ANDROID_SCROLL_CLAMP_MS;
    }
    this.roundIndex = r;
    this.hasTypedInRound = false;
    this.hiddenIndices = hidden;
    this.revealed = new Set();
    this.firstLetterCueRevealedSlots = new Set();
    this.awaitingRoundAdvance = false;
    this.roundAffirmation = '';
    this.phase = 'practicing';
  }

  private processKeystroke(key: string): void {
    if (this.hintActive || this.phase !== 'practicing' || this.currentTargetIndex === null) return;
    if (key.length !== 1) return;
    const token = this.tokens[this.currentTargetIndex];
    if (!token || token.kind === 'punct') return;

    const maybeRevealCue = (tokenIndex: number) => {
      if (this.practiceModeRef !== 'firstLetters') return;
      const slot = this.typableIndices.indexOf(tokenIndex);
      if (slot < 0) return;
      if (!this.firstLetterCueHiddenSlots.has(slot)) return;
      if (this.firstLetterCueRevealedSlots.has(slot)) return;
      const next = new Set(this.firstLetterCueRevealedSlots);
      next.add(slot);
      this.firstLetterCueRevealedSlots = next;
    };

    this.hasTypedInRound = true;

    if (token.kind === 'digit') {
      if (!/^[0-9]$/.test(key)) return;
      if (key === token.text) {
        const idx = this.currentTargetIndex;
        maybeRevealCue(idx);
        const next = new Set(this.revealed);
        next.add(idx);
        this.revealed = next;
        this.consecutiveWrong = 0;
        this.correctKeystrokesTotal += 1;
        this.syncMetricRefs();
      } else {
        this.handleWrongKeystroke();
      }
    } else {
      if (!/^[a-zA-Z]$/.test(key)) return;
      const expected = firstLetterOfWord(token.text);
      if (!expected) return;
      if (key.toLowerCase() === expected) {
        const idx = this.currentTargetIndex;
        maybeRevealCue(idx);
        const next = new Set(this.revealed);
        next.add(idx);
        this.revealed = next;
        this.consecutiveWrong = 0;
        this.correctKeystrokesTotal += 1;
        this.syncMetricRefs();
      } else {
        this.handleWrongKeystroke();
      }
    }
    this.checkRoundCompletion();
    this.scheduleScrollToBlank();
    this.cdr.markForCheck();
  }

  private consecutiveWrong = 0;

  private handleWrongKeystroke(): void {
    this.wrongAttemptsTotal += 1;
    this.consecutiveWrong += 1;
    if (this.consecutiveWrong >= MAX_WRONG_BEFORE_REVEAL && this.currentTargetIndex !== null) {
      const idx = this.currentTargetIndex;
      const next = new Set(this.revealed);
      next.add(idx);
      this.revealed = next;
      this.correctKeystrokesTotal += 1;
      this.consecutiveWrong = 0;
    }
    this.syncMetricRefs();
    this.flashErrorBriefly();
  }

  private checkRoundCompletion(): void {
    if (this.phase !== 'practicing' || this.awaitingRoundAdvance) return;

    if (this.practiceMode === 'reorder') {
      const n = this.reorderChunks.length;
      if (n === 0 || this.reorderSlotChunkIds.length !== n) return;
      if (!this.reorderSlotChunkIds.every((id, i) => id === i)) return;
      this.onRoundComplete();
      return;
    }

    if (this.hiddenIndices.size === 0) return;
    const allDone = [...this.hiddenIndices].every((i) => this.revealed.has(i));
    if (!allDone) return;
    this.onRoundComplete();
  }

  private onRoundComplete(): void {
    if (this.roundIndex >= MEMORIZATION_FULL_HIDE_ROUND) {
      if (this.practiceCompleted) return;
      this.practiceCompleted = true;
      this.completed.emit({
        wrongAttempts: this.wrongAttemptsRef,
        correctKeystrokes: this.correctKeystrokesRef,
        completed: true,
      });
      this.completionMessage = pickRandomAllDoneMessage();
      this.phase = 'done';
      requestAnimationFrame(() => {
        if (this.practiceScrollRef?.nativeElement) {
          this.practiceScrollRef.nativeElement.scrollTop = 0;
        }
      });
      return;
    }
    if (this.roundAdvanceHandled === this.roundIndex) return;
    this.roundAdvanceHandled = this.roundIndex;
    this.persistPracticeSnapshot({ kind: 'betweenRounds', completedRoundIndex: this.roundIndex });
    this.roundAffirmation = pickRandomRoundAffirmation();
    this.awaitingRoundAdvance = true;
    this.awaitingRoundAdvanceRef = true;
    this.stopPassageAudio();
  }

  private persistPracticeSnapshot(phasePayload: MemorizationInProgressSavePayload['phase']): void {
    if (!this.sessionSeed) return;
    const mode = this.practiceModeRef ?? 'type';
    this.persistInProgress.emit({
      sessionSeed: this.sessionSeed,
      wrongAttempts: this.wrongAttemptsRef,
      correctKeystrokes: this.correctKeystrokesRef,
      phase: phasePayload,
      practiceMode: mode,
    });
  }

  private syncMetricRefs(): void {
    this.wrongAttemptsRef = this.wrongAttemptsTotal;
    this.correctKeystrokesRef = this.correctKeystrokesTotal;
    this.awaitingRoundAdvanceRef = this.awaitingRoundAdvance;
    this.practiceModeRef = this.practiceMode;
  }

  private flashErrorBriefly(): void {
    this.flashError = true;
    if (this.flashErrorTimer) clearTimeout(this.flashErrorTimer);
    this.flashErrorTimer = setTimeout(() => {
      this.flashError = false;
      this.cdr.markForCheck();
    }, 120);
  }

  private bumpListen(): void {
    this.listenUiTick += 1;
  }

  private stopPassageAudio(): void {
    this.clearListenRepeatGapTimer();
    this.repeatListenOnRef = false;
    this.repeatListenOn = false;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.memorizeListenTtsRateAtStart = null;
    this.memorizeListenTtsUserPaused = false;
    this.memorizeListenTtsPostResume = false;
    const el = this.passageAudioRef?.nativeElement;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    this.passageAudioPlaying = false;
    this.bumpListen();
  }

  private clearListenRepeatGapTimer(): void {
    if (this.listenRepeatGapTimer != null) {
      clearTimeout(this.listenRepeatGapTimer);
      this.listenRepeatGapTimer = null;
    }
  }

  private async playStreamingAudio(el: HTMLAudioElement, fromStart = false): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
        window.speechSynthesis.cancel();
      }
      this.memorizeWebSpeechUtteranceIsOurs = false;
      if (!el.getAttribute('src') && this.passageAudioUrl) {
        el.src = this.passageAudioUrl;
      }
      if (fromStart) el.currentTime = 0;
      applyMemorizeListenPlaybackRateToMediaElement(el, this.listenPlaybackRateRef);
      await el.play();
      this.passageAudioPlaying = true;
      this.bumpListen();
    } catch {
      this.passageAudioPlaying = false;
      this.bumpListen();
      this.cdr.markForCheck();
    }
  }

  private handleTtsListenClick(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const syn = window.speechSynthesis;
    if (syn.speaking) {
      if (!this.memorizeWebSpeechUtteranceIsOurs) {
        this.memorizeListenTtsUserPaused = false;
        this.memorizeListenTtsPostResume = false;
        syn.cancel();
        this.beginTtsUtterance();
        this.bumpListen();
        return;
      }
      if (syn.paused) {
        this.memorizeListenTtsUserPaused = false;
        const atStart = this.memorizeListenTtsRateAtStart;
        if (atStart != null && this.listenPlaybackRateRef !== atStart) {
          syn.cancel();
          this.memorizeListenTtsRateAtStart = null;
          this.memorizeListenTtsPostResume = false;
          this.beginTtsUtterance();
        } else {
          this.memorizeListenTtsPostResume = true;
          syn.resume();
          setTimeout(() => this.bumpListen(), 24);
          setTimeout(() => this.bumpListen(), 72);
        }
      } else {
        this.memorizeListenTtsUserPaused = true;
        this.memorizeListenTtsPostResume = false;
        syn.pause();
      }
      this.bumpListen();
      return;
    }
    this.beginTtsUtterance();
  }

  private beginTtsUtterance(): void {
    if (this.memorizeAndroidHost) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const text = getMemorizationListenUtteranceText(this.item);
    if (!text.trim()) return;

    this.memorizeListenTtsUserPaused = false;
    this.memorizeListenTtsPostResume = false;
    const syn = window.speechSynthesis;
    this.memorizeWebSpeechUtteranceIsOurs = false;
    syn.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    const rate = this.listenPlaybackRateRef;
    u.rate = toMemorizeWebSpeechUtteranceRate(rate, isMemorizeIosWebHost());
    this.memorizeListenTtsRateAtStart = rate;
    u.onstart = () => {
      this.memorizeWebSpeechUtteranceIsOurs = true;
      this.memorizeListenTtsPostResume = false;
      this.bumpListen();
      this.cdr.markForCheck();
    };
    u.onend = () => {
      this.memorizeWebSpeechUtteranceIsOurs = false;
      this.memorizeListenTtsUserPaused = false;
      this.memorizeListenTtsPostResume = false;
      this.memorizeListenTtsRateAtStart = null;
      this.bumpListen();
      this.cdr.markForCheck();
      if (!this.repeatListenOnRef) return;
      this.clearListenRepeatGapTimer();
      this.listenRepeatGapTimer = setTimeout(() => {
        this.listenRepeatGapTimer = null;
        if (!this.repeatListenOnRef) return;
        this.beginTtsUtterance();
      }, MEMORIZE_LISTEN_REPEAT_GAP_MS);
    };
    u.onerror = () => {
      this.memorizeWebSpeechUtteranceIsOurs = false;
      this.memorizeListenTtsUserPaused = false;
      this.memorizeListenTtsPostResume = false;
      this.memorizeListenTtsRateAtStart = null;
      this.bumpListen();
      this.cdr.markForCheck();
    };
    syn.speak(u);
    this.bumpListen();
    this.cdr.markForCheck();
  }

  private focusPracticeInput(): void {
    this.practiceInputRef?.nativeElement.focus({ preventScroll: true });
  }

  private restorePracticeInputFocusAfterHint(): void {
    requestAnimationFrame(() => {
      if (this.awaitingRoundAdvanceRef || this.phase !== 'practicing') return;
      if (!isKeyboardPracticeMode(this.practiceModeRef)) return;
      this.focusPracticeInput();
    });
  }

  private startHintInterval(): void {
    this.clearHintInterval();
    if (!this.hintActive || this.practiceMode === 'reorder') return;
    this.hintIntervalId = setInterval(() => {
      this.hintPeekCount = Math.min(this.hintPeekCount + 1, this.unrevealedHiddenSorted.length);
      this.cdr.markForCheck();
    }, MEMORIZE_HINT_EXTRA_PEEK_INTERVAL_MS);
  }

  private schedulePracticeEffects(): void {
    if (this.awaitingRoundAdvance || this.phase !== 'intro') {
      this.stopPassageAudio();
    }

    if (!this.listenInteractionAllowed) {
      this.listenPanelOpen = false;
    }

    if (
      this.phase === 'practicing' &&
      !this.awaitingRoundAdvance &&
      this.currentTargetIndex !== null &&
      !this.hintActive &&
      isKeyboardPracticeMode(this.practiceMode)
    ) {
      setTimeout(() => {
        this.focusPracticeInput();
        if (this.hasTypedInRound) this.scrollCurrentBlankIntoView();
      }, 0);
    }

    if (
      this.phase === 'practicing' &&
      !this.awaitingRoundAdvance &&
      this.currentTargetIndex !== null &&
      this.practiceMode === 'word'
    ) {
      this.scrollCurrentBlankIntoView();
    }

    if (
      this.phase === 'practicing' &&
      !this.awaitingRoundAdvance &&
      this.currentTargetIndex !== null &&
      this.practiceMode !== 'word' &&
      this.hasTypedInRound
    ) {
      this.scrollCurrentBlankIntoView();
    }

    if (this.phase === 'done' && this.practiceScrollRef?.nativeElement) {
      this.practiceScrollRef.nativeElement.scrollTop = 0;
    }

    if (this.practiceMode === 'firstLetters' && this.phase === 'practicing' && !this.awaitingRoundAdvance) {
      this.scrollActiveFirstLetterCueIntoView();
    }
  }

  private scheduleScrollToBlank(): void {
    if (!this.hasTypedInRound) return;
    const delayMs = isMemorizeAndroidWebHost() ? 120 : 80;
    setTimeout(() => this.scrollCurrentBlankIntoView(), delayMs);
  }

  private scrollCurrentBlankIntoView(): void {
    requestAnimationFrame(() => {
      const root =
        this.practiceWordsWordRef?.nativeElement ?? this.practiceWordsTypeRef?.nativeElement;
      const scrollEl = this.practiceScrollRef?.nativeElement;
      if (!root || !scrollEl) return;
      const el = root.querySelector<HTMLElement>('[data-memorize-current-blank="true"]');
      if (!el) return;
      if (isMemorizeAndroidWebHost() && Date.now() < this.androidScrollClampUntil) {
        scrollEl.scrollTop = 0;
        return;
      }
      scrollMemorizeBlankNearestInPracticeColumn(scrollEl, el);
      const scrollRect = scrollEl.getBoundingClientRect();
      const vv = window.visualViewport;
      const edgeMargin = 12;
      const isWordMode = this.practiceModeRef === 'word';
      let viewTop: number;
      let viewBottom: number;
      if (isWordMode) {
        viewTop = scrollRect.top + edgeMargin;
        viewBottom = scrollRect.bottom - edgeMargin;
      } else if (vv) {
        viewTop = vv.offsetTop + edgeMargin;
        viewBottom = vv.offsetTop + vv.height - edgeMargin - MEMORIZE_EXTRA_GAP_ABOVE_KEYBOARD_PX;
      } else {
        viewTop = scrollRect.top + edgeMargin;
        viewBottom = scrollRect.bottom - edgeMargin;
      }
      const reduceMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const nudgeBehavior: ScrollBehavior =
        reduceMotion || isMemorizeAndroidWebHost() || isMemorizeIosWebHost() ? 'auto' : 'smooth';
      const nudgeIntoVisibleViewport = () => {
        const rect = el.getBoundingClientRect();
        let delta = 0;
        if (rect.bottom > viewBottom) delta += rect.bottom - viewBottom;
        if (rect.top < viewTop) delta -= viewTop - rect.top;
        if (Math.abs(delta) < 0.5) return;
        const nextTop = Math.max(0, scrollEl.scrollTop + delta);
        scrollEl.scrollTo({ top: nextTop, behavior: nudgeBehavior });
      };
      nudgeIntoVisibleViewport();
      if (nudgeBehavior === 'auto') {
        requestAnimationFrame(nudgeIntoVisibleViewport);
      }
    });
  }

  private scrollActiveFirstLetterCueIntoView(): void {
    const root = this.firstLetterCuesViewportRef?.nativeElement;
    if (!root) return;
    const slot =
      this.currentTargetIndex !== null
        ? this.typableIndices.indexOf(this.currentTargetIndex)
        : -1;
    const target =
      slot >= 0 ? root.querySelector<HTMLElement>(`[data-memorize-cue-slot="${slot}"]`) : null;
    if (target) {
      try {
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
      } catch {
        // jsdom
      }
    } else {
      root.scrollTop = 0;
    }
  }

  private attachViewportListeners(): void {
    if (this.viewportListenersAttached || typeof window === 'undefined') return;
    this.viewportListenersAttached = true;
    const vv = window.visualViewport;
    if (!vv) return;
    const coalesceAndroid = isMemorizeAndroidWebHost();
    let insetRaf = 0;
    const applyInset = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      this.keyboardInsetPx = inset;
      this.cdr.markForCheck();
    };
    const updateInset = () => {
      if (!coalesceAndroid) {
        applyInset();
        return;
      }
      if (insetRaf) return;
      insetRaf = window.requestAnimationFrame(() => {
        insetRaf = 0;
        applyInset();
      });
    };
    applyInset();
    vv.addEventListener('resize', updateInset);
    vv.addEventListener('scroll', updateInset);
  }

  private attachPracticeListeners(): void {
    this.attachAndroidScrollClamp();
    this.attachTypeModeCapture();
    this.attachHintCapture();
    this.attachFirstLetterResizeObserver();
  }

  private attachAndroidScrollClamp(): void {
    if (!this.memorizeAndroidHost || this.androidScrollListener) return;
    const scrollEl = this.practiceScrollRef?.nativeElement;
    if (!scrollEl) return;
    this.androidScrollListener = () => {
      if (Date.now() < this.androidScrollClampUntil) {
        scrollEl.scrollTop = 0;
      }
    };
    scrollEl.addEventListener('scroll', this.androidScrollListener, { passive: false });
  }

  private attachTypeModeCapture(): void {
    if (this.typeCaptureListenersAttached) return;
    const el = this.practiceWordsTypeRef?.nativeElement;
    if (!el || this.phase !== 'practicing' || !isKeyboardPracticeMode(this.practiceMode)) return;
    const onTouchStartCaptureVerse = (e: TouchEvent) => {
      if (this.awaitingRoundAdvanceRef) return;
      const input = this.practiceInputRef?.nativeElement;
      if (!input) return;
      if (document.activeElement === input) e.preventDefault();
    };
    const onPointerDownCapture = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      this.keepPracticeInputOnPointerCapture(e);
    };
    el.addEventListener('touchstart', onTouchStartCaptureVerse, { capture: true, passive: false });
    el.addEventListener('pointerdown', onPointerDownCapture, { capture: true });
    this.typeCaptureListenersAttached = true;
  }

  private attachHintCapture(): void {
    if (this.hintCaptureListenersAttached) return;
    const el = this.hintButtonRef?.nativeElement;
    if (!el) return;
    const handler = (e: PointerEvent | TouchEvent) => this.keepPracticeInputOnPointerCapture(e);
    el.addEventListener('touchstart', handler as EventListener, { capture: true, passive: false });
    el.addEventListener('pointerdown', handler as EventListener, { capture: true });
    this.hintCaptureListenersAttached = true;
  }

  private keepPracticeInputOnPointerCapture(e: PointerEvent | TouchEvent): void {
    if (this.awaitingRoundAdvanceRef) return;
    if (!isKeyboardPracticeMode(this.practiceModeRef)) return;
    const t = e.target;
    if (t instanceof Element && t.closest('[data-testid="memorize-hint-button"]')) return;
    const input = this.practiceInputRef?.nativeElement;
    if (!input) return;
    if (document.activeElement === input) {
      e.preventDefault();
      return;
    }
    input.focus({ preventScroll: true });
  }

  private attachFirstLetterResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;
    if (this.practiceMode !== 'firstLetters' || this.phase !== 'practicing' || this.awaitingRoundAdvance) {
      return;
    }
    const root = this.firstLetterCuesViewportRef?.nativeElement;
    if (!root) return;
    this.resizeObserver?.disconnect();
    let raf = 0;
    this.resizeObserver = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!root.isConnected) return;
        this.scrollActiveFirstLetterCueIntoView();
      });
    });
    this.resizeObserver.observe(root);
  }

  private detachAllListeners(): void {
    this.clearHintInterval();
    const scrollEl = this.practiceScrollRef?.nativeElement;
    if (scrollEl && this.androidScrollListener) {
      scrollEl.removeEventListener('scroll', this.androidScrollListener);
      this.androidScrollListener = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.typeCaptureListenersAttached = false;
    this.hintCaptureListenersAttached = false;
  }

  private clearHintInterval(): void {
    if (this.hintIntervalId) {
      clearInterval(this.hintIntervalId);
      this.hintIntervalId = null;
    }
  }

  private syncRefs(): void {
    this.syncMetricRefs();
  }
}

function reorderChunksEmpty() {
  return [] as ReturnType<typeof buildMemorizationReorderChunks>;
}
