import { useQuery } from '@tanstack/react-query';

interface ScheduledArrival {
  flightId: number;
  flightNumber: string;
  callsign: string;
  origin: string;
  aircraftType: string;
  registration: string;
  altitude: number;
  speed: number;
  distanceToAmsKm: number;
  estimatedMinutes: number;
  isOnRunway09: boolean;
}

function formatEta(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }
  return `${minutes} min`;
}

export function Timetable() {
  const { data: arrivals = [], isLoading } = useQuery<ScheduledArrival[]>({
    queryKey: ['schedule'],
    queryFn: async () => {
      const res = await fetch('/api/schedule');
      if (!res.ok) throw new Error('Failed to fetch schedule');
      return res.json();
    },
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading schedule...</p>;
  }

  if (arrivals.length === 0) {
    return <p className="text-sm text-muted-foreground">No inbound AMS arrivals</p>;
  }

  return (
    <div className="max-h-[400px] overflow-auto rounded border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Flight</th>
            <th className="px-3 py-2 text-left font-medium">Origin</th>
            <th className="px-3 py-2 text-left font-medium">Type</th>
            <th className="px-3 py-2 text-right font-medium">Distance (km)</th>
            <th className="px-3 py-2 text-right font-medium">ETA</th>
            <th className="px-3 py-2 text-center font-medium">RWY 09</th>
          </tr>
        </thead>
        <tbody>
          {arrivals.map((a) => (
            <tr
              key={a.flightId}
              className={a.isOnRunway09 ? 'bg-green-50 dark:bg-green-950' : ''}
            >
              <td className="px-3 py-1.5">{a.flightNumber || a.callsign}</td>
              <td className="px-3 py-1.5">{a.origin}</td>
              <td className="px-3 py-1.5">{a.aircraftType}</td>
              <td className="px-3 py-1.5 text-right">{a.distanceToAmsKm}</td>
              <td className="px-3 py-1.5 text-right">{formatEta(a.estimatedMinutes)}</td>
              <td className="px-3 py-1.5 text-center">
                {a.isOnRunway09 ? <span className="text-green-600">&#10003;</span> : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
