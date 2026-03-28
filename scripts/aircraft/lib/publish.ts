import { access, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const REPO_ROOT = path.resolve(import.meta.dir, '..', '..', '..');
export const SOURCE_ROOT = path.join(REPO_ROOT, 'data', 'aircraft-sources');
export const PUBLIC_ASSET_ROOT = path.join(REPO_ROOT, 'public', 'assets', 'aircraft');
export const QUIZ_INVENTORY_PATH = path.join(REPO_ROOT, 'data', 'spotting', 'image-inventory.json');
export const SUPPORTED_SOURCE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

export interface QuizImageAsset {
  number: number;
  format: 'webp' | 'jpg' | 'png';
}

export type QuizImageInventory = Record<string, QuizImageAsset[]>;

interface PublishImageArgs {
  familyId: string;
  sourcePath: string;
  slotNumber: number;
  quality?: number;
  force?: boolean;
  log?: (message: string) => void;
}

interface PublishFamilyArgs {
  familyId: string;
  quality?: number;
  force?: boolean;
  log?: (message: string) => void;
}

export interface PublishFamilyResult {
  familyId: string;
  converted: number;
  skipped: number;
  failed: Array<{ sourcePath: string; error: string }>;
}

export function zeroPadSlot(slot: number): string {
  return String(slot).padStart(3, '0');
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function toRepoRelative(filePath: string): string {
  return path.relative(REPO_ROOT, filePath);
}

async function runCwebp(
  sourcePath: string,
  outputPath: string,
  quality: number,
): Promise<void> {
  const args = ['-quiet', '-mt'];
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext === '.png') {
    args.push('-lossless', '-m', '6');
  } else {
    args.push('-q', String(quality));
  }
  args.push(sourcePath, '-o', outputPath);

  await new Promise<void>((resolve, reject) => {
    const child = spawn('cwebp', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `cwebp exited with code ${code}`));
    });
  });
}

export async function publishSourceImage(args: PublishImageArgs): Promise<'converted' | 'skipped'> {
  const { familyId, sourcePath, slotNumber, quality = 82, force = false, log } = args;
  const publicDir = path.join(PUBLIC_ASSET_ROOT, familyId);
  const destinationPath = path.join(publicDir, `${zeroPadSlot(slotNumber)}.webp`);

  await mkdir(publicDir, { recursive: true });

  if (!force && (await pathExists(destinationPath))) {
    const [sourceStat, destinationStat] = await Promise.all([
      stat(sourcePath),
      stat(destinationPath),
    ]);
    if (destinationStat.mtimeMs >= sourceStat.mtimeMs) {
      log?.(`skipping up-to-date ${toRepoRelative(destinationPath)}`);
      return 'skipped';
    }
  }

  log?.(`converting ${toRepoRelative(sourcePath)} -> ${toRepoRelative(destinationPath)}`);
  await runCwebp(sourcePath, destinationPath, quality);
  return 'converted';
}

export async function publishFamilyFromSources(args: PublishFamilyArgs): Promise<PublishFamilyResult> {
  const { familyId, quality = 82, force = false, log } = args;
  const sourceDir = path.join(SOURCE_ROOT, familyId);
  const result: PublishFamilyResult = {
    familyId,
    converted: 0,
    skipped: 0,
    failed: [],
  };

  if (!(await pathExists(sourceDir))) {
    log?.(`no source directory for ${familyId}, skipping publish`);
    return result;
  }

  const names = await readdir(sourceDir);
  const sourceFiles = names
    .filter((name) => SUPPORTED_SOURCE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort();

  for (const [index, name] of sourceFiles.entries()) {
    const slotName = path.parse(name).name;
    const slotNumber = parseInt(slotName, 10);
    if (!Number.isFinite(slotNumber)) {
      continue;
    }

    log?.(`publishing ${index + 1}/${sourceFiles.length} for ${familyId}`);
    const sourcePath = path.join(sourceDir, name);
    try {
      const outcome = await publishSourceImage({
        familyId,
        sourcePath,
        slotNumber,
        quality,
        force,
        log,
      });
      if (outcome === 'converted') {
        result.converted += 1;
      } else {
        result.skipped += 1;
      }
    } catch (error) {
      result.failed.push({
        sourcePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

export async function buildQuizInventory(): Promise<QuizImageInventory> {
  const inventory: QuizImageInventory = {};
  if (!(await pathExists(PUBLIC_ASSET_ROOT))) {
    return inventory;
  }

  const families = (await readdir(PUBLIC_ASSET_ROOT)).sort();
  for (const familyId of families) {
    const familyDir = path.join(PUBLIC_ASSET_ROOT, familyId);
    const familyStat = await stat(familyDir).catch(() => null);
    if (!familyStat?.isDirectory()) {
      continue;
    }

    const assets = (await readdir(familyDir))
      .map((name) => {
        const parsed = path.parse(name);
        const number = parseInt(parsed.name, 10);
        const format = parsed.ext.replace('.', '').toLowerCase();
        if (!Number.isFinite(number)) return null;
        if (format !== 'webp') return null;
        return {
          number,
          format: format as QuizImageAsset['format'],
        };
      })
      .filter((value): value is QuizImageAsset => value !== null)
      .sort((a, b) => a.number - b.number || a.format.localeCompare(b.format));

    inventory[familyId] = assets;
  }

  return inventory;
}

export async function writeQuizInventory(log?: (message: string) => void): Promise<QuizImageInventory> {
  const inventory = await buildQuizInventory();
  await mkdir(path.dirname(QUIZ_INVENTORY_PATH), { recursive: true });
  await writeFile(QUIZ_INVENTORY_PATH, `${JSON.stringify(inventory, null, 2)}\n`);
  log?.(`updated ${toRepoRelative(QUIZ_INVENTORY_PATH)}`);
  return inventory;
}
