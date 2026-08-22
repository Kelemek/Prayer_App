import { Injectable } from "@angular/core";
import type { PrayerPrompt } from "../components/prompt-card/prompt-card.component";
import {
  filterPresentationCommunityPrayers,
  filterPresentationPersonalPrayers,
} from "../lib/presentation-content-filter";
import type { PresentationTimeFilter, PresentationStatusFilters } from "../types/presentation";
import type { PrayerRequest } from "./prayer.service";
import { PrayerService } from "./prayer.service";
import { PromptService } from "./prompt.service";

@Injectable()
export class PresentationContentLoader {
  constructor(
    private readonly prayerService: PrayerService,
    private readonly promptService: PromptService
  ) {}

  async loadCommunityPrayers(options: {
    statusFilters: PresentationStatusFilters;
    timeFilter: PresentationTimeFilter;
    now?: Date;
  }): Promise<PrayerRequest[]> {
    await this.prayerService.loadPrayers();
    const snapshot = this.prayerService.getAllCommunityPrayersSnapshot();
    return filterPresentationCommunityPrayers(snapshot, options);
  }

  async loadPersonalPrayers(options: {
    statusFilters: PresentationStatusFilters;
    timeFilter: PresentationTimeFilter;
    now?: Date;
  }): Promise<PrayerRequest[]> {
    await this.prayerService.loadPersonalPrayers();
    const snapshot = this.prayerService.getPersonalPrayersSnapshot();
    return filterPresentationPersonalPrayers(snapshot, options);
  }

  async loadPrompts(): Promise<{
    prompts: PrayerPrompt[];
    categories: string[];
  }> {
    await this.promptService.loadPrompts();
    return {
      prompts: this.promptService.getPromptsSnapshot(),
      categories: this.promptService.getActivePromptCategories(),
    };
  }
}
