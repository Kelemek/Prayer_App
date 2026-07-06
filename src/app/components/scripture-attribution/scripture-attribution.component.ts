import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { BibleTranslation } from '../../types/memorization';

const LINK_CLASS =
  'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline';

@Component({
  selector: 'app-scripture-attribution',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      data-testid="scripture-attribution"
      class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600"
    >
      @switch (translation) {
        @case ('esv') {
          <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
            Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®),
            © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission.
            <a
              href="https://www.esv.org"
              target="_blank"
              rel="noopener noreferrer"
              [class]="linkClass"
            >
              www.esv.org
            </a>
          </p>
        }
        @case ('kjv') {
          <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
            Scripture quotations are from the King James Version (KJV), which is in the public domain.
          </p>
        }
        @case ('nasb') {
          <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
            Scripture quotations taken from the New American Standard Bible® (NASB), Copyright © 1960,
            1962, 1963, 1968, 1971, 1972, 1973, 1975, 1977, 1995 by The Lockman Foundation. Used by
            permission.
            <a
              href="https://www.lockman.org"
              target="_blank"
              rel="noopener noreferrer"
              [class]="linkClass"
            >
              www.lockman.org
            </a>
          </p>
        }
        @case ('lsb') {
          <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
            Legacy Standard Bible Copyright ©2021 by The Lockman Foundation. All rights reserved. Managed
            in partnership with Three Sixteen Publishing Inc.
            <a
              href="https://www.LSBible.org"
              target="_blank"
              rel="noopener noreferrer"
              [class]="linkClass"
            >
              LSBible.org
            </a>
            For Permission to Quote Information visit
            <a
              href="https://www.LSBible.org"
              target="_blank"
              rel="noopener noreferrer"
              [class]="linkClass"
            >
              www.LSBible.org
            </a>
          </p>
        }
        @case ('niv') {
          <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
            Scripture quotations taken from THE HOLY BIBLE, NEW INTERNATIONAL VERSION®, NIV® Copyright
            © 1973, 1978, 1984, 2011 by Biblica, Inc.® Used by permission.
            <a
              href="https://www.biblica.com"
              target="_blank"
              rel="noopener noreferrer"
              [class]="linkClass"
            >
              Biblica.com
            </a>
          </p>
        }
        @case ('nlt') {
          <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
            Scripture quotations marked NLT are taken from the Holy Bible, New Living Translation,
            copyright © 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale
            House Publishers, Inc.
            <a
              href="https://www.tyndale.com"
              target="_blank"
              rel="noopener noreferrer"
              [class]="linkClass"
            >
              Tyndale.com
            </a>
          </p>
        }
        @case ('csb') {
          <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
            Scripture quotations taken from the Christian Standard Bible®, Copyright © 2017 by Holman Bible
            Publishers. Used by permission.
            <a
              href="https://csbible.com"
              target="_blank"
              rel="noopener noreferrer"
              [class]="linkClass"
            >
              CSBible.com
            </a>
          </p>
        }
      }
    </div>
  `,
})
export class ScriptureAttributionComponent {
  @Input({ required: true }) translation!: BibleTranslation;

  readonly linkClass = LINK_CLASS;
}
