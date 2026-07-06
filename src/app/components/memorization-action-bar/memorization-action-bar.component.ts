import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-memorization-action-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mb-4 flex w-full gap-2">
      <button
        type="button"
        (click)="addVerses.emit()"
        class="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer sm:flex-none"
      >
        <span aria-hidden="true">+</span>
        Add Verses
      </button>
      <button
        type="button"
        (click)="addBibleBooks.emit()"
        class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-blue-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-600 dark:hover:bg-gray-700 sm:flex-none"
      >
        <span aria-hidden="true">+</span>
        Bible Books
      </button>
    </div>
  `,
})
export class MemorizationActionBarComponent {
  @Output() addVerses = new EventEmitter<void>();
  @Output() addBibleBooks = new EventEmitter<void>();
}
