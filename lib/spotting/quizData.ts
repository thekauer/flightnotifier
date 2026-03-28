export interface QuizAircraft {
  id: string;
  name: string;
  category: string;
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

/**
 * Image files live under public/assets/aircraft/{id}/ with zero-padded basenames.
 * Quiz URLs prefer 001.webp …; the UI falls back to .jpg per file when WebP is absent.
 * Use 0 for empty folders. Types with no images stay in QUIZ_AIRCRAFT as decoys only.
 * Aircraft `id` must match the folder name (e.g. airbus-a320, dash-8 — not legacy aliases).
 */
const AIRCRAFT_IMAGE_RANGE_MAX: Record<string, number> = {
  'boeing-747': 0,
  'boeing-777': 0,
  'boeing-787': 0,
  'airbus-a330': 0,
  'airbus-a340': 0,
  'airbus-a350': 0,
  'airbus-a380': 0,
  'boeing-737': 50,
  'boeing-757': 50,
  'boeing-767': 50,
  'airbus-a320': 50,
  'atr-72': 0,
  'dash-8': 0,
  'bombardier-crj': 0,
};

/** Non-contiguous filenames (e.g. only 007.jpg and 009.jpg on disk). */
const AIRCRAFT_IMAGE_NUMBERS: Partial<Record<string, number[]>> = {
  'embraer-ejet': [7, 9],
};

/** Get a random integer between min (inclusive) and max (exclusive). */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

/** 1-based image indices that exist for this type, sorted. */
export function getImageNumbers(aircraftId: string): number[] {
  const explicit = AIRCRAFT_IMAGE_NUMBERS[aircraftId];
  if (explicit) return explicit;
  const max = AIRCRAFT_IMAGE_RANGE_MAX[aircraftId] ?? 0;
  if (max <= 0) return [];
  return Array.from({ length: max }, (_, i) => i + 1);
}

export function getImageCount(aircraftId: string): number {
  return getImageNumbers(aircraftId).length;
}

/** Pick another existing image index for retries after a failed load. */
export function pickAlternateImageNumber(
  aircraftId: string,
  exclude: ReadonlySet<number>,
): number | null {
  const candidates = getImageNumbers(aircraftId).filter((n) => !exclude.has(n));
  if (candidates.length === 0) return null;
  return candidates[randInt(0, candidates.length)]!;
}

function quizAircraftWithImages(): QuizAircraft[] {
  return QUIZ_AIRCRAFT.filter((a) => getImageCount(a.id) > 0);
}

export type QuizImageFormat = 'webp' | 'jpg';

/** Primary quiz asset URL (WebP). Same basename may exist as .jpg until conversion. */
export function getImageUrl(
  aircraftId: string,
  imageNumber: number,
  format: QuizImageFormat = 'webp',
): string {
  const num = String(imageNumber).padStart(3, '0');
  return `/assets/aircraft/${aircraftId}/${num}.${format}`;
}

/** Preferred URL for a question (WebP first). */
export function getImagePath(aircraftId: string, imageNumber: number): string {
  return getImageUrl(aircraftId, imageNumber, 'webp');
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
  imageNumber: number;
  imagePath: string;
  options: QuizAircraft[];
}

/** Generate a single quiz question with random aircraft, image, and 3 random wrong answers. */
export function generateQuestion(): QuizQuestion {
  const pool = quizAircraftWithImages();
  if (pool.length === 0) {
    throw new Error('No aircraft images available for the quiz');
  }
  const correctIndex = randInt(0, pool.length);
  const correctAircraft = pool[correctIndex];
  const nums = getImageNumbers(correctAircraft.id);
  const imageNumber = nums[randInt(0, nums.length)]!;
  const imagePath = getImageUrl(correctAircraft.id, imageNumber, 'webp');

  // Pick 3 random wrong answers
  const others = QUIZ_AIRCRAFT.filter((a) => a.id !== correctAircraft.id);
  const wrongAnswers = shuffle([...others]).slice(0, 3);

  // Combine and shuffle
  const options = shuffle([correctAircraft, ...wrongAnswers]);

  return { correctAircraft, imageNumber, imagePath, options };
}

/** Generate a full round of 10 questions. */
export function generateRound(): QuizQuestion[] {
  return Array.from({ length: 10 }, () => generateQuestion());
}
