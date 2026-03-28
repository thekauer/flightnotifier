'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  generateRound,
  getImagePath,
  type QuizQuestion,
} from '@/lib/spotting/quizData';
import { cn } from '@/lib/utils';

function QuizQuestionImage({
  src,
}: {
  src: string;
}) {
  const [unavailable, setUnavailable] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  function handleImageError() {
    if (unavailable) return;
    setImgLoaded(false);
    setUnavailable(true);
  }

  if (unavailable) {
    return (
      <div className="flex h-80 w-full flex-col items-center justify-center gap-2 bg-muted px-6 text-center text-muted-foreground">
        <span className="text-sm font-medium">Image unavailable</span>
        <span className="text-xs max-w-sm">
          The photo could not be loaded. Pick the best match from the choices below.
        </span>
      </div>
    );
  }

  const imgClass = cn(
    'object-cover transition-opacity duration-200',
    imgLoaded ? 'opacity-100' : 'opacity-0',
  );

  return (
    <div className="relative h-80 w-full bg-muted">
      <Image
        key={src}
        src={src}
        alt="Identify this aircraft"
        fill
        sizes="(min-width: 1024px) 768px, 100vw"
        priority
        onLoad={() => setImgLoaded(true)}
        onError={() => handleImageError()}
        className={imgClass}
      />
    </div>
  );
}

type AnswerState = {
  selectedId: string;
  isCorrect: boolean;
} | null;

interface GameState {
  questions: QuizQuestion[];
  currentIndex: number;
  score: number;
  answerState: AnswerState;
}

function createNewGame(): GameState {
  return {
    questions: generateRound(),
    currentIndex: 0,
    score: 0,
    answerState: null,
  };
}

export function SpottingQuiz() {
  const [game, setGame] = useState<GameState>(createNewGame);

  const { questions, currentIndex, score, answerState } = game;
  const hasQuestions = questions.length > 0;
  if (!hasQuestions) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight">No spotting images loaded yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add aircraft photos to `public/assets/aircraft` and register them in the quiz image inventory
            before starting the spotting quiz.
          </p>
        </div>
      </div>
    );
  }

  const isFinished = currentIndex >= questions.length;
  const question = isFinished ? null : questions[currentIndex];

  function handleAnswer(selectedId: string) {
    if (answerState !== null || !question) return;
    const isCorrect = selectedId === question.correctAircraft.id;
    setGame((prev) => ({
      ...prev,
      score: isCorrect ? prev.score + 1 : prev.score,
      answerState: { selectedId, isCorrect },
    }));
  }

  function handleNext() {
    setGame((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex + 1,
      answerState: null,
    }));
  }

  function handleNewGame() {
    setGame(createNewGame());
  }

  // --- Finished screen ---
  if (isFinished) {
    const pct = Math.round((score / questions.length) * 100);
    let message = 'Keep practicing!';
    if (pct >= 90) message = 'Outstanding spotter!';
    else if (pct >= 70) message = 'Great job!';
    else if (pct >= 50) message = 'Not bad!';

    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 py-12">
        <div className="rounded-2xl border bg-card p-10 text-center shadow-sm w-full">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Quiz Complete</h2>
          <p className="text-5xl font-extrabold tracking-tight mt-4 mb-1">
            {score}/{questions.length}
          </p>
          <p className="text-lg text-muted-foreground mb-6">{message}</p>
          <button
            onClick={handleNewGame}
            className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // --- Question screen ---
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {/* Header: question counter + score */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Question {currentIndex + 1}/{questions.length}
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          Score: {score}/{currentIndex + (answerState ? 1 : 0)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${((currentIndex + (answerState ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>

      {/* Image card */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <QuizQuestionImage
          key={currentIndex}
          src={getImagePath(
            question!.correctAircraft.id,
            question!.image.number,
            question!.image.format,
          )}
        />
      </div>

      {/* Answer options */}
      <div className="grid grid-cols-2 gap-3">
        {question!.options.map((option) => {
          let btnClass =
            'rounded-xl border px-4 py-3.5 text-sm font-medium transition-all duration-200 text-left ';

          if (answerState) {
            if (option.id === question!.correctAircraft.id) {
              // Correct answer: green
              btnClass +=
                'border-green-500 bg-green-500/15 text-green-700 dark:text-green-400 ring-1 ring-green-500/30';
            } else if (option.id === answerState.selectedId) {
              // Wrong selection: red
              btnClass +=
                'border-red-500 bg-red-500/15 text-red-700 dark:text-red-400 ring-1 ring-red-500/30';
            } else {
              // Unselected after answer
              btnClass += 'border-border bg-card text-muted-foreground opacity-50';
            }
          } else {
            // Not yet answered
            btnClass +=
              'border-border bg-card text-foreground hover:bg-secondary hover:border-foreground/20 cursor-pointer active:scale-[0.98]';
          }

          return (
            <button
              key={option.id}
              onClick={() => handleAnswer(option.id)}
              disabled={answerState !== null}
              className={btnClass}
            >
              {option.name}
              <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                {option.category}
              </span>
            </button>
          );
        })}
      </div>

      {/* Next button (shown after answering) */}
      {answerState && (
        <div className="flex justify-end">
          <button
            onClick={handleNext}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {currentIndex + 1 < questions.length ? 'Next' : 'See Results'}
          </button>
        </div>
      )}
    </div>
  );
}
