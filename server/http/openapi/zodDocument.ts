type OpenApiPackages = {
  z: any;
  OpenAPIRegistry: any;
  OpenApiGeneratorV31: any;
  extendZodWithOpenApi: (zodInstance: any) => void;
};

async function importOptional(specifier: string): Promise<any | null> {
  try {
    const dynamicImport = new Function('modulePath', 'return import(modulePath);') as (
      modulePath: string,
    ) => Promise<any>;
    return await dynamicImport(specifier);
  } catch {
    return null;
  }
}

async function loadOpenApiPackages(): Promise<OpenApiPackages | null> {
  const [zodModule, openApiModule] = await Promise.all([
    importOptional('zod'),
    importOptional('@asteasolutions/zod-to-openapi'),
  ]);

  if (!zodModule || !openApiModule) {
    return null;
  }

  return {
    z: zodModule.z,
    OpenAPIRegistry: openApiModule.OpenAPIRegistry,
    OpenApiGeneratorV31: openApiModule.OpenApiGeneratorV31,
    extendZodWithOpenApi: openApiModule.extendZodWithOpenApi,
  };
}

export async function buildZodOpenApiDocument(baseUrl: string): Promise<object | null> {
  const packages = await loadOpenApiPackages();
  if (!packages) {
    return null;
  }

  const { z, OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } = packages;
  extendZodWithOpenApi(z);

  const registry = new OpenAPIRegistry();

  const ErrorSchema = z.object({
    error: z.string(),
  }).openapi('Error');

  const CloudLayerSchema = z.object({
    cover: z.string(),
    base: z.number(),
  }).openapi('CloudLayer');

  const WeatherSchema = z.object({
    raw: z.string(),
    station: z.string(),
    observationTime: z.number(),
    temp: z.number().nullable(),
    dewpoint: z.number().nullable(),
    windDirection: z.number().nullable(),
    windSpeed: z.number().nullable(),
    windGust: z.number().nullable(),
    visibility: z.number().nullable(),
    clouds: z.array(CloudLayerSchema),
    ceiling: z.number().nullable(),
    qnh: z.number().nullable(),
    flightCategory: z.enum(['VFR', 'MVFR', 'IFR', 'LIFR']),
    fetchedAt: z.number(),
  }).openapi('Weather');

  const FlightSchema = z.object({
    id: z.string(),
    callsign: z.string(),
    lat: z.number(),
    lon: z.number(),
    alt: z.number(),
    speed: z.number(),
    track: z.number(),
    verticalRate: z.number(),
    onGround: z.boolean(),
    timestamp: z.number(),
    aircraftType: z.string().nullable(),
    manufacturer: z.string().nullable(),
    registration: z.string().nullable(),
    owner: z.string().nullable(),
    originCountry: z.string(),
    origin: z.string().optional(),
    destination: z.string().optional(),
    route: z.string().optional(),
  }).openapi('Flight');

  const RunwayPredictionSchema = z.object({
    flightId: z.string(),
    callsign: z.string(),
    runway: z.enum(['09', '27']),
    probability: z.number(),
    confidence: z.enum(['high', 'medium', 'low']),
    signals: z.object({
      wind: z.number(),
      history: z.number(),
      timeOfDay: z.number(),
      activeConfig: z.number(),
    }),
    updatedAt: z.number(),
  }).openapi('RunwayPrediction');

  const FlightStateSchema = z.object({
    allFlights: z.array(FlightSchema),
    approachingFlights: z.array(FlightSchema),
    buitenveldertbaanActive: z.boolean(),
    lastUpdateMs: z.number(),
    weather: WeatherSchema.nullable().optional(),
    runwayPredictions: z.array(RunwayPredictionSchema).optional(),
  }).openapi('FlightState');

  const ScheduledArrivalSchema = z.object({
    id: z.string(),
    callsign: z.string(),
    aircraftType: z.string().nullable(),
    manufacturer: z.string().nullable(),
    registration: z.string().nullable(),
    owner: z.string().nullable(),
    originCountry: z.string(),
    origin: z.string().optional(),
    destination: z.string().optional(),
    route: z.string().optional(),
    altitude: z.number(),
    speed: z.number(),
    verticalRate: z.number(),
    distanceToAmsKm: z.number(),
    estimatedMinutes: z.number(),
    isBuitenveldertbaan: z.boolean(),
  }).openapi('ScheduledArrival');

  const HistoricalTrackPointSchema = z.object({
    time: z.number(),
    lat: z.number(),
    lon: z.number(),
    altitude: z.number().nullable(),
    heading: z.number().nullable(),
    onGround: z.boolean(),
  }).openapi('HistoricalTrackPoint');

  const HistoricalFlightPathSchema = z.object({
    icao24: z.string(),
    callsign: z.string(),
    firstSeen: z.number(),
    lastSeen: z.number(),
    origin: z.string().nullable(),
    destination: z.string().nullable(),
    interceptedCone: z.boolean(),
    path: z.array(HistoricalTrackPointSchema),
  }).openapi('HistoricalFlightPath');

  const VisibilityPredictionSchema = z.object({
    flightId: z.string(),
    callsign: z.string(),
    aircraftType: z.string().nullable(),
    origin: z.string().optional(),
    secondsUntilZoneEntry: z.number(),
    predictedEntryTime: z.number(),
    predictedAltitudeAtEntry: z.number(),
    predictedVisibility: z.enum(['visible', 'partially_visible', 'obscured']),
    currentDistanceKm: z.number(),
    currentAltitude: z.number(),
    minutesToLanding: z.number(),
    confidence: z.enum(['high', 'medium', 'low']),
    updatedAt: z.number(),
  }).openapi('VisibilityPrediction');

  const LatLngSchema = z.tuple([z.number(), z.number()]);
  const ConeGeometrySchema = z.object({
    cone27: z.array(LatLngSchema),
    threshold27: LatLngSchema,
    cone: z.array(LatLngSchema),
    threshold: LatLngSchema,
  }).openapi('ConeGeometry');

  const HealthSchema = z.object({
    status: z.literal('ok'),
    timestamp: z.string(),
  }).openapi('Health');

  const HorizonQuerySchema = z.object({
    horizon: z.coerce.number().int().min(1).max(1440).optional(),
  });

  const ZoneQuerySchema = z.object({
    south: z.coerce.number(),
    west: z.coerce.number(),
    north: z.coerce.number(),
    east: z.coerce.number(),
  });

  registry.registerPath({
    method: 'get',
    path: '/api/health',
    tags: ['Health'],
    summary: 'Health check',
    responses: {
      200: {
        description: 'Service health',
        content: {
          'application/json': {
            schema: HealthSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/cone',
    tags: ['Geometry'],
    summary: 'Approach cone geometry',
    responses: {
      200: {
        description: 'Approach cone and threshold geometry',
        content: {
          'application/json': {
            schema: ConeGeometrySchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/state',
    tags: ['State'],
    summary: 'Current live flight state',
    responses: {
      200: {
        description: 'Current live state',
        content: {
          'application/json': {
            schema: FlightStateSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/schedule',
    tags: ['Schedule'],
    summary: 'Current AMS arrival schedule',
    request: {
      query: HorizonQuerySchema,
    },
    responses: {
      200: {
        description: 'Scheduled arrivals',
        content: {
          'application/json': {
            schema: z.array(ScheduledArrivalSchema),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/weather',
    tags: ['Weather'],
    summary: 'Latest cached METAR',
    responses: {
      200: {
        description: 'Latest weather snapshot',
        content: {
          'application/json': {
            schema: WeatherSchema.nullable(),
          },
        },
      },
      502: {
        description: 'Weather fetch failed',
        content: {
          'application/json': {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/runway-predictions',
    tags: ['State'],
    summary: 'Current runway predictions',
    responses: {
      200: {
        description: 'Current runway predictions',
        content: {
          'application/json': {
            schema: z.array(RunwayPredictionSchema),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/visibility-predictions',
    tags: ['State'],
    summary: 'Current visibility predictions',
    request: {
      query: ZoneQuerySchema,
    },
    responses: {
      200: {
        description: 'Current visibility predictions',
        content: {
          'application/json': {
            schema: z.array(VisibilityPredictionSchema),
          },
        },
      },
      400: {
        description: 'Missing or invalid zone bounds',
        content: {
          'application/json': {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/flight-history',
    tags: ['History'],
    summary: 'Historical flight paths for a callsign',
    request: {
      query: z.object({
        callsign: z.string(),
        origin: z.string().optional(),
        destination: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Historical approach paths',
        content: {
          'application/json': {
            schema: z.array(HistoricalFlightPathSchema),
          },
        },
      },
      400: {
        description: 'Missing callsign parameter',
        content: {
          'application/json': {
            schema: ErrorSchema,
          },
        },
      },
      500: {
        description: 'Failed to fetch flight history',
        content: {
          'application/json': {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const SseSchema = z.string().openapi({
    example: 'data: {"type":"flights_updated"}\\n\\n',
  });

  registry.registerPath({
    method: 'get',
    path: '/api/events',
    tags: ['Events'],
    summary: 'Combined live event stream',
    description:
      'Single SSE endpoint that emits flight, runway, visibility, schedule, and weather updates.',
    request: {
      query: ZoneQuerySchema.partial(),
    },
    responses: {
      200: {
        description: 'Server-Sent Events stream',
        content: {
          'text/event-stream': {
            schema: SseSchema,
          },
        },
      },
    },
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
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
  });
}
