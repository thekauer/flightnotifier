#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer-core';
import { publishSourceImage, writeQuizInventory, REPO_ROOT, SOURCE_ROOT, zeroPadSlot } from './lib/publish';

puppeteer.use(StealthPlugin());

const SEARCH_BASE_URL = 'https://www.jetphotos.com/showphotos.php';
const PHOTO_BASE_URL = 'https://www.jetphotos.com';
const TERMS_NOTE = 'JetPhotos page says to contact photographer for terms of use.';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Max retries on 403 / rate limit. */
const MAX_RETRIES = 5;
/** Base backoff on rate limit — doubles each attempt: 60s, 120s, 240s, ... */
const RATE_LIMIT_BACKOFF_MS = 60_000;
/** Delay between sequential requests (ms). ~16 req/min, well under 30/min. */
const DEFAULT_DELAY_MS = 1_000;
/** Random jitter ±500ms added to delay. */
const JITTER_MS = 500;
/** Path to system Chrome on macOS. */
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

let _browser: Browser | null = null;
let _requestCount = 0;
const _startTime = Date.now();

async function getBrowser(): Promise<Browser> {
  if (!_browser) {
    logStep('browser', 'launching headless Chrome with stealth...');
    _browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
      ],
    }) as unknown as Browser;
    logStep('browser', 'Chrome launched');
  }
  return _browser;
}

async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
    logStep('browser', 'Chrome closed');
  }
}

const FAMILY_CONFIG: Record<string, { name: string; searches: string[] }> = {
  'boeing-747': { name: 'Boeing 747', searches: ['Boeing 747;'] },
  'boeing-777': { name: 'Boeing 777', searches: ['Boeing 777;'] },
  'boeing-787': { name: 'Boeing 787', searches: ['Boeing 787;'] },
  'airbus-a330': { name: 'Airbus A330', searches: ['Airbus A330;'] },
  'airbus-a340': { name: 'Airbus A340', searches: ['Airbus A340;'] },
  'airbus-a350': { name: 'Airbus A350', searches: ['Airbus A350;'] },
  'airbus-a380': { name: 'Airbus A380', searches: ['Airbus A380;'] },
  'boeing-737': { name: 'Boeing 737', searches: ['Boeing 737;'] },
  'boeing-757': { name: 'Boeing 757', searches: ['Boeing 757;'] },
  'boeing-767': { name: 'Boeing 767', searches: ['Boeing 767;'] },
  'airbus-a320': {
    name: 'Airbus A320 Family',
    searches: ['Airbus A318;', 'Airbus A319;', 'Airbus A320;', 'Airbus A321;'],
  },
  'embraer-ejet': {
    name: 'Embraer E-Jet',
    searches: ['Embraer 170;', 'Embraer 190;'],
  },
  'atr-72': { name: 'ATR 72', searches: ['ATR 72;'] },
  'dash-8': { name: 'Dash 8 / Q400', searches: ['Bombardier Dash 8;'] },
  'bombardier-crj': { name: 'Bombardier CRJ', searches: ['Bombardier CRJ;'] },
};

interface ImportArgs {
  families: string[];
  target: number;
  pages: number;
  delay: number;
  quality: number;
}

interface PhotoCandidate {
  photoId: string;
  photoPageUrl: string;
  imageUrl: string;
  registration: string | null;
  exactType: string | null;
  airline: string | null;
  photographer: string | null;
  uploadedDate: string | null;
  photoDate: string | null;
  locationName: string | null;
}

