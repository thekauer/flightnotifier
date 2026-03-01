import { encodeLiveFeedRequest, decodeLiveFeedResponse, type BoundingBox, type LiveFeedFlight } from './proto.js';

const FR24_ENDPOINT = 'https://data-feed.flightradar24.com/fr24.feed.api.v1.Feed/LiveFeed';
const POLL_INTERVAL_MS = 8000;
const DEVICE_ID = `web-flightnotifier-${Math.random().toString(36).slice(2, 10)}`;

export type FlightUpdateCallback = (flights: LiveFeedFlight[]) => void;

export class FR24Poller {
  private bounds: BoundingBox;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onUpdate: FlightUpdateCallback;

  constructor(bounds: BoundingBox, onUpdate: FlightUpdateCallback) {
    this.bounds = bounds;
    this.onUpdate = onUpdate;
  }

  start(): void {
    console.log('[FR24 Poller] Starting, polling every', POLL_INTERVAL_MS / 1000, 'seconds');
    this.poll();
    this.intervalId = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const body = encodeLiveFeedRequest(this.bounds);
      const response = await fetch(FR24_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/grpc-web+proto',
          'x-grpc-web': '1',
          'x-user-agent': 'grpc-web-javascript/0.1',
          'fr24-platform': 'web-26.056.1412',
          'fr24-device-id': DEVICE_ID,
          'accept-encoding': 'identity',
          'x-envoy-retry-grpc-on': 'unavailable',
        },
        body: Buffer.from(body),
      });

      const grpcStatus = response.headers.get('grpc-status');
      if (grpcStatus && grpcStatus !== '0') {
        const msg = response.headers.get('grpc-message') || 'unknown';
        console.error(`[FR24 Poller] gRPC error ${grpcStatus}: ${msg}`);
        return;
      }

      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const result = decodeLiveFeedResponse(bytes);
      this.onUpdate(result.flights);
    } catch (error) {
      console.error('[FR24 Poller] Poll failed:', error);
    }
  }
}
