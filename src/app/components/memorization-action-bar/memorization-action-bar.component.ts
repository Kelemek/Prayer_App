import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-memorization-action-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-wrap gap-2 mb-4">
      <button
        type="button"
        (click)="addVerses.emit()"
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span aria-hidden="true">+</span>
        Add Verses
      </button>
      <button
        type="button"
        (click)="addBibleBooks.emit()"
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium border border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
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
