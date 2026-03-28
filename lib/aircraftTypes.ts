export interface AircraftVariant {
  code: string;
  name: string;
}

export interface AircraftFamily {
  family: string;
  name: string;
  variants: AircraftVariant[];
}

export interface AircraftCategory {
  category: string;
  families: AircraftFamily[];
}

export interface AircraftFamilyInfo {
  family: string;
  name: string;
  category: string;
  variants: AircraftVariant[];
}

export const AIRCRAFT_TYPE_HIERARCHY: AircraftCategory[] = [
  {
    category: 'Wide Body',
    families: [
      {
        family: 'B747',
        name: 'Boeing 747',
        variants: [
          { code: 'B741', name: '747-100' },
          { code: 'B742', name: '747-200' },
          { code: 'B743', name: '747-300' },
          { code: 'B744', name: '747-400' },
          { code: 'B748', name: '747-8' },
        ],
      },
      {
        family: 'B777',
        name: 'Boeing 777',
        variants: [
          { code: 'B772', name: '777-200' },
          { code: 'B773', name: '777-300' },
          { code: 'B77W', name: '777-300ER' },
          { code: 'B77L', name: '777-200LR/F' },
        ],
      },
      {
        family: 'B787',
        name: 'Boeing 787',
        variants: [
          { code: 'B788', name: '787-8' },
          { code: 'B789', name: '787-9' },
          { code: 'B78X', name: '787-10' },
        ],
      },
      {
        family: 'A330',
        name: 'Airbus A330',
        variants: [
          { code: 'A332', name: 'A330-200' },
          { code: 'A333', name: 'A330-300' },
          { code: 'A338', name: 'A330-800neo' },
          { code: 'A339', name: 'A330-900neo' },
        ],
      },
      {
        family: 'A340',
        name: 'Airbus A340',
        variants: [
          { code: 'A342', name: 'A340-200' },
          { code: 'A343', name: 'A340-300' },
          { code: 'A345', name: 'A340-500' },
          { code: 'A346', name: 'A340-600' },
        ],
      },
      {
        family: 'A350',
        name: 'Airbus A350',
        variants: [
          { code: 'A359', name: 'A350-900' },
          { code: 'A35K', name: 'A350-1000' },
        ],
      },
      {
        family: 'A380',
        name: 'Airbus A380',
        variants: [{ code: 'A388', name: 'A380-800' }],
      },
    ],
  },
  {
    category: 'Narrow Body',
    families: [
      {
        family: 'B737',
        name: 'Boeing 737',
        variants: [
          { code: 'B731', name: '737-100' },
          { code: 'B732', name: '737-200' },
          { code: 'B733', name: '737-300' },
          { code: 'B734', name: '737-400' },
          { code: 'B735', name: '737-500' },
          { code: 'B736', name: '737-600' },
          { code: 'B737', name: '737-700' },
          { code: 'B738', name: '737-800' },
          { code: 'B739', name: '737-900' },
          { code: 'B37M', name: '737 MAX 7' },
          { code: 'B38M', name: '737 MAX 8' },
          { code: 'B39M', name: '737 MAX 9' },
        ],
      },
      {
        family: 'A320',
        name: 'Airbus A320 Family',
        variants: [
          { code: 'A318', name: 'A318' },
          { code: 'A319', name: 'A319' },
          { code: 'A320', name: 'A320' },
          { code: 'A321', name: 'A321' },
          { code: 'A20N', name: 'A320neo' },
          { code: 'A21N', name: 'A321neo' },
        ],
      },
      {
        family: 'B757',
        name: 'Boeing 757',
        variants: [
          { code: 'B752', name: '757-200' },
          { code: 'B753', name: '757-300' },
        ],
      },
      {
        family: 'E-Jet E2',
        name: 'Embraer E-Jet',
        variants: [
          { code: 'E190', name: 'E190' },
          { code: 'E195', name: 'E195' },
          { code: 'E290', name: 'E190-E2' },
          { code: 'E295', name: 'E195-E2' },
        ],
      },
    ],
  },
  {
    category: 'Regional',
    families: [
      {
        family: 'ATR',
        name: 'ATR',
        variants: [
          { code: 'AT43', name: 'ATR 42-300' },
          { code: 'AT45', name: 'ATR 42-500' },
          { code: 'AT46', name: 'ATR 42-600' },
          { code: 'AT72', name: 'ATR 72-200' },
          { code: 'AT75', name: 'ATR 72-500' },
          { code: 'AT76', name: 'ATR 72-600' },
        ],
      },
      {
        family: 'CRJ',
        name: 'Bombardier CRJ',
        variants: [
          { code: 'CRJ1', name: 'CRJ-100' },
          { code: 'CRJ2', name: 'CRJ-200' },
          { code: 'CRJ7', name: 'CRJ-700' },
          { code: 'CRJ9', name: 'CRJ-900' },
          { code: 'CRJX', name: 'CRJ-1000' },
        ],
      },
      {
        family: 'DHC8',
        name: 'De Havilland Dash 8',
        variants: [
          { code: 'DH8A', name: 'Dash 8-100' },
          { code: 'DH8B', name: 'Dash 8-200' },
          { code: 'DH8C', name: 'Dash 8-300' },
          { code: 'DH8D', name: 'Dash 8-400' },
        ],
      },
      {
        family: 'ERJ',
        name: 'Embraer ERJ',
        variants: [
          { code: 'E135', name: 'ERJ-135' },
          { code: 'E145', name: 'ERJ-145' },
          { code: 'E170', name: 'ERJ-170' },
          { code: 'E75S', name: 'ERJ-175 (short)' },
          { code: 'E75L', name: 'ERJ-175 (long)' },
        ],
      },
    ],
  },
  {
    category: 'General Aviation / Business',
    families: [
      {
        family: 'Cessna Piston',
        name: 'Cessna Piston',
        variants: [
          { code: 'C150', name: 'Cessna 150' },
          { code: 'C152', name: 'Cessna 152' },
          { code: 'C172', name: 'Cessna 172' },
          { code: 'C182', name: 'Cessna 182' },
          { code: 'C210', name: 'Cessna 210' },
        ],
      },
      {
        family: 'Cessna Utility',
        name: 'Cessna Utility/Cargo',
        variants: [
          { code: 'C208', name: 'Cessna 208 Caravan' },
          { code: 'C25A', name: 'Citation CJ2' },
          { code: 'C25B', name: 'Citation CJ3' },
          { code: 'C56X', name: 'Citation Excel' },
          { code: 'C680', name: 'Citation Sovereign' },
        ],
      },
      {
        family: 'Beechcraft',
        name: 'Beechcraft',
        variants: [
          { code: 'BE20', name: 'King Air 200' },
          { code: 'BE9L', name: 'King Air C90' },
          { code: 'BE36', name: 'Bonanza 36' },
          { code: 'BE58', name: 'Baron 58' },
        ],
      },
      {
        family: 'Gulfstream',
        name: 'Gulfstream',
        variants: [
          { code: 'GLF4', name: 'Gulfstream IV' },
          { code: 'GLF5', name: 'Gulfstream V' },
          { code: 'GLF6', name: 'Gulfstream G650' },
          { code: 'GLEX', name: 'Global Express' },
        ],
      },
      {
        family: 'Pilatus',
        name: 'Pilatus',
        variants: [
          { code: 'PC12', name: 'PC-12' },
          { code: 'PC24', name: 'PC-24' },
        ],
      },
    ],
  },
  {
    category: 'Cargo',
    families: [
      {
        family: 'B767',
        name: 'Boeing 767',
        variants: [
          { code: 'B762', name: '767-200' },
          { code: 'B763', name: '767-300' },
          { code: 'B764', name: '767-400' },
        ],
      },
      {
        family: 'MD-11',
        name: 'McDonnell Douglas MD-11',
        variants: [{ code: 'MD11', name: 'MD-11' }],
      },
      {
        family: 'AN-124',
        name: 'Antonov',
        variants: [
          { code: 'A124', name: 'AN-124 Ruslan' },
          { code: 'A225', name: 'AN-225 Mriya' },
        ],
      },
      {
        family: 'IL-76',
        name: 'Ilyushin',
        variants: [{ code: 'IL76', name: 'IL-76' }],
      },
    ],
  },
];

