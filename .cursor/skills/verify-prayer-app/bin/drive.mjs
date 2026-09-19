#!/usr/bin/env node
/**
 * Drive Prayer App public (and optional authenticated) paths.
 *
 * Usage:
 *   node drive.mjs public
 *   node drive.mjs login
 *   node drive.mjs snapshot --route /info --name info
 *
 * Env:
 *   PRAYER_APP_VERIFY_BASE_URL   default http://127.0.0.1:4200
 *   PRAYER_APP_VERIFY_EVIDENCE_DIR
 *   PRAYER_APP_VERIFY_EMAIL
 *   PRAYER_APP_VERIFY_OTP
 *   PRAYER_APP_VERIFY_HEADLESS   default 1
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PRODUCTION_HOSTS = new Set(["prayerapp.romans8.net", "prayer.romans8.net"]);

const baseUrl = (process.env.PRAYER_APP_VERIFY_BASE_URL || "http://127.0.0.1:4200").replace(
  /\/$/,
  ""
);
const evidenceDir =
  process.env.PRAYER_APP_VERIFY_EVIDENCE_DIR ||
  join(dirname(fileURLToPath(import.meta.url)), "..", "artifacts", "manual");
const headless = process.env.PRAYER_APP_VERIFY_HEADLESS !== "0";

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function refuseProduction() {
  if (PRODUCTION_HOSTS.has(hostOf(baseUrl))) {
    console.error(
      `REFUSE: ${baseUrl} is production. Drive local ng serve, never prayerapp.romans8.net.`
    );
    process.exit(2);
  }
}

function ensureEvidence() {
  mkdirSync(evidenceDir, { recursive: true });
}

function writeEvidence(name, content) {
  ensureEvidence();
  const path = join(evidenceDir, name);
  writeFileSync(path, content);
  return path;
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    return null;
  }
}

async function withPage(fn) {
  const playwright = await loadPlaywright();
  if (!playwright) {
    return { skipped: true, reason: "playwright package is not installed in this checkout" };
  }
  const browser = await playwright.chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    return await fn(page);
  } finally {
    await browser.close();
  }
}

async function httpPublic() {
  const routes = ["/info", "/login", "/privacy", "/terms", "/support"];
  const results = [];
  for (const route of routes) {
    const url = `${baseUrl}${route}`;
    const res = await fetch(url);
    const body = await res.text();
    const looksLikeSpa =
      body.includes("app-root") || body.includes("Prayer") || body.includes("<!doctype html");
    results.push({
      route,
      status: res.status,
      ok: res.ok && looksLikeSpa,
      bytes: body.length,
    });
  }
  const path = writeEvidence("public-http.json", JSON.stringify({ baseUrl, results }, null, 2) + "\n");
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error("HTTP public drive failed", failed);
    process.exit(1);
  }
  console.log(`HTTP public routes OK. Evidence: ${path}`);
  return results;
}

async function browserPublic() {
  const result = await withPage(async (page) => {
    const shots = [];

    await page.goto(`${baseUrl}/info`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Prayer Community/i }).waitFor();
    const infoShot = join(evidenceDir, "info.png");
    ensureEvidence();
    await page.screenshot({ path: infoShot, fullPage: true });
    const infoAria = await page.locator("body").innerText();
    writeEvidence("info.txt", infoAria);
    shots.push(infoShot);
    if (!infoAria.includes("Prayer Community") || !infoAria.includes("Web Site")) {
      throw new Error("/info is missing expected public copy");
    }

    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Prayer Community" }).waitFor();
    await page.getByLabel("Email Address").waitFor();
    await page.getByRole("button", { name: "Send Verification Code" }).waitFor();
    const loginShot = join(evidenceDir, "login.png");
    await page.screenshot({ path: loginShot, fullPage: true });
    writeEvidence("login.txt", await page.locator("body").innerText());
    shots.push(loginShot);

    await page.getByRole("link", { name: /Learn more about this app/i }).click();
    await page.waitForURL(/\/info/);
    await page.getByRole("heading", { name: /Prayer Community/i }).waitFor();

    return { shots };
  });

  if (result?.skipped) {
    writeEvidence(
      "browser-skipped.txt",
      `${result.reason}\nInstall with: npm install --no-save playwright && npx playwright install chromium\nHTTP-only public checks still ran.\n`
    );
    console.log(`Browser drive skipped: ${result.reason}`);
    return result;
  }
  console.log(`Browser public drive OK. Screenshots in ${evidenceDir}`);
  return result;
}

async function browserLogin() {
  const email = process.env.PRAYER_APP_VERIFY_EMAIL || "";
  const otp = process.env.PRAYER_APP_VERIFY_OTP || "";
  if (!email || !otp) {
    const path = writeEvidence(
      "login-skipped.txt",
      "PRAYER_APP_VERIFY_EMAIL and PRAYER_APP_VERIFY_OTP are required to complete login.\nUse the platform test-account email and 6-digit code (Admin → Test Account). Do not use production mailboxes.\n"
    );
    console.log(`Authenticated login skipped. ${path}`);
    return { skipped: true };
  }

  const result = await withPage(async (page) => {
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Email Address").fill(email);
    await page.getByRole("button", { name: "Send Verification Code" }).click();
    await page.getByRole("heading", { name: /App Tester Sign In|Check Your Email/i }).waitFor({
      timeout: 20000,
    });
    await page.locator("#mfa-code-input").fill(otp);
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 20000 });
    const homeShot = join(evidenceDir, "home-after-login.png");
    ensureEvidence();
    await page.screenshot({ path: homeShot, fullPage: true });
    writeEvidence("home-after-login.txt", await page.locator("body").innerText());
    return { homeShot };
  });

  if (result?.skipped) {
    console.log(`Browser login skipped: ${result.reason}`);
    return result;
  }
  console.log(`Authenticated login OK. Evidence: ${evidenceDir}`);
  return result;
}

async function snapshot(route, name) {
  const result = await withPage(async (page) => {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    ensureEvidence();
    const shot = join(evidenceDir, `${name}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    writeEvidence(`${name}.txt`, await page.locator("body").innerText());
    return { shot };
  });
  if (result?.skipped) {
    console.log(`Snapshot skipped: ${result.reason}`);
    return result;
  }
  console.log(`Snapshot ${route} -> ${result.shot}`);
  return result;
}

function parseArgs(argv) {
  const args = { cmd: argv[2] || "public", route: "/info", name: "page" };
  for (let i = 3; i < argv.length; i += 1) {
    if (argv[i] === "--route") {
      args.route = argv[++i];
    } else if (argv[i] === "--name") {
      args.name = argv[++i];
    }
  }
  return args;
}

const args = parseArgs(process.argv);
refuseProduction();
ensureEvidence();

switch (args.cmd) {
  case "public":
    await httpPublic();
    await browserPublic();
    break;
  case "login":
    await browserLogin();
    break;
  case "snapshot":
    await snapshot(args.route, args.name);
    break;
  default:
    console.error(`Unknown command ${args.cmd}. Use public | login | snapshot`);
    process.exit(2);
}
