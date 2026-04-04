'use client';

import { flushSync } from 'react-dom';

type DocumentWithViewTransition = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
  };
};

export function runViewTransition(update: () => void) {
  const documentWithTransition = document as DocumentWithViewTransition;
  if (documentWithTransition.startViewTransition) {
    return documentWithTransition.startViewTransition(() => {
      flushSync(() => {
        update();
      });
    });
  }

  update();
  return null;
}
