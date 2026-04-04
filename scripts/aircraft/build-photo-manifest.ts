#!/usr/bin/env bun

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface SourcePhotoMetadata {
  familyId?: string;
  aircraft?: {
    registration?: string | null;
    airline?: string | null;
  };
  files?: {
    publicWebp?: string;
  };
}

interface NotificationPhotoCandidate {
  registration: string | null;
  airline: string | null;
  imageUrl: string;
}

const REPO_ROOT = path.resolve(import.meta.dir, '..', '..');
const SOURCE_ROOT = path.join(REPO_ROOT, 'data', 'aircraft-sources');
const OUTPUT_PATH = path.join(REPO_ROOT, 'data', 'spotting', 'notification-photo-manifest.json');

async function main() {
  const manifest: Record<string, NotificationPhotoCandidate[]> = {};
  const families = await readdir(SOURCE_ROOT, { withFileTypes: true });

  for (const family of families) {
    if (!family.isDirectory()) {
      continue;
    }

    const familyDir = path.join(SOURCE_ROOT, family.name);
    const files = await readdir(familyDir, { withFileTypes: true });
    const entries: NotificationPhotoCandidate[] = [];

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.json')) {
        continue;
      }

      const raw = await readFile(path.join(familyDir, file.name), 'utf8');
      const parsed = JSON.parse(raw) as SourcePhotoMetadata;
      const imagePath = parsed.files?.publicWebp;
      if (!imagePath) {
        continue;
      }

      entries.push({
        registration: parsed.aircraft?.registration?.toUpperCase().trim() ?? null,
        airline: parsed.aircraft?.airline?.trim() ?? null,
        imageUrl: `/${imagePath.replace(/^public\//, '')}`,
      });
    }

    if (entries.length > 0) {
      manifest[family.name] = entries;
    }
  }

  await writeFile(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${OUTPUT_PATH}`);
}

void main();
