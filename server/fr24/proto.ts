import protobuf from 'protobufjs';

// ── TypeScript Interfaces ──────────────────────────────────────────────

export interface BoundingBox {
  north: number;
  south: number;
  west: number;
  east: number;
}

export interface LiveFeedFlight {
  flightId: number;
  lat: number;
  lon: number;
  track: number;
  alt: number;
  speed: number;
  icon: number;
  status: number;
  timestamp: number;
  onGround: boolean;
  callsign: string;
  source: number;
  extraInfo?: {
    flight?: string;
    reg?: string;
    route?: { from?: string; to?: string };
    type?: string;
    squawk?: number;
  };
}

export interface LiveFeedResponse {
  flights: LiveFeedFlight[];
}

// ── Protobuf Schema ────────────────────────────────────────────────────

const root = protobuf.Root.fromJSON({
  nested: {
    LocationBoundaries: {
      fields: {
        north: { type: 'float', id: 1 },
        south: { type: 'float', id: 2 },
        west: { type: 'float', id: 3 },
        east: { type: 'float', id: 4 },
      },
    },
    VisibilitySettings: {
      fields: {
        sourcesList: { rule: 'repeated', type: 'int32', id: 1, options: { packed: true } },
        servicesList: { rule: 'repeated', type: 'int32', id: 2, options: { packed: true } },
        trafficType: { type: 'int32', id: 3 },
        onlyRestricted: { type: 'bool', id: 4 },
      },
    },
    FieldMask: {
      fields: {
        pathsList: { rule: 'repeated', type: 'string', id: 1 },
      },
    },
    LiveFeedRequest: {
      fields: {
        bounds: { type: 'LocationBoundaries', id: 1 },
        settings: { type: 'VisibilitySettings', id: 2 },
        limit: { type: 'int32', id: 5 },
        maxage: { type: 'int32', id: 6 },
        restrictionMode: { type: 'int32', id: 7 },
        fieldMask: { type: 'FieldMask', id: 8 },
      },
    },
    Route: {
      fields: {
        from: { type: 'string', id: 1 },
        to: { type: 'string', id: 2 },
      },
    },
    ExtraFlightInfo: {
      fields: {
        flight: { type: 'string', id: 1 },
        reg: { type: 'string', id: 2 },
        route: { type: 'Route', id: 3 },
        type: { type: 'string', id: 4 },
        squawk: { type: 'int32', id: 5 },
      },
    },
    Flight: {
      fields: {
        flightId: { type: 'uint32', id: 1 },
        lat: { type: 'float', id: 2 },
        lon: { type: 'float', id: 3 },
        track: { type: 'int32', id: 4 },
        alt: { type: 'int32', id: 5 },
        speed: { type: 'int32', id: 6 },
        icon: { type: 'int32', id: 7 },
        status: { type: 'int32', id: 8 },
        timestamp: { type: 'int32', id: 9 },
        onGround: { type: 'bool', id: 10 },
        callsign: { type: 'string', id: 11 },
        source: { type: 'int32', id: 12 },
        extraInfo: { type: 'ExtraFlightInfo', id: 13 },
      },
    },
    LiveFeedResponse: {
      fields: {
        flightsList: { rule: 'repeated', type: 'Flight', id: 1 },
        serverTimeMs: { type: 'int64', id: 4 },
      },
    },
  },
});

const LiveFeedRequestType = root.lookupType('LiveFeedRequest');
const LiveFeedResponseType = root.lookupType('LiveFeedResponse');

// ── Encoder ────────────────────────────────────────────────────────────

export function encodeLiveFeedRequest(
  bounds: BoundingBox,
  limit = 1500,
  maxage = 14400,
): Uint8Array {
  const message = LiveFeedRequestType.create({
    bounds: {
      north: bounds.north,
      south: bounds.south,
      west: bounds.west,
      east: bounds.east,
    },
    settings: {
      sourcesList: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      servicesList: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      trafficType: 3,
      onlyRestricted: false,
    },
    limit,
    maxage,
    restrictionMode: 0,
    fieldMask: {
      pathsList: ['flight', 'reg', 'route', 'type'],
    },
  });

  const payload = LiveFeedRequestType.encode(message).finish();

  // gRPC-Web frame: 1 byte compression flag + 4 bytes big-endian length + payload
  const frame = new Uint8Array(5 + payload.length);
  frame[0] = 0; // no compression
  const view = new DataView(frame.buffer);
  view.setUint32(1, payload.length, false); // big-endian
  frame.set(payload, 5);

  return frame;
}

// ── Decoder ────────────────────────────────────────────────────────────

export function decodeLiveFeedResponse(responseBytes: Uint8Array): LiveFeedResponse {
  // Parse gRPC-Web frame: skip 5-byte header (1 byte flag + 4 bytes length)
  if (responseBytes.length < 5) {
    return { flights: [] };
  }

  const view = new DataView(responseBytes.buffer, responseBytes.byteOffset, responseBytes.byteLength);
  const payloadLength = view.getUint32(1, false); // big-endian
  const payload = responseBytes.slice(5, 5 + payloadLength);

  const decoded = LiveFeedResponseType.decode(payload) as unknown as {
    flightsList?: Array<{
      flightId: number;
      lat: number;
      lon: number;
      track: number;
      alt: number;
      speed: number;
      icon: number;
      status: number;
      timestamp: number;
      onGround: boolean;
      callsign: string;
      source: number;
      extraInfo?: {
        flight?: string;
        reg?: string;
        route?: { from?: string; to?: string };
        type?: string;
        squawk?: number;
      };
    }>;
  };

  const flights: LiveFeedFlight[] = (decoded.flightsList ?? []).map((f) => ({
    flightId: f.flightId,
    lat: f.lat,
    lon: f.lon,
    track: f.track,
    alt: f.alt,
    speed: f.speed,
    icon: f.icon,
    status: f.status,
    timestamp: f.timestamp,
    onGround: f.onGround,
    callsign: f.callsign,
    source: f.source,
    extraInfo: f.extraInfo
      ? {
          flight: f.extraInfo.flight,
          reg: f.extraInfo.reg,
          route: f.extraInfo.route
            ? { from: f.extraInfo.route.from, to: f.extraInfo.route.to }
            : undefined,
          type: f.extraInfo.type,
          squawk: f.extraInfo.squawk,
        }
      : undefined,
  }));

  return { flights };
}
