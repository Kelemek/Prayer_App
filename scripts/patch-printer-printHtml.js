#!/usr/bin/env node
/**
 * Applies the printHtml UI-thread fix to @capgo/capacitor-printer after patch-package.
 * Run from repo root. Safe to run multiple times (idempotent).
 */

const fs = require('fs');
const path = require('path');

const pluginPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@capgo',
  'capacitor-printer',
  'android',
  'src',
  'main',
  'java',
  'com',
  'capgo',
  'printer',
  'PrinterPlugin.java'
);

const oldPrintHtml = `        try {
            implementation.printHtml(html, name);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to print HTML: " + e.getMessage(), e);
        }`;

const newPrintHtml = `        android.app.Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                implementation.printHtml(html, name);
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to print HTML: " + e.getMessage(), e);
            }
        });`;

if (!fs.existsSync(pluginPath)) {
  console.warn('[patch-printer-printHtml] PrinterPlugin.java not found, skipping.');
  process.exit(0);
}

let content = fs.readFileSync(pluginPath, 'utf8');
if (content.includes(newPrintHtml)) {
  process.exit(0);
}
if (!content.includes(oldPrintHtml)) {
  console.warn('[patch-printer-printHtml] printHtml block not found, skipping.');
  process.exit(0);
}

content = content.replace(oldPrintHtml, newPrintHtml);
fs.writeFileSync(pluginPath, content, 'utf8');
console.log('[patch-printer-printHtml] Applied printHtml UI-thread fix.');