function parseCliArgs(): ImportArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      family: { type: 'string' },
      target: { type: 'string', default: '100' },
      pages: { type: 'string', default: '5' },
      delay: { type: 'string', default: String(DEFAULT_DELAY_MS) },
      quality: { type: 'string', default: '82' },
    },
    allowPositionals: false,
  });

  let families: string[];
  if (values.family) {
    if (!FAMILY_CONFIG[values.family]) {
      throw new Error(`Unknown family "${values.family}". Valid: ${Object.keys(FAMILY_CONFIG).join(', ')}`);
    }
    families = [values.family];
  } else {
    families = Object.keys(FAMILY_CONFIG);
  }

  return {
    families,
    target: Math.max(1, parseInt(values.target ?? '100', 10) || 100),
    pages: Math.max(1, parseInt(values.pages ?? '5', 10) || 5),
    delay: Math.max(0, parseInt(values.delay ?? String(DEFAULT_DELAY_MS), 10) || DEFAULT_DELAY_MS),
    quality: Math.max(1, parseInt(values.quality ?? '82', 10) || 82),
  };
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function logStep(family: string, message: string): void {
  const elapsed = ((Date.now() - _startTime) / 1000).toFixed(0);
  console.log(`[${elapsed}s req#${_requestCount}] [jetphotos:${family}] ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredDelay(baseMs: number): number {
  return baseMs + Math.round((Math.random() * 2 - 1) * JITTER_MS);
}

/** Throttle: wait between requests to stay under rate limits. */
async function throttle(delayMs: number): Promise<void> {
  const actual = jitteredDelay(delayMs);
  await sleep(actual);
}

/**
 * Fetch HTML via headless Chrome (bypasses Cloudflare).
 * Retries on 403 with exponential backoff (60s, 120s, 240s, ...).
 */
async function fetchText(url: string, delayMs: number): Promise<string> {
  const browser = await getBrowser();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    _requestCount++;
    const page: Page = await browser.newPage();
    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      const status = response?.status() ?? 0;

      if (status >= 200 && status < 400) {
        const html = await page.content();
        await throttle(delayMs);
        return html;
      }

      lastError = new Error(`HTTP ${status} while fetching ${url}`);

      if ((status === 403 || status === 429) && attempt < MAX_RETRIES) {
        const backoff = RATE_LIMIT_BACKOFF_MS * Math.pow(2, attempt - 1);
        logStep('fetch', `got ${status} on attempt ${attempt}/${MAX_RETRIES}, backing off ${(backoff / 1000).toFixed(0)}s...`);
        await sleep(backoff);
        continue;
      }

      throw lastError;
    } catch (error) {
      if (error === lastError) throw error;
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) {
        const backoff = RATE_LIMIT_BACKOFF_MS * Math.pow(2, attempt - 1);
        logStep('fetch', `error on attempt ${attempt}/${MAX_RETRIES}: ${lastError.message}, backing off ${(backoff / 1000).toFixed(0)}s...`);
        await sleep(backoff);
        continue;
      }
      throw lastError;
    } finally {
      await page.close();
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts`);
}

/** Fetch image bytes (CDN, not behind Cloudflare — direct fetch is fine). */
async function fetchBytes(url: string, delayMs: number): Promise<Uint8Array> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    _requestCount++;
    const response = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'image/avif,image/webp,image/apng,image/jpeg,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: `${PHOTO_BASE_URL}/`,
      },
      redirect: 'follow',
    });

    if (response.ok) {
      const data = new Uint8Array(await response.arrayBuffer());
      await throttle(delayMs);
      return data;
    }

    lastError = new Error(`HTTP ${response.status} while downloading ${url}`);

    if ((response.status === 403 || response.status === 429) && attempt < MAX_RETRIES) {
      const backoff = RATE_LIMIT_BACKOFF_MS * Math.pow(2, attempt - 1);
      logStep('fetch', `got ${response.status} on image attempt ${attempt}/${MAX_RETRIES}, backing off ${(backoff / 1000).toFixed(0)}s...`);
      await sleep(backoff);
      continue;
    }

    throw lastError;
  }

  throw lastError ?? new Error(`Failed to download ${url} after ${MAX_RETRIES} attempts`);
}

function buildSearchUrl(searchValue: string, page: number): string {
  const params = new URLSearchParams({
    aircraft: searchValue,
    airline: 'all',
    'country-location': 'all',
    'photographer-group': 'all',
    'keywords-contain': '3',
    keywords: '',
    'photo-year': 'all',
    width: '',
    height: '',
    genre: '',
    'search-type': 'Advanced',
    'sort-order': '0',
  });

  if (page > 1) {
    params.set('page', String(page));
  }

  return `${SEARCH_BASE_URL}?${params.toString()}`;
}

function extractPhotoLinks(html: string): string[] {
  const links = new Set<string>();

  for (const match of html.matchAll(
    /<a[^>]+class="[^"]*result__photoLink[^"]*"[^>]+href="([^"]+)"/gi,
  )) {
    const href = match[1];
    if (href.startsWith('/photo/')) {
      links.add(new URL(href, PHOTO_BASE_URL).toString());
    }
  }

  if (links.size === 0) {
    for (const match of html.matchAll(/href="(\/photo\/\d+[^"]*)"/gi)) {
      links.add(new URL(match[1], PHOTO_BASE_URL).toString());
    }
  }

  return [...links];
}

function extractMetaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(
    new RegExp(`<meta[^>]+(?:property|name)="${escaped}"[^>]+content="([^"]+)"`, 'i'),
  );
  return match ? decodeHtml(match[1].trim()) : null;
}

function extractScriptJsonLd(html: string): Record<string, unknown> | null {
  const match = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/i);
  if (!match) return null;

  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractLabeledValue(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const spanMatch = html.match(
    new RegExp(
      `${escaped}:?\\s*</span>\\s*<span[^>]*>([\\s\\S]*?)</span>`,
      'i',
    ),
  );
  if (spanMatch) {
    return stripTags(spanMatch[1]);
  }

  const linkMatch = html.match(
    new RegExp(
      `${escaped}:?\\s*</span>\\s*<a[^>]*>([\\s\\S]*?)</a>`,
      'i',
    ),
  );
  if (linkMatch) {
    return stripTags(linkMatch[1]);
  }

  return null;
}

