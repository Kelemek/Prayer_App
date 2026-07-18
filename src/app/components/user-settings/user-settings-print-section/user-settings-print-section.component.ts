import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { PrintService } from '../../../services/print.service';
import { PrayerService } from '../../../services/prayer.service';
import { SupabaseService } from '../../../services/supabase.service';
import { USER_SETTINGS_SECTION_HOST_STYLES } from '../user-settings-section-host';

export type PrintRange = 'week' | 'twoweeks' | 'month' | 'year' | 'all';

@Component({
  selector: 'app-user-settings-print-section',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-settings-print-section.component.html',
  styles: [...USER_SETTINGS_SECTION_HOST_STYLES],
})
export class UserSettingsPrintSectionComponent implements OnChanges {
  @Input() isOpen = false;

  isPrinting = false;
  isPrintingPrompts = false;
  isPrintingPersonal = false;
  printRange: PrintRange = 'week';
  showPrintDropdown = false;
  showPromptTypesDropdown = false;
  showPrintPersonalDropdown = false;
  promptTypes: string[] = [];
  selectedPromptTypes: string[] = [];
  personalCategories: string[] = [];
  selectedPersonalCategories: string[] = [];

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
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      void this.loadPromptTypes();
      void this.loadPersonalCategories();
    }
  }

  setPrintRange(range: PrintRange): void {
    this.printRange = range;
    this.cdr.markForCheck();
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
    try {
      const { data, error } = await this.supabase.client
        .from('prayer_types')
        .select('name, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (!error && data) {
        this.promptTypes = data.map((t) => t.name);
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