/** Get all ICAO type codes from the hierarchy as a flat array */
export function getAllTypeCodes(): string[] {
  const codes: string[] = [];
  for (const cat of AIRCRAFT_TYPE_HIERARCHY) {
    for (const fam of cat.families) {
      for (const v of fam.variants) {
        codes.push(v.code);
      }
    }
  }
  return codes;
}

/** Get all variant codes belonging to a family */
export function getCodesForFamily(familyId: string): string[] {
  for (const cat of AIRCRAFT_TYPE_HIERARCHY) {
    for (const fam of cat.families) {
      if (fam.family === familyId) {
        return fam.variants.map((v) => v.code);
      }
    }
  }
  return [];
}

/** Get all variant codes belonging to a category */
export function getCodesForCategory(categoryName: string): string[] {
  const codes: string[] = [];
  for (const cat of AIRCRAFT_TYPE_HIERARCHY) {
    if (cat.category === categoryName) {
      for (const fam of cat.families) {
        for (const v of fam.variants) {
          codes.push(v.code);
        }
      }
    }
  }
  return codes;
}

/** Look up the family/category metadata for an ICAO type code. */
export function getAircraftFamilyInfo(typeCode: string | null | undefined): AircraftFamilyInfo | null {
  if (!typeCode) return null;

  const upper = typeCode.toUpperCase().trim();

  for (const cat of AIRCRAFT_TYPE_HIERARCHY) {
    for (const fam of cat.families) {
      if (fam.variants.some((variant) => variant.code === upper)) {
        return {
          family: fam.family,
          name: fam.name,
          category: cat.category,
          variants: fam.variants,
        };
      }
    }
  }

  return null;
}