function parseTitleMetadata(html: string): {
  registration: string | null;
  exactType: string | null;
  airline: string | null;
  photographer: string | null;
} {
  const title =
    extractMetaContent(html, 'og:title') ??
    (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]
      ? decodeHtml(stripTags(html.match(/<title>([\s\S]*?)<\/title>/i)![1]))
      : '');

  const parts = title
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part !== 'JetPhotos');

  return {
    registration: parts[0] ?? null,
    exactType: parts[1] ?? null,
    airline: parts[2] ?? null,
    photographer: parts[3] ?? null,
  };
}

async function inspectPhotoPage(photoPageUrl: string, delayMs: number): Promise<PhotoCandidate | null> {
  const html = await fetchText(photoPageUrl, delayMs);
  const jsonLd = extractScriptJsonLd(html);
  const titleFields = parseTitleMetadata(html);
  const ogImage = extractMetaContent(html, 'og:image');
  const imageUrl =
    ogImage ||
    (typeof jsonLd?.contentUrl === 'string' ? jsonLd.contentUrl : null);

  if (!imageUrl || !imageUrl.includes('/full/')) {
    return null;
  }

  const photoIdMatch = photoPageUrl.match(/\/photo\/(\d+)/);
  if (!photoIdMatch) {
    return null;
  }

  return {
    photoId: photoIdMatch[1],
    photoPageUrl,
    imageUrl,
    registration:
      extractLabeledValue(html, 'Registration') ?? titleFields.registration,
    exactType:
      extractLabeledValue(html, 'Aircraft') ?? titleFields.exactType,
    airline:
      extractLabeledValue(html, 'Airline') ?? titleFields.airline,
    photographer:
      extractLabeledValue(html, 'Photographer') ??
      (typeof jsonLd?.author === 'string' ? jsonLd.author : titleFields.photographer),
    uploadedDate:
      extractLabeledValue(html, 'Uploaded') ??
      (typeof jsonLd?.datePublished === 'string' ? jsonLd.datePublished : null),
    photoDate: extractLabeledValue(html, 'Photo Date'),
    locationName:
      extractLabeledValue(html, 'Location') ??
      (typeof jsonLd?.contentLocation === 'string' ? jsonLd.contentLocation : null),
  };
}

