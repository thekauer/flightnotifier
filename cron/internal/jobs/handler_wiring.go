package jobs

import "context"

func RunByName(name string) func(context.Context) (any, error) {
	switch name {
	case "adsblol":
		return RunAdsbLol
	case "opensky":
		return RunOpenSky
	case "metar":
		return RunMetar
	case "flighty":
		return RunFlighty
	case "adsbdb":
		return RunAdsbdb
	case "tracks":
		return RunTracks
	default:
		return func(context.Context) (any, error) {
			return map[string]string{"message": "unknown job"}, nil
		}
	}
}
