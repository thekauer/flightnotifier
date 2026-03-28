#!/usr/bin/env bun

import { parseArgs } from 'node:util';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  SOURCE_ROOT,
  publishFamilyFromSources,
  writeQuizInventory,
} from './lib/publish';

interface PublishArgs {
  family: string | null;
  quality: number;
  force: boolean;
}

function logStep(scope: string, message: string): void {
  console.log(`[assets:${scope}] ${message}`);
}

function parseCliArgs(): PublishArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      family: { type: 'string' },
      quality: { type: 'string', default: '82' },
      force: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  return {
    family: values.family ?? null,
    quality: Math.max(1, parseInt(values.quality ?? '82', 10) || 82),
    force: values.force ?? false,
  };
}

async function getFamilies(family: string | null): Promise<string[]> {
  if (family) {
    return [family];
  }

  try {
    return (await readdir(SOURCE_ROOT)).sort();
  } catch {
    return [];
  }
}

async function run(): Promise<void> {
  const args = parseCliArgs();
  const families = await getFamilies(args.family);
  if (families.length === 0) {
    throw new Error('No source families found to publish.');
  }

  logStep('publish', `families=${families.join(', ')}, quality=${args.quality}, force=${args.force}`);

  let converted = 0;
  let skipped = 0;
  let failed = 0;
  for (const familyId of families) {
    const result = await publishFamilyFromSources({
      familyId,
      quality: args.quality,
      force: args.force,
      log: (message) => logStep(familyId, message),
    });
    converted += result.converted;
    skipped += result.skipped;
    failed += result.failed.length;
    for (const entry of result.failed) {
      logStep(familyId, `failed ${path.relative(SOURCE_ROOT, entry.sourcePath)}: ${entry.error}`);
    }
  }

  const inventory = await writeQuizInventory((message) => logStep('inventory', message));
  const familiesWithAssets = Object.values(inventory).filter((items) => items.length > 0).length;
  logStep(
    'publish',
    `done converted=${converted} skipped=${skipped} failed=${failed} familiesWithAssets=${familiesWithAssets}`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