/** Inspect candidates sequentially (one at a time) to respect rate limits. */
async function inspectCandidatesSequential(
  photoPageUrls: string[],
  family: string,
  target: number,
  delayMs: number,
): Promise<PhotoCandidate[]> {
  const accepted: PhotoCandidate[] = [];
  let inspected = 0;

  for (const photoPageUrl of photoPageUrls) {
    if (accepted.length >= target) break;

    inspected++;
    try {
      const candidate = await inspectPhotoPage(photoPageUrl, delayMs);
      if (candidate) {
        accepted.push(candidate);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logStep(family, `failed to inspect ${photoPageUrl}: ${message}`);
    }

    if (inspected % 10 === 0 || accepted.length >= target) {
      logStep(family, `inspected ${inspected}/${photoPageUrls.length}, accepted ${accepted.length}/${target}`);
    }
  }

  return accepted;
}

async function getNextSlotNumber(outputDir: string): Promise<number> {
  try {
    const names = await readdir(outputDir);
    const occupied = names
      .map((name) => path.parse(name).name)
      .filter((name) => /^\d+$/.test(name))
      .map((name) => parseInt(name, 10));

    const max = occupied.length > 0 ? Math.max(...occupied) : 0;
    return max + 1;
  } catch {
    return 1;
  }
}

async function saveCandidate(
  familyId: string,
  familyName: string,
  searchValue: string,
  searchUrl: string,
  outputDir: string,
  slotNumber: number,
  candidate: PhotoCandidate,
  quality: number,
  delayMs: number,
): Promise<void> {
  const slot = zeroPadSlot(slotNumber);
  const imagePath = path.join(outputDir, `${slot}.jpg`);
  const sidecarPath = path.join(outputDir, `${slot}.json`);
  const publicWebpPath = path.join('public', 'assets', 'aircraft', familyId, `${slot}.webp`);

  logStep(familyId, `downloading ${candidate.imageUrl}`);
  const bytes = await fetchBytes(candidate.imageUrl, delayMs);
  await writeFile(imagePath, bytes);

  const hash = createHash('sha256').update(bytes).digest('hex');
  const sidecar = {
    id: `${familyId}-${slot}`,
    familyId,
    familyName,
    source: {
      provider: 'jetphotos',
      originalLink: candidate.photoPageUrl,
      photoPageUrl: candidate.photoPageUrl,
      imageUrl: candidate.imageUrl,
      searchUrl,
      searchAircraft: searchValue,
      photographer: candidate.photographer,
      licenseStatus: 'unknown',
      termsNote: TERMS_NOTE,
      jetphotosPhotoId: candidate.photoId,
    },
    aircraft: {
      exactType: candidate.exactType,
      normalizedFamily: familyName,
      registration: candidate.registration,
      serialNumber: null,
      airline: candidate.airline,
    },
    photo: {
      photoDate: candidate.photoDate,
      uploadedDate: candidate.uploadedDate,
      locationName: candidate.locationName,
      locationCountry: null,
      notes: null,
    },
    files: {
      sourceJpg: path.relative(REPO_ROOT, imagePath),
      sidecar: path.relative(REPO_ROOT, sidecarPath),
      publicWebp: publicWebpPath,
    },
    image: {
      width: null,
      height: null,
      sha256: hash,
      sizeBytes: bytes.byteLength,
    },
    curation: {
      approved: false,
      notes: '',
    },
    importedAt: new Date().toISOString(),
  };

  await writeFile(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`);
  logStep(familyId, `saved ${path.relative(REPO_ROOT, imagePath)} and ${path.relative(REPO_ROOT, sidecarPath)}`);
  await publishSourceImage({
    familyId,
    sourcePath: imagePath,
    slotNumber,
    quality,
    force: true,
    log: (message) => logStep(familyId, message),
  });
  await writeQuizInventory((message) => logStep(familyId, message));
}

async function importFamily(
  familyId: string,
  args: ImportArgs,
): Promise<void> {
  const familyConfig = FAMILY_CONFIG[familyId]!;
  const outputDir = path.join(SOURCE_ROOT, familyId);

  await mkdir(outputDir, { recursive: true });
  logStep(familyId, `starting import for ${familyConfig.name}`);
  logStep(familyId, `target=${args.target}, pages=${args.pages}, delay=${args.delay}ms, quality=${args.quality}`);

  const allPhotoLinks: string[] = [];
  for (const searchValue of familyConfig.searches) {
    for (let page = 1; page <= args.pages; page += 1) {
      const searchUrl = buildSearchUrl(searchValue, page);
      logStep(familyId, `fetching search page ${page}: ${searchUrl}`);
      const html = await fetchText(searchUrl, args.delay);
      const pageLinks = extractPhotoLinks(html);
      logStep(familyId, `found ${pageLinks.length} photo links on page ${page}`);
      allPhotoLinks.push(...pageLinks);
    }
  }

  const dedupedPhotoLinks = [...new Set(allPhotoLinks)];
  if (dedupedPhotoLinks.length === 0) {
    logStep(familyId, 'no result links found, skipping');
    return;
  }

  logStep(familyId, `discovered ${dedupedPhotoLinks.length} unique photo pages`);
  const accepted = await inspectCandidatesSequential(
    dedupedPhotoLinks,
    familyId,
    args.target,
    args.delay,
  );

  if (accepted.length === 0) {
    logStep(familyId, 'no acceptable detail pages found, skipping');
    return;
  }

  let nextSlot = await getNextSlotNumber(outputDir);
  for (let index = 0; index < accepted.length; index += 1) {
    const candidate = accepted[index]!;
    const searchValue = familyConfig.searches[0]!;
    const searchUrl = buildSearchUrl(searchValue, 1);
    logStep(familyId, `saving ${index + 1}/${accepted.length} into slot ${zeroPadSlot(nextSlot)}`);
    await saveCandidate(
      familyId,
      familyConfig.name,
      searchValue,
      searchUrl,
      outputDir,
      nextSlot,
      candidate,
      args.quality,
      args.delay,
    );
    nextSlot += 1;
  }

  logStep(familyId, `done: downloaded ${accepted.length} image(s) into ${path.relative(REPO_ROOT, outputDir)}`);
}

async function run(): Promise<void> {
  const args = parseCliArgs();

  try {
    if (args.families.length > 1) {
      const totalEstReqs = args.families.length * (args.pages * 2 + args.target * 1.5 + args.target);
      const estMinutes = Math.round((totalEstReqs * (args.delay + 3000)) / 60_000);
      console.log(`Importing ${args.families.length} families, ~${Math.round(totalEstReqs)} requests, est. ~${estMinutes} min`);
      console.log(`Families: ${args.families.join(', ')}`);
    }

    for (const familyId of args.families) {
      await importFamily(familyId, args);
    }

    const elapsed = ((Date.now() - _startTime) / 60_000).toFixed(1);
    console.log(`\nAll done. ${_requestCount} requests in ${elapsed} minutes.`);
  } finally {
    await closeBrowser();
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
