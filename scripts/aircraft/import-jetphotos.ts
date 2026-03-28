#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { publishSourceImage, writeQuizInventory, REPO_ROOT, SOURCE_ROOT, zeroPadSlot } from './lib/publish';

const USER_AGENT =
  'FlightNotifier/1.0 (local development; JetPhotos importer; contact: local workspace)';
const SEARCH_BASE_URL = 'https://www.jetphotos.com/showphotos.php';
const PHOTO_BASE_URL = 'https://www.jetphotos.com';
const TERMS_NOTE = 'JetPhotos page says to contact photographer for terms of use.';

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
  family: string;
  target: number;
  pages: number;
  concurrency: number;
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
      target: { type: 'string', default: '1' },
      pages: { type: 'string', default: '1' },
      concurrency: { type: 'string', default: '4' },
      quality: { type: 'string', default: '82' },
    },
    allowPositionals: false,
  });

  const family = values.family;
  if (!family) {
    throw new Error('Missing required --family argument.');
  }
  if (!FAMILY_CONFIG[family]) {
    throw new Error(`Unknown family "${family}".`);
  }

  return {
    family,
    target: Math.max(1, parseInt(values.target ?? '1', 10) || 1),
    pages: Math.max(1, parseInt(values.pages ?? '1', 10) || 1),
    concurrency: Math.max(1, parseInt(values.concurrency ?? '4', 10) || 1),
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
  console.log(`[jetphotos:${family}] ${message}`);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }

  return response.text();
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'image/avif,image/webp,image/apng,image/jpeg,image/*,*/*;q=0.8',
      referer: PHOTO_BASE_URL,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while downloading ${url}`);
  }

  return new Uint8Array(await response.arrayBuffer());
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

async function inspectPhotoPage(photoPageUrl: string): Promise<PhotoCandidate | null> {
  const html = await fetchText(photoPageUrl);
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

async function inspectCandidateBatch(
  photoPageUrls: string[],
  concurrency: number,
  family: string,
  target: number,
): Promise<PhotoCandidate[]> {
  const accepted: PhotoCandidate[] = [];
  let inspected = 0;

  for (let index = 0; index < photoPageUrls.length && accepted.length < target; index += concurrency) {
    const batch = photoPageUrls.slice(index, index + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (photoPageUrl) => {
        try {
          return await inspectPhotoPage(photoPageUrl);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logStep(family, `failed to inspect ${photoPageUrl}: ${message}`);
          return null;
        }
      }),
    );

    inspected += batch.length;
    for (const candidate of batchResults) {
      if (!candidate) continue;
      accepted.push(candidate);
      if (accepted.length >= target) break;
    }

    logStep(
      family,
      `inspected ${inspected}/${photoPageUrls.length} result pages, accepted ${accepted.length}/${target}`,
    );
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
): Promise<void> {
  const slot = zeroPadSlot(slotNumber);
  const imagePath = path.join(outputDir, `${slot}.jpg`);
  const sidecarPath = path.join(outputDir, `${slot}.json`);
  const publicWebpPath = path.join('public', 'assets', 'aircraft', familyId, `${slot}.webp`);

  logStep(familyId, `downloading ${candidate.imageUrl}`);
  const bytes = await fetchBytes(candidate.imageUrl);
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

async function run(): Promise<void> {
  const args = parseCliArgs();
  const familyConfig = FAMILY_CONFIG[args.family];
  const outputDir = path.join(SOURCE_ROOT, args.family);

  await mkdir(outputDir, { recursive: true });
  logStep(args.family, `starting import for ${familyConfig.name}`);
  logStep(
    args.family,
    `target=${args.target}, pages=${args.pages}, concurrency=${args.concurrency}, quality=${args.quality}`,
  );

  const allPhotoLinks: string[] = [];
  for (const searchValue of familyConfig.searches) {
    for (let page = 1; page <= args.pages; page += 1) {
      const searchUrl = buildSearchUrl(searchValue, page);
      logStep(args.family, `fetching search page ${page}: ${searchUrl}`);
      const html = await fetchText(searchUrl);
      const pageLinks = extractPhotoLinks(html);
      logStep(args.family, `found ${pageLinks.length} photo links on page ${page}`);
      allPhotoLinks.push(...pageLinks);
    }
  }

  const dedupedPhotoLinks = [...new Set(allPhotoLinks)];
  if (dedupedPhotoLinks.length === 0) {
    throw new Error('No JetPhotos result links were found.');
  }

  logStep(args.family, `discovered ${dedupedPhotoLinks.length} unique photo pages`);
  const accepted = await inspectCandidateBatch(
    dedupedPhotoLinks,
    args.concurrency,
    args.family,
    args.target,
  );

  if (accepted.length === 0) {
    throw new Error('No acceptable JetPhotos detail pages were found.');
  }

  let nextSlot = await getNextSlotNumber(outputDir);
  for (let index = 0; index < accepted.length; index += 1) {
    const candidate = accepted[index]!;
    const searchValue = familyConfig.searches[0]!;
    const searchUrl = buildSearchUrl(searchValue, 1);
    logStep(args.family, `saving ${index + 1}/${accepted.length} into slot ${zeroPadSlot(nextSlot)}`);
    await saveCandidate(
      args.family,
      familyConfig.name,
      searchValue,
      searchUrl,
      outputDir,
      nextSlot,
      candidate,
      args.quality,
    );
    nextSlot += 1;
  }

  logStep(args.family, `done: downloaded ${accepted.length} image(s) into ${path.relative(REPO_ROOT, outputDir)}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
