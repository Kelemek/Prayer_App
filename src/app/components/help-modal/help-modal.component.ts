import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule, NgClass } from "@angular/common";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { FormsModule } from "@angular/forms";
import { HelpContentService } from "../../services/help-content.service";
import { HelpSection } from "../../types/help-content";
import { Observable, BehaviorSubject } from "rxjs";
import { map } from "rxjs/operators";

@Component({
  selector: "app-help-modal",
  standalone: true,
  imports: [CommonModule, NgClass, FormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (isOpen) {
    <div
      class="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-2 sm:p-4"
      style="padding-top: max(8px, env(safe-area-inset-top)); padding-bottom: max(8px, env(safe-area-inset-bottom));"
      (click)="onClose()"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div
        class="help-modal-panel bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md sm:max-w-lg lg:max-w-2xl max-h-[90dvh] sm:max-h-[85dvh] overflow-y-auto"
        #contentArea
        (click)="$event.stopPropagation()"
      >
        <div
          class="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700"
        >
          <div>
            <h2
              id="help-modal-title"
              class="text-xl font-semibold text-gray-800 dark:text-gray-100"
            >
              Help & Guidance
            </h2>
            <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
              Learn how to use the Prayer App
            </p>
          </div>
          <button
            (click)="onClose()"
            title="Close help"
            aria-label="Close help modal"
            class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="p-4 sm:p-6 space-y-4">
          <div class="relative">
            <svg
              class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              (input)="onSearchChange()"
              placeholder="Search help topics..."
              aria-label="Search help topics"
              class="w-full pl-10 pr-4 py-2 sm:py-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 hover:border-blue-300 dark:hover:border-blue-600 focus:border-blue-500 focus:outline-none transition-all"
            />
          </div>

          @if (isLoading$ | async) {
          <div class="flex items-center justify-center py-12">
            <div
              class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
            ></div>
          </div>
          }

          @if (error$ | async; as error) { @if (error && error !== 'Using
          default help content.') {
          <div
            class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4"
          >
            <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {{ error }}
            </p>
          </div>
          } }

          @if (helpSections$ | async; as sections) { @if ((filteredSections$ |
          async); as filteredSections) { @if (filteredSections.length > 0) {
          <div class="flex flex-col gap-1.5 sm:gap-2">
            @for (section of filteredSections; track section.id) {
            <div
              class="rounded-lg border-2 transition-all overflow-hidden"
              [ngClass]="{
                'border-blue-500 bg-blue-50 dark:bg-blue-900/20':
                  isSectionExpanded(section.id),
                'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20':
                  !isSectionExpanded(section.id)
              }"
            >
              <button
                (click)="toggleSection(section.id)"
                class="w-full p-2 sm:p-3 flex items-start justify-between gap-2 text-left cursor-pointer transition-all"
                [attr.aria-expanded]="isSectionExpanded(section.id)"
                [attr.aria-controls]="'section-content-' + section.id"
              >
                <div class="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                  <div
                    class="text-gray-600 dark:text-gray-400 mt-0.5 flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6"
                    [innerHTML]="getSafeIcon(section.icon)"
                  ></div>
                  <div class="min-w-0">
                    <h3
                      class="text-sm sm:text-base font-medium text-gray-800 dark:text-gray-100"
                    >
                      {{ section.title }}
                    </h3>
                    <p
                      class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5"
                    >
                      {{ section.description }}
                    </p>
                  </div>
                </div>
                <svg
                  class="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 transition-transform"
                  [class.rotate-180]="isSectionExpanded(section.id)"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              @if (isSectionExpanded(section.id)) {
              <div
                [id]="'section-content-' + section.id"
                class="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-gray-200 dark:border-gray-700"
              >
                <div class="flex flex-col gap-3 pt-3">
                  @for (content of section.content; track $index) {
                  <div>
                    <h4
                      class="text-sm font-medium text-gray-800 dark:text-gray-100"
                    >
                      {{ content.subtitle }}
                    </h4>
                    <p
                      class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1"
                    >
                      {{ content.text }}
                    </p>

                    @if (content.examples && content.examples.length > 0) {
                    <div
                      class="mt-2 pl-3 border-l-2 border-blue-500 dark:border-blue-400"
                    >
                      @for (example of content.examples; track $index) {
                      <p
                        class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 italic"
                      >
                        {{ example }}
                      </p>
                      }
                    </div>
                    }
                  </div>
                  }
                </div>
              </div>
              }
            </div>
            }
          </div>
          } @else {
          <div class="flex items-center justify-center py-12">
            <div class="text-center">
              <svg
                class="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                No help topics match your search.
              </p>
              <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-500 mt-1">
                Try searching with different keywords.
              </p>
            </div>
          </div>
          } } }

          <button
            type="button"
            (click)="onClose()"
            class="w-full flex flex-col items-center justify-center gap-1 sm:gap-2 p-2 sm:p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer"
          >
            <span
              class="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-100"
              >Close Help</span
            >
          </button>
        </div>
      </div>
    </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .help-modal-panel {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .help-modal-panel::-webkit-scrollbar {
        display: none;
      }
    `,
  ],
})
export class HelpModalComponent implements OnInit {
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();
  @ViewChild("contentArea") contentArea!: ElementRef;

  helpSections$!: Observable<HelpSection[]>;
  filteredSections$!: Observable<HelpSection[]>;
  isLoading$!: Observable<boolean>;
  error$!: Observable<string | null>;

  expandedSection: string | null = null;
  searchQuery = "";

  private searchQuerySubject = new BehaviorSubject<string>("");

  constructor(
    private helpContentService: HelpContentService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.helpSections$ = this.helpContentService.getSections();
    this.isLoading$ = this.helpContentService.isLoading$;
    this.error$ = this.helpContentService.error$;

    // Initialize filtered sections with search query
    this.filteredSections$ = this.searchQuerySubject.asObservable().pipe(
      map((query) => {
        // This will be updated when helpSections$ is combined
        return [];
      })
    );

    // Combine helpSections$ and search query for filtering
    this.filteredSections$ = this.helpContentService
      .getSections()
      .pipe(map((sections) => this.filterSections(sections, this.searchQuery)));

    // Update filtered sections when search query changes
    this.searchQuerySubject.subscribe((query) => {
      this.filteredSections$ = this.helpContentService
        .getSections()
        .pipe(map((sections) => this.filterSections(sections, query)));
    });
  }

  onSearchChange(): void {
    this.searchQuerySubject.next(this.searchQuery);
  }

  private filterSections(
    sections: HelpSection[],
    query: string
  ): HelpSection[] {
    if (!query.trim()) {
      return sections;
    }

    const lowerQuery = query.toLowerCase();

    return sections.filter((section) => {
      // Search in section title and description
      if (
        section.title.toLowerCase().includes(lowerQuery) ||
        section.description.toLowerCase().includes(lowerQuery)
      ) {
        return true;
      }

      // Search in section content (subtitles and text)
      return section.content.some(
        (content) =>
          content.subtitle.toLowerCase().includes(lowerQuery) ||
          content.text.toLowerCase().includes(lowerQuery) ||
          (content.examples &&
            content.examples.some((example) =>
              example.toLowerCase().includes(lowerQuery)
            ))
      );
    });
  }

  onClose(): void {
    this.closeModal.emit();
  }

  getSafeIcon(icon: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(icon);
  }

  toggleSection(sectionId: string): void {
    this.expandedSection =
      this.expandedSection === sectionId ? null : sectionId;

    // Scroll the section header to the top of the content container
    if (this.expandedSection === sectionId) {
      setTimeout(() => {
        const sectionHeader = document.querySelector(
          `[aria-controls="section-content-${sectionId}"]`
        ) as HTMLElement;
        if (sectionHeader && this.contentArea) {
          const headerTop = sectionHeader.getBoundingClientRect().top;
          const containerTop =
            this.contentArea.nativeElement.getBoundingClientRect().top;
          const scrollPosition =
            headerTop - containerTop + this.contentArea.nativeElement.scrollTop;
          this.contentArea.nativeElement.scrollTop = scrollPosition;
        }
      }, 0);
    }
  }

  isSectionExpanded(sectionId: string): boolean {
    return this.expandedSection === sectionId;
  }
}
