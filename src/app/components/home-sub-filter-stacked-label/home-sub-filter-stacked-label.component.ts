import { Component, Input } from "@angular/core";

/** Two-line chip label (e.g. Memorize action buttons). */
@Component({
  selector: "app-home-sub-filter-stacked-label",
  standalone: true,
  host: { class: "contents" },
  template: `
    <span class="flex w-full min-w-0 flex-col items-center leading-tight text-center">
      <span class="w-full truncate font-bold">{{ top }}</span>
      <span class="w-full truncate">{{ bottom }}</span>
    </span>
  `,
})
export class HomeSubFilterStackedLabelComponent {
  @Input({ required: true }) top!: string;
  @Input({ required: true }) bottom!: string;
}
