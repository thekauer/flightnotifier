import {
  getStateManager,
  getPoller,
  incrementSSEClients,
  decrementSSEClients,
} from '@/server/singleton';
import type { StateChangeEvent } from '@/server/state';

export const dynamic = 'force-dynamic';

export async function GET() {
  getPoller(); // ensure poller is started
  const stateManager = getStateManager();

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      incrementSSEClients();

      // Send current state immediately
      const currentState = stateManager.getState();
      const initEvent: StateChangeEvent = { type: 'flights_updated', state: currentState };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initEvent)}\n\n`));

      // Subscribe to future events
      unsubscribe = stateManager.onEvent((event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Client disconnected
        }
      });
    },
    cancel() {
      decrementSSEClients();
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
