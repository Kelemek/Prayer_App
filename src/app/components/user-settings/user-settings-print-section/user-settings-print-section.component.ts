import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { ModalShellComponent } from '../../modal-shell/modal-shell.component';
import { PrintService } from '../../../services/print.service';
import { PrayerService } from '../../../services/prayer.service';
import { SupabaseService } from '../../../services/supabase.service';
import { TenantContextService } from '../../../services/tenant-context.service';
import { uniquePrayerTypeNamesInOrder } from '../../../lib/prayer-type-names';
import type { MemorizationPrintSheetStyle } from '../../../lib/print-memorization-cards';
import { SETTINGS_PRINT_MODAL_SHELL } from '../../../lib/measure-app-top-chrome-inset';
import { USER_SETTINGS_SECTION_HOST_STYLES } from '../user-settings-section-host';
import {
  SETTINGS_CHOICE_ACTION_ROW_CLASS,
  SETTINGS_CHOICE_DROPDOWN_SHELL_CLASS,
  SETTINGS_CHOICE_SPLIT_TILE_BTN_CLASS,
  settingsChoiceNgClass,
} from '../../../lib/settings-choice-ui';

export type PrintRange = 'week' | 'twoweeks' | 'month' | 'year' | 'all';
export type PrintOptionsModal = 'prayers' | 'prompts' | 'personal' | 'verses';

