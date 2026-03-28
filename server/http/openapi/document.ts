import { buildZodOpenApiDocument } from './zodDocument';

function jsonResponse(schema: object, description = 'OK', example?: unknown) {
  return {
    description,
    content: {
      'application/json': {
        schema,
        ...(example === undefined ? {} : { example }),
      },
    },
  };
}

function sseResponse(example: string, description = 'Server-Sent Events stream') {
  return {
    description,
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
        },
        example,
      },
    },
  };
}

const errorSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: { type: 'string' },
  },
};

const flightSchema = {
  type: 'object',
  required: [
    'id',
    'callsign',
    'lat',
    'lon',
    'alt',
    'speed',
    'track',
    'verticalRate',
    'onGround',
    'timestamp',
    'aircraftType',
    'manufacturer',
    'registration',
    'owner',
    'originCountry',
  ],
  properties: {
    id: { type: 'string' },
    callsign: { type: 'string' },
    lat: { type: 'number' },
    lon: { type: 'number' },
    alt: { type: 'number' },
    speed: { type: 'number' },
    track: { type: 'number' },
    verticalRate: { type: 'number' },
    onGround: { type: 'boolean' },
    timestamp: { type: 'number' },
    aircraftType: { type: ['string', 'null'] },
    manufacturer: { type: ['string', 'null'] },
    registration: { type: ['string', 'null'] },
    owner: { type: ['string', 'null'] },
    originCountry: { type: 'string' },
    origin: { type: 'string' },
    destination: { type: 'string' },
    route: { type: 'string' },
  },
};

