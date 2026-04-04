export interface SelectedRunwayRecord {
  airportIdent: string;
  key: string;
  leIdent: string;
  heIdent: string;
  coneKey?: string;
}

export function runwayMatchesSelection(
  runway: { key?: string; leIdent: string; heIdent: string },
  selectedRunways: SelectedRunwayRecord[],
) {
  return selectedRunways.some(
    (selected) =>
      (runway.key != null && selected.key === runway.key) ||
      (selected.leIdent === runway.leIdent && selected.heIdent === runway.heIdent) ||
      (selected.leIdent === runway.heIdent && selected.heIdent === runway.leIdent),
  );
}

export function coneMatchesSelection(
  cone: { key: string; runwayKey: string; leIdent: string; heIdent: string },
  selectedRunways: SelectedRunwayRecord[],
) {
  return selectedRunways.some((selected) => {
    if (selected.coneKey) {
      return selected.coneKey === cone.key;
    }

    return (
      selected.key === cone.runwayKey ||
      (selected.leIdent === cone.leIdent && selected.heIdent === cone.heIdent) ||
      (selected.leIdent === cone.heIdent && selected.heIdent === cone.leIdent)
    );
  });
}