@Component({
  selector: 'app-user-settings-print-section',
  standalone: true,
  imports: [NgClass, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-settings-print-section.component.html',
  styles: [...USER_SETTINGS_SECTION_HOST_STYLES],
})
export class UserSettingsPrintSectionComponent implements OnChanges {
  readonly choiceShellClass = SETTINGS_CHOICE_DROPDOWN_SHELL_CLASS;
  readonly choiceSplitTileClass = SETTINGS_CHOICE_SPLIT_TILE_BTN_CLASS;
  readonly choiceState = settingsChoiceNgClass;
  readonly printModalActionBtnClass = `${SETTINGS_CHOICE_ACTION_ROW_CLASS} mt-4`;
  /** Fixed height so label ↔ spinner does not resize print tiles. */
  readonly printTileContentClass =
    'grid h-5 w-full shrink-0 place-items-center sm:h-5';
  readonly printTileSpinnerClass =
    'h-[18px] w-[18px] text-gray-600 dark:text-gray-400 sm:h-5 sm:w-5 animate-spin';

  @Input() isOpen = false;

  isPrinting = false;
  isPrintingPrompts = false;
  isPrintingMemorization = false;
  isPrintingPersonal = false;
  printRange: PrintRange = 'week';
  printOptionsModal: PrintOptionsModal | null = null;
  readonly settingsPrintModalShell = SETTINGS_PRINT_MODAL_SHELL;
  promptTypes: string[] = [];
  selectedPromptTypes: string[] = [];
  personalCategories: string[] = [];
  selectedPersonalCategories: string[] = [];
  memorizationSheetStyle: MemorizationPrintSheetStyle = 'duplex';

  readonly memorizationSheetStyleOptions: Array<{
    value: MemorizationPrintSheetStyle;
    label: string;
    description: string;
  }> = [
    {
      value: 'duplex',
      label: 'Duplex',
      description: 'Two-sided — print front, flip on the long edge, print back',
    },
    {
      value: 'foldable',
      label: 'Foldable',
      description: 'One-sided — reference left, verse right; fold on the center line',
    },
  ];

  readonly printRangeOptions = [
    { value: 'week' as PrintRange, label: 'Last Week' },
    { value: 'twoweeks' as PrintRange, label: 'Last 2 Weeks' },
    { value: 'month' as PrintRange, label: 'Last Month' },
    { value: 'year' as PrintRange, label: 'Last Year' },
    { value: 'all' as PrintRange, label: 'All Prayers' },
  ];

  constructor(
    private printService: PrintService,
    private prayerService: PrayerService,
    private supabase: SupabaseService,
    private tenantContext: TenantContextService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === false) {
      this.closePrintOptionsModal();
    }
    if (changes['isOpen']?.currentValue === true) {
      void this.loadPromptTypes();
      void this.loadPersonalCategories();
    }
  }

  get printOptionsModalTitle(): string {
    switch (this.printOptionsModal) {
      case 'prayers':
        return 'Prayer print period';
      case 'prompts':
        return 'Prompt types';
      case 'personal':
        return 'Personal categories';
      case 'verses':
        return 'Verse card format';
      default:
        return '';
    }
  }

  openPrintOptionsModal(mode: PrintOptionsModal): void {
    this.printOptionsModal = mode;
    this.cdr.markForCheck();
  }

  closePrintOptionsModal(): void {
    if (!this.printOptionsModal) {
      return;
    }
    this.printOptionsModal = null;
    this.cdr.markForCheck();
  }

  setPrintRange(range: PrintRange): void {
    this.printRange = range;
    this.cdr.markForCheck();
  }

  setMemorizationSheetStyle(style: MemorizationPrintSheetStyle): void {
    this.memorizationSheetStyle = style;
    this.cdr.markForCheck();
  }

  selectAllPromptTypes(): void {
    this.selectedPromptTypes = [];
    this.cdr.markForCheck();
  }

  selectAllPersonalCategories(): void {
    this.selectedPersonalCategories = [];
    this.cdr.markForCheck();
  }

  async printFromOptionsModal(): Promise<void> {
    const mode = this.printOptionsModal;
    if (!mode) {
      return;
    }
    this.closePrintOptionsModal();
    switch (mode) {
      case 'prayers':
        await this.handlePrint();
        break;
      case 'prompts':
        await this.handlePrintPrompts();
        break;
      case 'personal':
        await this.handlePrintPersonalPrayers();
        break;
      case 'verses':
        await this.handlePrintMemorizationCards();
        break;
      default: {
        const _exhaustive: never = mode;
        break;
      }
    }
  }

  async handlePrint(): Promise<void> {
    this.isPrinting = true;
    this.cdr.markForCheck();

    const newWindow = this.isNativeApp() ? null : window.open('', '_blank');

    try {
      await this.printService.downloadPrintablePrayerList(this.printRange, newWindow);
    } catch (error) {
      console.error('Error printing prayer list:', error);
      newWindow?.close();
    } finally {
      this.isPrinting = false;
      this.cdr.markForCheck();
    }
  }

  async handlePrintPrompts(): Promise<void> {
    this.isPrintingPrompts = true;
    this.cdr.markForCheck();

    const newWindow = this.isNativeApp() ? null : window.open('', '_blank');

    try {
      await this.printService.downloadPrintablePromptList(
        this.selectedPromptTypes,
        newWindow
      );
    } catch (error) {
      console.error('Error printing prompts:', error);
      newWindow?.close();
    } finally {
      this.isPrintingPrompts = false;
      this.cdr.markForCheck();
    }
  }

  async handlePrintPersonalPrayers(): Promise<void> {
    this.isPrintingPersonal = true;
    this.cdr.markForCheck();

    const newWindow = this.isNativeApp() ? null : window.open('', '_blank');

    try {
      await this.printService.downloadPrintablePersonalPrayerList(
        this.selectedPersonalCategories.length > 0
          ? this.selectedPersonalCategories
          : undefined,
        newWindow
      );
    } catch (error) {
      console.error('Error printing personal prayers:', error);
      newWindow?.close();
    } finally {
      this.isPrintingPersonal = false;
      this.cdr.markForCheck();
    }
  }

  async handlePrintMemorizationCards(): Promise<void> {
    this.isPrintingMemorization = true;
    this.cdr.markForCheck();

    const newWindow = this.isNativeApp() ? null : window.open('', '_blank');
    if (newWindow) {
      newWindow.document.open();
      newWindow.document.write(
        '<!DOCTYPE html><html><head><title>Preparing verse cards</title></head><body style="font-family:system-ui,sans-serif;padding:2rem">Preparing verse cards…</body></html>'
      );
      newWindow.document.close();
      newWindow.focus();
    }

    try {
      await this.printService.downloadPrintableMemorizationCards(
        newWindow,
        this.memorizationSheetStyle
      );
    } catch (error) {
      console.error('Error printing memorization verse cards:', error);
      newWindow?.close();
    } finally {
      this.isPrintingMemorization = false;
      this.cdr.markForCheck();
    }
  }

  togglePromptType(type: string): void {
    const index = this.selectedPromptTypes.indexOf(type);
    if (index > -1) {
      this.selectedPromptTypes = this.selectedPromptTypes.filter((t) => t !== type);
    } else {
      this.selectedPromptTypes = [...this.selectedPromptTypes, type];
    }
    this.cdr.markForCheck();
  }

  togglePersonalCategory(category: string): void {
    const index = this.selectedPersonalCategories.indexOf(category);
    if (index > -1) {
      this.selectedPersonalCategories = this.selectedPersonalCategories.filter(
        (c) => c !== category
      );
    } else {
      this.selectedPersonalCategories = [...this.selectedPersonalCategories, category];
    }
    this.cdr.markForCheck();
  }

  private async loadPromptTypes(): Promise<void> {
    const tenantId = this.tenantContext.getActiveTenant()?.id;
    if (!tenantId) {
      this.promptTypes = [];
      this.cdr.markForCheck();
      return;
    }

    try {
      const { data, error } = await this.supabase.client
        .from('prayer_types')
        .select('name, display_order')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (!error && data) {
        this.promptTypes = uniquePrayerTypeNamesInOrder(data);
        this.cdr.markForCheck();
      }
    } catch (err) {
      console.error('Error fetching prayer types:', err);
    }
  }

  private async loadPersonalCategories(): Promise<void> {
    try {
      this.personalCategories = await this.prayerService.getUniqueCategoriesForUser();
      this.cdr.markForCheck();
    } catch (err) {
      console.error('Error loading personal categories:', err);
    }
  }

  private isNativeApp(): boolean {
    try {
      const hasCapacitor = typeof (window as { Capacitor?: unknown }).Capacitor !== 'undefined';
      if (!hasCapacitor) {
        return false;
      }
      const platform = (
        window as { Capacitor?: { getPlatform?: () => string } }
      ).Capacitor?.getPlatform?.();
      return platform === 'ios' || platform === 'android';
    } catch (e) {
      console.error('[UserSettingsPrintSection] Error checking native app:', e);
      return false;
    }
  }
}
