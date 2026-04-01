'use client';

import { SpottingQuiz } from '@/components/SpottingQuiz';

export default function SpottingPage() {
  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Aircraft Spotting Quiz</h2>
        <p className="text-sm text-muted-foreground">Test your aircraft identification skills</p>
      </div>
      <SpottingQuiz />
    </main>
  );
}
