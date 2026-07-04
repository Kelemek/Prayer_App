import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { markdownToSafeHtml } from '../../../utils/markdown';

@Component({
  selector: 'app-rich-text-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [attr.class]="viewWrapperClass" [innerHTML]="safeHtml"></div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      /* ::ng-deep: innerHTML nodes lack emulated-encapsulation attrs; without this, Tailwind preflight hides list markers. */
      :host ::ng-deep .app-rich-text-view {
        line-height: 1.5;
        word-break: break-word;
      }
      :host ::ng-deep .app-rich-text-view > :first-child {
        margin-top: 0;
      }
      :host ::ng-deep .app-rich-text-view > :last-child {
        margin-bottom: 0;
      }
      :host ::ng-deep .app-rich-text-view p {
        margin: 0 0 0.5rem 0;
      }
      :host ::ng-deep .app-rich-text-view strong {
        font-weight: 600;
      }
      :host ::ng-deep .app-rich-text-view em {
        font-style: italic;
      }
      :host ::ng-deep .app-rich-text-view u {
        text-decoration: underline;
      }
      :host ::ng-deep .app-rich-text-view s {
        text-decoration: line-through;
      }
      :host ::ng-deep .app-rich-text-view ul,
      :host ::ng-deep .app-rich-text-view ol {
        margin: 0.25rem 0 0.5rem 0;
        padding-left: 1.5rem;
      }
      :host ::ng-deep .app-rich-text-view ul {
        list-style: disc;
      }
      :host ::ng-deep .app-rich-text-view ol {
        list-style: decimal;
      }
      :host ::ng-deep .app-rich-text-view li {
        margin: 0.15rem 0;
      }
      :host ::ng-deep .app-rich-text-view blockquote {
        margin: 0.5rem 0;
        padding: 0.25rem 0.75rem;
        border-left: 3px solid rgba(57, 112, 77, 0.5);
        color: inherit;
        opacity: 0.9;
      }
      :host ::ng-deep .app-rich-text-view a {
        color: #0047ab;
        text-decoration: underline;
      }
      :host-context(.dark) ::ng-deep .app-rich-text-view a {
        color: #93c5fd;
      }
      :host ::ng-deep .app-rich-text-view h3 {
        font-size: 1.05em;
        font-weight: 600;
        margin: 0.5rem 0 0.25rem 0;
      }
      :host ::ng-deep .app-rich-text-view h4 {
        font-size: 1em;
        font-weight: 600;
        margin: 0.5rem 0 0.25rem 0;
      }
      :host ::ng-deep .app-rich-text-view code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.9em;
        padding: 0.1em 0.3em;
        background: rgba(0, 0, 0, 0.06);
        border-radius: 3px;
      }
      :host-context(.dark) ::ng-deep .app-rich-text-view code {
        background: rgba(255, 255, 255, 0.08);
      }
      :host ::ng-deep .app-rich-text-view pre {
        margin: 0.5rem 0;
        padding: 0.5rem 0.75rem;
        background: rgba(0, 0, 0, 0.06);
        border-radius: 4px;
        overflow-x: auto;
      }
      :host-context(.dark) ::ng-deep .app-rich-text-view pre {
        background: rgba(255, 255, 255, 0.08);
      }
      :host ::ng-deep .app-rich-text-view pre code {
        background: transparent;
        padding: 0;
      }
    `,
  ],
})
export class RichTextViewComponent implements OnChanges {
  @Input() text: string | null | undefined = '';
  /** Optional extra class(es) applied to the wrapper div, e.g. text-lg or whitespace-pre-wrap. */
  @Input() extraClass = '';

  safeHtml: SafeHtml = '';
  viewWrapperClass = 'app-rich-text-view';

  constructor(@Inject(DomSanitizer) private sanitizer: DomSanitizer) {}

  ngOnChanges(_changes: SimpleChanges): void {
    const extra = (this.extraClass || '').trim();
    this.viewWrapperClass = extra ? `app-rich-text-view ${extra}` : 'app-rich-text-view';
    const html = markdownToSafeHtml(this.text ?? '');
    this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
