package jobs

import "testing"

func TestExtractInitialFlightsFromHTML(t *testing.T) {
	html := `prefix initialFlights [{\"id\":\"f1\",\"city\":\"Amsterdam\",\"status\":[{\"type\":\"scheduled\"}],\"originalTime\":{\"text\":\"10:00\",\"style\":\"muted\"},\"newTime\":{\"text\":\"10:05\",\"style\":\"bold\"},\"airline\":{\"id\":\"klm\",\"iata\":\"KL\",\"name\":\"KLM\"},\"flightNumber\":\"KL123\",\"departure\":{\"iata\":\"LHR\"},\"arrival\":{\"iata\":\"AMS\"},\"secondaryCorner\":\"T1\",\"slug\":\"test\"}], suffix`
	rows, err := extractInitialFlightsFromHTML(html)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(rows))
	}
	if rows[0].FlightNumber != "KL123" {
		t.Fatalf("unexpected flight number: %s", rows[0].FlightNumber)
	}
}