export interface SpottingOption {
  id: string;
  label: string;
  category: string;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Build multiple-choice spotting options for a given aircraft type code. */
export function getSpottingOptions(
  typeCode: string | null | undefined,
  totalOptions = 4,
): { correctOption: SpottingOption; options: SpottingOption[] } | null {
  if (!typeCode) return null;

  const familyInfo = getAircraftFamilyInfo(typeCode);
  const allFamilies: SpottingOption[] = AIRCRAFT_TYPE_HIERARCHY.flatMap((cat) =>
    cat.families.map((fam) => ({
      id: fam.family,
      label: fam.name,
      category: cat.category,
    })),
  );

  const correctOption: SpottingOption = familyInfo
    ? {
        id: familyInfo.family,
        label: familyInfo.name,
        category: familyInfo.category,
      }
    : {
        id: typeCode.toUpperCase().trim(),
        label: typeCode.toUpperCase().trim(),
        category: 'Unknown',
      };

  const sameCategory = allFamilies.filter(
    (family) => family.category === correctOption.category && family.id !== correctOption.id,
  );
  const otherCategories = allFamilies.filter((family) => family.id !== correctOption.id);

  const distractors: SpottingOption[] = [];
  for (const option of shuffle(sameCategory)) {
    if (distractors.length >= totalOptions - 1) break;
    distractors.push(option);
  }

  for (const option of shuffle(otherCategories)) {
    if (distractors.length >= totalOptions - 1) break;
    if (!distractors.some((existing) => existing.id === option.id)) {
      distractors.push(option);
    }
  }

  return {
    correctOption,
    options: shuffle([correctOption, ...distractors.slice(0, totalOptions - 1)]),
  };
}
