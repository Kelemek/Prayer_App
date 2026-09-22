import { Component, Input } from "@angular/core";

/** Filter chip label with its count on a second line. */
@Component({
  selector: "app-home-sub-filter-count",
  standalone: true,
  host: { class: "contents" },
  template: `
    <span class="flex w-full min-w-0 flex-col items-center leading-tight">
      <span class="w-full truncate text-center">{{ label }} </span>
      <span class="tabular-nums">{{ count }}</span>
    </span>
  `,
})
export class HomeSubFilterCountComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) count!: number | string;
}
