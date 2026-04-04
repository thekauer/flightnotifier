import { AIRCRAFT_TYPE_HIERARCHY, getAircraftFamilyInfo } from '@/lib/aircraftTypes';

export type AircraftSpottingTrait = {
  title: string;
  detail?: string;
  highlighted?: boolean;
};

export const AIRCRAFT_SPOTTING_TRAITS_BY_FAMILY: Record<string, AircraftSpottingTrait[]> = {
  B747: [
    { title: 'Upper deck', detail: 'Distinct hump ahead of the wing', highlighted: true },
    { title: 'Engines', detail: 'Four engines under the wings' },
    { title: 'Main gear', detail: 'Body gear plus wing gear' },
    { title: 'Nose', detail: 'Classic pointy Boeing nose' },
    { title: 'Tail', detail: 'Tall swept fin and cut tail cone' },
    { title: 'Wingtips', detail: 'Winglets only on later variants' },
  ],
  B777: [
    { title: 'Engines', detail: 'Two very large round turbofans' },
    { title: 'Cockpit windows', detail: 'V-shaped Boeing window line' },
    { title: 'Tail', detail: 'Cut-off tail cone', highlighted: true },
    { title: 'Main gear', detail: 'Three gear bogies tilted backward' },
    { title: 'Nose', detail: 'Pointy Boeing-style nose' },
    { title: 'Wingtips', detail: 'No wingtip fences or split tips' },
  ],
  B787: [
    { title: 'Engines', detail: 'Exhaust chevrons on nacelles', highlighted: true },
    { title: 'Cockpit windows', detail: 'Straight Airbus-like window line' },
    { title: 'Tail', detail: 'Rounded circular tail cone' },
    { title: 'Main gear', detail: 'Two gear bogies tilted backward' },
    { title: 'Nose', detail: 'Rounded nose profile' },
    { title: 'Wings', detail: 'Raked tips and flexible curved wing shape' },
  ],
  A330: [
    { title: 'Engines', detail: 'Two large turbofans under low wings' },
    { title: 'Cockpit windows', detail: 'Airbus window mask with cut corner' },
    { title: 'Main gear', detail: 'Two main bogies only' },
    { title: 'Tail', detail: 'Rounded Airbus tail cone' },
    { title: 'Nose', detail: 'Blunt rounded Airbus nose' },
    { title: 'Wingtips', detail: 'Wingtip fences or sharklets on neo', highlighted: true },
  ],
  A340: [
    { title: 'Engines', detail: 'Four engines, two per wing', highlighted: true },
    { title: 'Cockpit windows', detail: 'Airbus window mask with cut corner' },
    { title: 'Main gear', detail: 'Center body gear on longer variants' },
    { title: 'Tail', detail: 'Rounded Airbus tail cone' },
    { title: 'Nose', detail: 'Blunt rounded Airbus nose' },
    { title: 'Wingtips', detail: 'Tall Airbus wingtip fences' },
  ],
  A350: [
    { title: 'Cockpit windows', detail: 'Black raccoon-style cockpit mask', highlighted: true },
    { title: 'Engines', detail: 'Two large round turbofans' },
    { title: 'Tail', detail: 'Rounded Airbus tail cone' },
    { title: 'Main gear', detail: 'Four-wheel bogies, larger body stance' },
    { title: 'Nose', detail: 'Smooth rounded Airbus nose' },
    { title: 'Wings', detail: 'Long curved tips blended into the wing' },
  ],
  A380: [
    { title: 'Decks', detail: 'Full-length double deck fuselage', highlighted: true },
    { title: 'Engines', detail: 'Four engines under enormous wings' },
    { title: 'Main gear', detail: 'Many bogies and very wide stance' },
    { title: 'Cockpit windows', detail: 'Airbus window mask with cut corner' },
    { title: 'Nose', detail: 'Huge rounded nose and upper deck forehead' },
    { title: 'Wingtips', detail: 'Tall blended wingtip fences' },
  ],
  B737: [
    { title: 'Engines', detail: 'Flat-bottom nacelles on Classic/NG; MAX has chevrons' },
    { title: 'Cockpit windows', detail: 'V-shaped Boeing window line' },
    { title: 'Tail', detail: 'Dorsal fin extension at the tail root', highlighted: true },
    { title: 'Main gear', detail: 'Main wheels stay visible after retraction' },
    { title: 'Nose', detail: 'Pointier Boeing nose and large nose gear doors' },
    { title: 'Wingtips', detail: 'Plain tip, blended winglet, split-scimitar, or MAX AT winglet' },
  ],
  A320: [
    { title: 'Cockpit windows', detail: 'Airbus mask with a cut-off rear corner', highlighted: true },
    { title: 'Nose', detail: 'Rounded blunt Airbus nose' },
    { title: 'Main gear', detail: 'Smaller nose gear doors; gear leans slightly forward' },
    { title: 'Tail', detail: 'Rounded tail cone with small dorsal fin' },
    { title: 'Wingtips', detail: 'Wingtip fences or sharklets' },
    { title: 'Engines', detail: 'Round underwing nacelles, larger on neo' },
  ],
  B757: [
    { title: 'Fuselage', detail: 'Long narrow-body tube with tall stance', highlighted: true },
    { title: 'Cockpit windows', detail: 'V-shaped Boeing window line' },
    { title: 'Nose', detail: 'Sharp pointed Boeing nose' },
    { title: 'Main gear', detail: 'Tall landing gear and long gear legs' },
    { title: 'Tail', detail: 'Cut-off tail cone' },
    { title: 'Wings', detail: 'No fences, often appears slim and powerful' },
  ],
  'E-Jet E2': [
    { title: 'Engines', detail: 'Two underwing turbofans on a small narrow-body' },
    { title: 'Nose', detail: 'Rounded regional-jet nose' },
    { title: 'Tail', detail: 'Conventional tail, no T-tail' },
    { title: 'Main gear', detail: 'Low stance and compact body' },
    { title: 'Wingtips', detail: 'Raked or swept-up tips depending variant', highlighted: true },
    { title: 'Fuselage', detail: 'Shorter and stubbier than A320 or 737' },
  ],
  ATR: [
    { title: 'Engines', detail: 'Two turboprops with six-blade propellers', highlighted: true },
    { title: 'Wing', detail: 'High wing above the fuselage' },
    { title: 'Gear', detail: 'Main wheels tucked in fairings under the fuselage' },
    { title: 'Tail', detail: 'Conventional tail with slim fin' },
    { title: 'Nose', detail: 'Short rounded commuter nose' },
    { title: 'Cabin', detail: 'Tall narrow fuselage with rectangular windows' },
  ],
  CRJ: [
    { title: 'Engines', detail: 'Rear-mounted twin jet engines', highlighted: true },
    { title: 'Tail', detail: 'T-tail' },
    { title: 'Fuselage', detail: 'Very long slim tube for its width' },
    { title: 'Nose', detail: 'Pointed regional-jet nose' },
    { title: 'Wing', detail: 'Low straight wing with small winglets on later models' },
    { title: 'Gear', detail: 'Small close-set main gear' },
  ],
  DHC8: [
    { title: 'Engines', detail: 'Twin turboprops with large prop discs', highlighted: true },
    { title: 'Wing', detail: 'High wing and long nacelles' },
    { title: 'Tail', detail: 'T-tail on Dash 8 family' },
    { title: 'Gear', detail: 'Sturdy short landing gear' },
    { title: 'Nose', detail: 'Rounded stubby commuter nose' },
    { title: 'Cabin', detail: 'Tall narrow fuselage and large cabin windows' },
  ],
  ERJ: [
    { title: 'Engines', detail: 'Rear-mounted twin jet engines', highlighted: true },
    { title: 'Tail', detail: 'T-tail' },
    { title: 'Fuselage', detail: 'Very slim pencil-like fuselage' },
    { title: 'Nose', detail: 'Sharp pointed nose' },
    { title: 'Wing', detail: 'Small low wing with little sweep' },
    { title: 'Gear', detail: 'Compact landing gear and low body height' },
  ],
  'Cessna Piston': [
    { title: 'Engine', detail: 'Single piston propeller in the nose', highlighted: true },
    { title: 'Wing', detail: 'High wing on most common models like 150/152/172/182' },
    { title: 'Gear', detail: 'Fixed tricycle landing gear on training types' },
    { title: 'Tail', detail: 'Simple conventional tail' },
    { title: 'Cabin', detail: 'Small cabin and boxy windows' },
    { title: 'Fuselage', detail: 'Light aircraft proportions and strut-braced wing' },
  ],
  'Cessna Utility': [
    { title: 'Role', detail: 'Mix of utility prop and small business jets' },
    { title: 'Caravan', detail: 'High-wing single turboprop with fixed gear', highlighted: true },
    { title: 'Citation jets', detail: 'Low-wing twinjets with T-tail or swept tail' },
    { title: 'Nose', detail: 'Rounded business-jet or utility nose' },
    { title: 'Cabin', detail: 'Small fuselage with comparatively tall fin' },
    { title: 'Gear', detail: 'Compact gear and short wheelbase' },
  ],
  Beechcraft: [
    { title: 'Role', detail: 'Twin pistons and turboprops with compact fuselage' },
    { title: 'Tail', detail: 'Conventional tail, not a T-tail' },
    { title: 'Engines', detail: 'Nose propeller or twin prop layout', highlighted: true },
    { title: 'Cabin', detail: 'Square-window business or utility cabin' },
    { title: 'Gear', detail: 'Short sturdy landing gear' },
    { title: 'Wing', detail: 'Low wing on Baron/Bonanza, straight wing on King Air' },
  ],
  Gulfstream: [
    { title: 'Fuselage', detail: 'Long sleek business jet fuselage', highlighted: true },
    { title: 'Engines', detail: 'Two rear-mounted turbofans' },
    { title: 'Tail', detail: 'T-tail' },
    { title: 'Nose', detail: 'Very pointed elegant business-jet nose' },
    { title: 'Wing', detail: 'Swept low wing with long span' },
    { title: 'Windows', detail: 'Large oval cabin windows' },
  ],
  Pilatus: [
    { title: 'PC-12', detail: 'Single turboprop with tall T-tail', highlighted: true },
    { title: 'PC-24', detail: 'Compact twinjet with T-tail' },
    { title: 'Wing', detail: 'Straight practical wing optimized for short fields' },
    { title: 'Gear', detail: 'Sturdy landing gear for rough-field look' },
    { title: 'Fuselage', detail: 'Utility-style body with big cabin section' },
    { title: 'Nose', detail: 'Short rounded Swiss utility nose' },
  ],
  B767: [
    { title: 'Engines', detail: 'Two large turbofans on a mid-size widebody' },
    { title: 'Cockpit windows', detail: 'V-shaped Boeing window line' },
    { title: 'Main gear', detail: 'Two main bogies only' },
    { title: 'Tail', detail: 'Cut-off tail cone' },
    { title: 'Nose', detail: 'Pointy Boeing nose' },
    { title: 'Wingtips', detail: 'Raked tip only on 767-400', highlighted: true },
  ],
  'MD-11': [
    { title: 'Engines', detail: 'Three engines with one in the tail', highlighted: true },
    { title: 'Tail', detail: 'Tall fin feeding the tail engine' },
    { title: 'Cockpit', detail: 'Classic Douglas cockpit shape' },
    { title: 'Main gear', detail: 'Widebody stance with centerline gear' },
    { title: 'Wingtips', detail: 'Upturned winglets' },
    { title: 'Fuselage', detail: 'Long trijet fuselage with narrow tail taper' },
  ],
  'AN-124': [
    { title: 'Engines', detail: 'Four large turbofans', highlighted: true },
    { title: 'Fuselage', detail: 'Huge high-mounted cargo fuselage' },
    { title: 'Nose', detail: 'Bulbous hinged cargo nose' },
    { title: 'Gear', detail: 'Many landing gear bogies and kneeling stance' },
    { title: 'Tail', detail: 'Very tall conventional tail' },
    { title: 'Wing', detail: 'High wing on a massive transport body' },
  ],
  'IL-76': [
    { title: 'Engines', detail: 'Four engines under a high wing', highlighted: true },
    { title: 'Wing', detail: 'High swept wing with thick roots' },
    { title: 'Gear', detail: 'Many wheels on heavy transport landing gear' },
    { title: 'Tail', detail: 'T-tail' },
    { title: 'Nose', detail: 'Classic Soviet transport nose with glazed look on some variants' },
    { title: 'Fuselage', detail: 'Chunky cargo body with rear ramp' },
  ],
};

export const AIRCRAFT_SPOTTING_TRAITS: Record<string, AircraftSpottingTrait[]> =
  AIRCRAFT_TYPE_HIERARCHY.flatMap((category) =>
    category.families.flatMap((family) =>
      family.variants.map((variant) => [
        variant.code,
        AIRCRAFT_SPOTTING_TRAITS_BY_FAMILY[family.family] ?? [],
      ] as const),
    ),
  ).reduce<Record<string, AircraftSpottingTrait[]>>((accumulator, [code, traits]) => {
    accumulator[code] = traits;
    return accumulator;
  }, {});

export function getAircraftSpottingTraits(typeCode: string | null | undefined) {
  if (!typeCode) {
    return null;
  }

  const upper = typeCode.toUpperCase().trim();
  const directMatch = AIRCRAFT_SPOTTING_TRAITS[upper];
  if (directMatch) {
    return directMatch;
  }

  const familyInfo = getAircraftFamilyInfo(upper);
  if (!familyInfo) {
    return null;
  }

  return AIRCRAFT_SPOTTING_TRAITS_BY_FAMILY[familyInfo.family] ?? null;
}
