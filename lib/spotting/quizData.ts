import imageInventoryData from '@/data/spotting/image-inventory.json';

export interface QuizAircraft {
  id: string;
  name: string;
  category: string;
}

export type QuizImageFormat = 'webp' | 'jpg' | 'png';

export interface QuizImageAsset {
  number: number;
  format: QuizImageFormat;
}

export const QUIZ_AIRCRAFT: QuizAircraft[] = [
  // Wide Body
  { id: 'boeing-747', name: 'Boeing 747', category: 'Wide Body' },
  { id: 'boeing-777', name: 'Boeing 777', category: 'Wide Body' },
  { id: 'boeing-787', name: 'Boeing 787', category: 'Wide Body' },
  { id: 'airbus-a330', name: 'Airbus A330', category: 'Wide Body' },
  { id: 'airbus-a340', name: 'Airbus A340', category: 'Wide Body' },
  { id: 'airbus-a350', name: 'Airbus A350', category: 'Wide Body' },
  { id: 'airbus-a380', name: 'Airbus A380', category: 'Wide Body' },
  // Narrow Body
  { id: 'boeing-737', name: 'Boeing 737', category: 'Narrow Body' },
  { id: 'boeing-757', name: 'Boeing 757', category: 'Narrow Body' },
  { id: 'boeing-767', name: 'Boeing 767', category: 'Narrow Body' },
  { id: 'airbus-a320', name: 'Airbus A320 Family', category: 'Narrow Body' },
  // Regional
  { id: 'embraer-ejet', name: 'Embraer E-Jet', category: 'Regional' },
  { id: 'atr-72', name: 'ATR 72', category: 'Regional' },
  { id: 'dash-8', name: 'Dash 8 / Q400', category: 'Regional' },
  { id: 'bombardier-crj', name: 'Bombardier CRJ', category: 'Regional' },
];

function normalizeInventory(data: unknown): Record<string, readonly QuizImageAsset[]> {
  const inventory: Record<string, readonly QuizImageAsset[]> = {};
  if (!data || typeof data !== 'object') {
    return inventory;
  }

  for (const [familyId, value] of Object.entries(data)) {
    if (!Array.isArray(value)) {
      continue;
    }

    const assets = value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const number = (entry as { number?: unknown }).number;
        const format = (entry as { format?: unknown }).format;
        if (typeof number !== 'number') {
          return null;
        }
        if (format !== 'webp' && format !== 'jpg' && format !== 'png') {
          return null;
        }
        return { number, format } satisfies QuizImageAsset;
      })
      .filter((entry): entry is QuizImageAsset => entry !== null)
      .sort((a, b) => a.number - b.number || a.format.localeCompare(b.format));

    inventory[familyId] = assets;
  }

  return inventory;
}

const AIRCRAFT_IMAGE_ASSETS = normalizeInventory(imageInventoryData);

/** Get a random integer between min (inclusive) and max (exclusive). */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

/** 1-based image indices that exist for this type, sorted. */
export function getImageNumbers(aircraftId: string): number[] {
  return getImageAssets(aircraftId).map((image) => image.number);
}

export function getImageAssets(aircraftId: string): QuizImageAsset[] {
  return [...(AIRCRAFT_IMAGE_ASSETS[aircraftId] ?? [])];
}

export function getImageCount(aircraftId: string): number {
  return getImageAssets(aircraftId).length;
}

function quizAircraftWithImages(): QuizAircraft[] {
  return QUIZ_AIRCRAFT.filter((a) => getImageCount(a.id) > 0);
}

/** Asset URL for one basename + extension under public/assets/aircraft/{id}/. */
export function getImageUrl(
  aircraftId: string,
  imageNumber: number,
  format: QuizImageFormat = 'webp',
): string {
  const num = String(imageNumber).padStart(3, '0');
  return `/assets/aircraft/${aircraftId}/${num}.${format}`;
}

/** Preferred URL for a question (WebP first). */
export function getImagePath(
  aircraftId: string,
  imageNumber: number,
  format: QuizImageFormat = 'webp',
): string {
  return getImageUrl(aircraftId, imageNumber, format);
}

/** Shuffle an array in-place (Fisher-Yates) and return it. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface QuizQuestion {
  correctAircraft: QuizAircraft;
  image: QuizImageAsset;
  options: QuizAircraft[];
}

/** Generate a single quiz question with random aircraft, image, and 3 random wrong answers. */
export function generateQuestion(pool: QuizAircraft[] = quizAircraftWithImages()): QuizQuestion {
  if (pool.length === 0) {
    throw new Error('No aircraft images available for the quiz');
  }
  const correctIndex = randInt(0, pool.length);
  const correctAircraft = pool[correctIndex];
  const images = getImageAssets(correctAircraft.id);
  const image = images[randInt(0, images.length)]!;

  // Pick 3 random wrong answers
  const others = QUIZ_AIRCRAFT.filter((a) => a.id !== correctAircraft.id);
  const wrongAnswers = shuffle([...others]).slice(0, 3);

  // Combine and shuffle
  const options = shuffle([correctAircraft, ...wrongAnswers]);

  return { correctAircraft, image, options };
}

/** Generate a full round of 10 questions. */
export function generateRound(): QuizQuestion[] {
  const pool = quizAircraftWithImages();
  if (pool.length === 0) {
    return [];
  }
  return Array.from({ length: 10 }, () => generateQuestion(pool));
}
