/** Shape of each arrival row embedded in Flighty's Next.js RSC HTML payload. */
export interface FlightyArrivalRow {
  id: string;
  city: string;
  status: Array<{ type: string; text?: string; icon?: string; style?: string }>;
  originalTime: { text: string; style: string };
  newTime: { text: string; style: string };
  secondaryCorner?: string;
  airline: { id: string; iata: string; name: string };
  flightNumber: string;
  departure: { iata: string; terminal?: string; gate?: string; flag?: string };
  arrival: { iata: string; terminal?: string; gate?: string; belt?: string; flag?: string };
}
