package shared

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"sync"
)

type Bounds struct {
	South float64 `json:"south"`
	West  float64 `json:"west"`
	North float64 `json:"north"`
	East  float64 `json:"east"`
}

type ReferenceAirport struct {
	Ident     string  `json:"ident"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type airportAreaConfig struct {
	ReferenceAirport ReferenceAirport `json:"referenceAirport"`
	ReferenceBounds  Bounds           `json:"referenceBounds"`
}

type BoundsOffset struct {
	South float64
	West  float64
	North float64
	East  float64
}

//go:embed airport-area.json
var airportAreaJSON []byte

var (
	airportAreaOnce   sync.Once
	airportAreaConfigValue airportAreaConfig
	airportAreaConfigErr   error
)

func loadAirportAreaConfig() (airportAreaConfig, error) {
	airportAreaOnce.Do(func() {
		airportAreaConfigErr = json.Unmarshal(airportAreaJSON, &airportAreaConfigValue)
		if airportAreaConfigErr != nil {
			airportAreaConfigErr = fmt.Errorf("decode airport area config: %w", airportAreaConfigErr)
		}
	})

	return airportAreaConfigValue, airportAreaConfigErr
}

func MustAirportAreaConfig() airportAreaConfig {
	cfg, err := loadAirportAreaConfig()
	if err != nil {
		panic(err)
	}
	return cfg
}

func AirportAreaOffset() BoundsOffset {
	cfg := MustAirportAreaConfig()
	return BoundsOffset{
		South: cfg.ReferenceAirport.Latitude - cfg.ReferenceBounds.South,
		West:  cfg.ReferenceAirport.Longitude - cfg.ReferenceBounds.West,
		North: cfg.ReferenceBounds.North - cfg.ReferenceAirport.Latitude,
		East:  cfg.ReferenceBounds.East - cfg.ReferenceAirport.Longitude,
	}
}

func BoundsForCoordinates(latitude, longitude float64) Bounds {
	offset := AirportAreaOffset()
	return Bounds{
		South: latitude - offset.South,
		West:  longitude - offset.West,
		North: latitude + offset.North,
		East:  longitude + offset.East,
	}
}
