package jobs

import "testing"

func TestAdsbLolBoundsForAirportMatchesAmsterdamReference(t *testing.T) {
	bounds := adsblolBoundsForAirport(adsblolAirports[0])

	if bounds.LAMin != approachBounds.LAMin {
		t.Fatalf("expected Amsterdam south bound %v, got %v", approachBounds.LAMin, bounds.LAMin)
	}
	if bounds.LOMin != approachBounds.LOMin {
		t.Fatalf("expected Amsterdam west bound %v, got %v", approachBounds.LOMin, bounds.LOMin)
	}
	if bounds.LAMax != approachBounds.LAMax {
		t.Fatalf("expected Amsterdam north bound %v, got %v", approachBounds.LAMax, bounds.LAMax)
	}
	if bounds.LOMax != approachBounds.LOMax {
		t.Fatalf("expected Amsterdam east bound %v, got %v", approachBounds.LOMax, bounds.LOMax)
	}
}

func TestFilterAdsbLolAircraftUsesBoundingBox(t *testing.T) {
	bounds := adsblolBoundsForAirport(adsblolAirports[1])
	aircraft := []map[string]interface{}{
		{"hex": "inside", "lat": adsblolAirports[1].Latitude, "lon": adsblolAirports[1].Longitude},
		{"hex": "north", "lat": bounds.LAMax + 0.01, "lon": adsblolAirports[1].Longitude},
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