const runwayPredictionSchema = {
  type: 'object',
  required: ['flightId', 'callsign', 'runway', 'probability', 'confidence', 'signals', 'updatedAt'],
  properties: {
    flightId: { type: 'string' },
    callsign: { type: 'string' },
    runway: { type: 'string', enum: ['09', '27'] },
    probability: { type: 'number' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    signals: {
      type: 'object',
      required: ['wind', 'history', 'timeOfDay', 'activeConfig'],
      properties: {
        wind: { type: 'number' },
        history: { type: 'number' },
        timeOfDay: { type: 'number' },
        activeConfig: { type: 'number' },
      },
    },
    updatedAt: { type: 'number' },
  },
};

const weatherSchema = {
  type: 'object',
  required: [
    'raw',
    'station',
    'observationTime',
    'temp',
    'dewpoint',
    'windDirection',
    'windSpeed',
    'windGust',
    'visibility',
    'clouds',
    'ceiling',
    'qnh',
    'flightCategory',
    'fetchedAt',
  ],
  properties: {
    raw: { type: 'string' },
    station: { type: 'string' },
    observationTime: { type: 'number' },
    temp: { type: ['number', 'null'] },
    dewpoint: { type: ['number', 'null'] },
    windDirection: { type: ['number', 'null'] },
    windSpeed: { type: ['number', 'null'] },
    windGust: { type: ['number', 'null'] },
    visibility: { type: ['number', 'null'] },
    clouds: {
      type: 'array',
      items: {
        type: 'object',
        required: ['cover', 'base'],
        properties: {
          cover: { type: 'string' },
          base: { type: 'number' },
        },
      },
    },
    ceiling: { type: ['number', 'null'] },
    qnh: { type: ['number', 'null'] },
    flightCategory: { type: 'string', enum: ['VFR', 'MVFR', 'IFR', 'LIFR'] },
    fetchedAt: { type: 'number' },
  },
};

const flightStateSchema = {
  type: 'object',
  required: ['allFlights', 'approachingFlights', 'buitenveldertbaanActive', 'lastUpdateMs'],
  properties: {
    allFlights: {
      type: 'array',
      items: flightSchema,
    },
    approachingFlights: {
      type: 'array',
      items: flightSchema,
    },
    buitenveldertbaanActive: { type: 'boolean' },
    lastUpdateMs: { type: 'number' },
    weather: {
      oneOf: [weatherSchema, { type: 'null' }],
    },
    runwayPredictions: {
      type: 'array',
      items: runwayPredictionSchema,
    },
  },
};

const scheduledArrivalSchema = {
  type: 'object',
  required: [
    'id',
    'callsign',
    'aircraftType',
    'manufacturer',
    'registration',
    'owner',
    'originCountry',
    'altitude',
    'speed',
    'verticalRate',
    'distanceToAmsKm',
    'estimatedMinutes',
    'isBuitenveldertbaan',
  ],
  properties: {
    id: { type: 'string' },
    callsign: { type: 'string' },
    aircraftType: { type: ['string', 'null'] },
    manufacturer: { type: ['string', 'null'] },
    registration: { type: ['string', 'null'] },
    owner: { type: ['string', 'null'] },
    originCountry: { type: 'string' },
    origin: { type: 'string' },
    destination: { type: 'string' },
    route: { type: 'string' },
    altitude: { type: 'number' },
    speed: { type: 'number' },
    verticalRate: { type: 'number' },
    distanceToAmsKm: { type: 'number' },
    estimatedMinutes: { type: 'number' },
    isBuitenveldertbaan: { type: 'boolean' },
  },
};

const historicalTrackPointSchema = {
  type: 'object',
  required: ['time', 'lat', 'lon', 'altitude', 'heading', 'onGround'],
  properties: {
    time: { type: 'number' },
    lat: { type: 'number' },
    lon: { type: 'number' },
    altitude: { type: ['number', 'null'] },
    heading: { type: ['number', 'null'] },
    onGround: { type: 'boolean' },
  },
};

const historicalFlightPathSchema = {
  type: 'object',
  required: [
    'icao24',
    'callsign',
    'firstSeen',
    'lastSeen',
    'origin',
    'destination',
    'interceptedCone',
    'path',
  ],
  properties: {
    icao24: { type: 'string' },
    callsign: { type: 'string' },
    firstSeen: { type: 'number' },
    lastSeen: { type: 'number' },
    origin: { type: ['string', 'null'] },
    destination: { type: ['string', 'null'] },
    interceptedCone: { type: 'boolean' },
    path: {
      type: 'array',
      items: historicalTrackPointSchema,
    },
  },
};

const visibilityPredictionSchema = {
  type: 'object',
  required: [
    'flightId',
    'callsign',
    'aircraftType',
    'secondsUntilZoneEntry',
    'predictedEntryTime',
    'predictedAltitudeAtEntry',
    'predictedVisibility',
    'currentDistanceKm',
    'currentAltitude',
    'minutesToLanding',
    'confidence',
    'updatedAt',
  ],
  properties: {
    flightId: { type: 'string' },
    callsign: { type: 'string' },
    aircraftType: { type: ['string', 'null'] },
    origin: { type: 'string' },
    secondsUntilZoneEntry: { type: 'number' },
    predictedEntryTime: { type: 'number' },
    predictedAltitudeAtEntry: { type: 'number' },
    predictedVisibility: { type: 'string', enum: ['visible', 'partially_visible', 'obscured'] },
    currentDistanceKm: { type: 'number' },
    currentAltitude: { type: 'number' },
    minutesToLanding: { type: 'number' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    updatedAt: { type: 'number' },
  },
};

const coneResponseSchema = {
  type: 'object',
  required: ['cone27', 'threshold27', 'cone', 'threshold'],
  properties: {
    cone27: {
      type: 'array',
      items: {
        type: 'array',
        items: { type: 'number' },
      },
    },
    threshold27: {
      type: 'array',
      items: { type: 'number' },
    },
    cone: {
      type: 'array',
      items: {
        type: 'array',
        items: { type: 'number' },
      },
    },
    threshold: {
      type: 'array',
      items: { type: 'number' },
    },
  },
};

export async function buildOpenApiDocument(baseUrl: string) {
  const zodDocument = await buildZodOpenApiDocument(baseUrl);
  if (zodDocument) {
    return zodDocument;
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Flight Notifier API',
      version: '0.1.0',
      description:
        'Code-first API document for Flight Notifier. JSON endpoints provide bootstrap/fallback data and dedicated SSE endpoints expose live updates per stream.',
    },
    servers: [
      {
        url: baseUrl,
      },
    ],
    tags: [
      { name: 'Health' },
      { name: 'Geometry' },
      { name: 'State' },
      { name: 'Schedule' },
      { name: 'Weather' },
      { name: 'History' },
      { name: 'Events' },
    ],
    paths: {
      '/api/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          responses: {
            200: jsonResponse(
              {
                type: 'object',
                required: ['status', 'timestamp'],
                properties: {
                  status: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
              'Service health',
            ),
          },
        },
      },
      '/api/cone': {
        get: {
          tags: ['Geometry'],
          summary: 'Approach cone geometry',
          responses: {
            200: jsonResponse(coneResponseSchema, 'Approach cone and threshold geometry'),
          },
        },
      },
      '/api/state': {
        get: {
          tags: ['State'],
          summary: 'Current live flight state',
          responses: {
            200: jsonResponse(flightStateSchema, 'Current live state'),
          },
        },
      },
      '/api/schedule': {
        get: {
          tags: ['Schedule'],
          summary: 'Current AMS arrival schedule',
          parameters: [
            {
              name: 'horizon',
              in: 'query',
              required: false,
              schema: { type: 'integer', minimum: 1, maximum: 1440 },
              description: 'Filter arrivals to those within N minutes.',
            },
          ],
          responses: {
            200: jsonResponse(
              {
                type: 'array',
                items: scheduledArrivalSchema,
              },
              'Scheduled arrivals',
            ),
          },
        },
      },
      '/api/weather': {
        get: {
          tags: ['Weather'],
          summary: 'Latest cached METAR',
          responses: {
            200: jsonResponse(
              {
                oneOf: [weatherSchema, { type: 'null' }],
              },
              'Latest weather snapshot',
            ),
            502: jsonResponse(errorSchema, 'Weather fetch failed'),
          },
        },
      },
      '/api/runway-predictions': {
        get: {
          tags: ['State'],
          summary: 'Current runway predictions',
          responses: {
            200: jsonResponse(
              {
                type: 'array',
                items: runwayPredictionSchema,
              },
              'Current runway predictions',
            ),
          },
        },
      },
      '/api/visibility-predictions': {
        get: {
          tags: ['State'],
          summary: 'Current visibility predictions',
          parameters: [
            { name: 'south', in: 'query', required: true, schema: { type: 'number' } },
            { name: 'west', in: 'query', required: true, schema: { type: 'number' } },
            { name: 'north', in: 'query', required: true, schema: { type: 'number' } },
            { name: 'east', in: 'query', required: true, schema: { type: 'number' } },
          ],
          responses: {
            200: jsonResponse(
              {
                type: 'array',
                items: visibilityPredictionSchema,
              },
              'Current visibility predictions',
            ),
            400: jsonResponse(errorSchema, 'Missing or invalid zone bounds'),
          },
        },
      },
      '/api/flight-history': {
        get: {
          tags: ['History'],
          summary: 'Historical flight paths for a callsign',
          parameters: [
            {
              name: 'callsign',
              in: 'query',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'origin',
              in: 'query',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: 'destination',
              in: 'query',
              required: false,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: jsonResponse(
              {
                type: 'array',
                items: historicalFlightPathSchema,
              },
              'Historical approach paths',
            ),
            400: jsonResponse(errorSchema, 'Missing callsign parameter'),
            500: jsonResponse(errorSchema, 'Failed to fetch flight history'),
          },
        },
      },
      '/api/events': {
        get: {
          tags: ['Events'],
          summary: 'Combined live event stream',
          description:
            'Single SSE endpoint that emits flight, runway, visibility, schedule, and weather updates.',
          parameters: [
            { name: 'south', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'west', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'north', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'east', in: 'query', required: false, schema: { type: 'number' } },
          ],
          responses: {
            200: sseResponse(
              'data: {"type":"flights_updated","state":{"allFlights":[],"approachingFlights":[],"buitenveldertbaanActive":false,"lastUpdateMs":0}}\n\n',
            ),
          },
        },
      },
    },
    components: {
      schemas: {
        Error: errorSchema,
        Flight: flightSchema,
        FlightState: flightStateSchema,
        ScheduledArrival: scheduledArrivalSchema,
        HistoricalFlightPath: historicalFlightPathSchema,
        RunwayPrediction: runwayPredictionSchema,
        VisibilityPrediction: visibilityPredictionSchema,
        Weather: weatherSchema,
      },
    },
  };
}
