package jobs

import (
	"math"
	"testing"
)

func almostEqual(a, b float64) bool {
	return math.Abs(a-b) < 1e-6
}

func TestAdsbLolBoundsForAirportMatchesAmsterdamReference(t *testing.T) {
	eham := monitoredAirport{Ident: "EHAM", IATA: "AMS", Name: "Amsterdam Airport Schiphol", Latitude: 52.308601, Longitude: 4.76389, MetarStation: "EHAM"}
	airports := toAdsbLolAirports([]monitoredAirport{eham})
	bounds := adsblolBoundsForAirport(airports[0])

	if !almostEqual(bounds.LAMin, approachBounds.LAMin) {
		t.Fatalf("expected Amsterdam south bound %v, got %v", approachBounds.LAMin, bounds.LAMin)
	}
	if !almostEqual(bounds.LOMin, approachBounds.LOMin) {
		t.Fatalf("expected Amsterdam west bound %v, got %v", approachBounds.LOMin, bounds.LOMin)
	}
	if !almostEqual(bounds.LAMax, approachBounds.LAMax) {
		t.Fatalf("expected Amsterdam north bound %v, got %v", approachBounds.LAMax, bounds.LAMax)
	}
	if !almostEqual(bounds.LOMax, approachBounds.LOMax) {
		t.Fatalf("expected Amsterdam east bound %v, got %v", approachBounds.LOMax, bounds.LOMax)
	}
}

func TestFilterAdsbLolAircraftUsesBoundingBox(t *testing.T) {
	eham := monitoredAirport{Ident: "EHAM", IATA: "AMS", Name: "Amsterdam Airport Schiphol", Latitude: 52.308601, Longitude: 4.76389, MetarStation: "EHAM"}
	lhbp := monitoredAirport{Ident: "LHBP", IATA: "BUD", Name: "Budapest Liszt Ferenc International Airport", Latitude: 47.43018, Longitude: 19.262393, MetarStation: "LHBP"}
	airports := toAdsbLolAirports([]monitoredAirport{eham, lhbp})
	bounds := adsblolBoundsForAirport(airports[1])
	aircraft := []map[string]interface{}{
		{"hex": "inside", "lat": airports[1].Latitude, "lon": airports[1].Longitude},
		{"hex": "north", "lat": bounds.LAMax + 0.01, "lon": airports[1].Longitude},
		{"hex": "missing"},
	}

	filtered := filterAdsbLolAircraft(bounds, aircraft)
	if len(filtered) != 1 {
		t.Fatalf("expected 1 aircraft in bounds, got %d", len(filtered))
	}
	if filtered[0]["hex"] != "inside" {
		t.Fatalf("expected inside aircraft to remain, got %#v", filtered[0]["hex"])
	}
}
