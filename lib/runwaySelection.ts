export interface SelectedRunwayRecord {
  airportIdent: string;
  key: string;
  leIdent: string;
  heIdent: string;
  coneKey?: string;
}

export function getSelectedRunwayIdent(runway: SelectedRunwayRecord): string {
  if (runway.coneKey?.includes('-le-')) {
    return runway.leIdent;
  }

  if (runway.coneKey?.includes('-he-')) {
    return runway.heIdent;
  }

  return `${runway.leIdent}/${runway.heIdent}`;
}

export function formatSelectedRunwayLabel(runway: SelectedRunwayRecord): string {
  return `RWY ${getSelectedRunwayIdent(runway)}`;
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
