// The 33 local government areas of Oyo State.
export const OYO_LGAS = [
  "Afijio",
  "Akinyele",
  "Atiba",
  "Atisbo",
  "Egbeda",
  "Ibadan North",
  "Ibadan North-East",
  "Ibadan North-West",
  "Ibadan South-East",
  "Ibadan South-West",
  "Ibarapa Central",
  "Ibarapa East",
  "Ibarapa North",
  "Ido",
  "Irepo",
  "Iseyin",
  "Itesiwaju",
  "Iwajowa",
  "Kajola",
  "Lagelu",
  "Ogbomosho North",
  "Ogbomosho South",
  "Ogo Oluwa",
  "Olorunsogo",
  "Oluyole",
  "Ona Ara",
  "Orelope",
  "Ori Ire",
  "Oyo East",
  "Oyo West",
  "Saki East",
  "Saki West",
  "Surulere",
] as const;

export const NIN_PATTERN = /^\d{11}$/;

const NIN_BLOCKLIST = new Set([
  "00000000000",
  "11111111111",
  "12345678901",
  "12345678900",
  "01234567890",
  "09876543210",
  "98765432109",
  "99999999999",
  "55555555555",
  "22222222222",
  "33333333333",
  "44444444444",
  "66666666666",
  "77777777777",
  "88888888888",
]);

/** 11 digits AND not an obvious dummy (repeats, sequences, test numbers). */
export function isPlausibleNin(nin: string): boolean {
  if (!NIN_PATTERN.test(nin) || NIN_BLOCKLIST.has(nin)) return false;
  if (new Set(nin).size === 1) return false;

  let ascending = true;
  let descending = true;
  for (let i = 1; i < nin.length; i++) {
    ascending &&= nin.charCodeAt(i) === nin.charCodeAt(i - 1) + 1;
    descending &&= nin.charCodeAt(i) === nin.charCodeAt(i - 1) - 1;
  }
  return !(ascending || descending);
}

// Approximate LGA headquarter/centre coordinates — used to centre the map picker.
export const LGA_COORDINATES: Record<string, [number, number]> = {
  Afijio: [7.815, 3.905],
  Akinyele: [7.45, 3.92],
  Atiba: [7.8529, 3.9312],
  Atisbo: [8.55, 3.43],
  Egbeda: [7.38, 4.05],
  "Ibadan North": [7.4, 3.91],
  "Ibadan North-East": [7.385, 3.9],
  "Ibadan North-West": [7.38, 3.88],
  "Ibadan South-East": [7.37, 3.9],
  "Ibadan South-West": [7.36, 3.87],
  "Ibarapa Central": [7.42, 3.28],
  "Ibarapa East": [7.53, 3.42],
  "Ibarapa North": [7.56, 3.23],
  Ido: [7.42, 3.86],
  Irepo: [8.72, 3.85],
  Iseyin: [7.97, 3.6],
  Itesiwaju: [8.2, 3.28],
  Iwajowa: [8.0, 2.95],
  Kajola: [8.03, 3.35],
  Lagelu: [7.5, 3.88],
  "Ogbomosho North": [8.13, 4.24],
  "Ogbomosho South": [8.11, 4.24],
  "Ogo Oluwa": [8.02, 4.12],
  Olorunsogo: [8.75, 4.13],
  Oluyole: [7.35, 3.86],
  "Ona Ara": [7.29, 3.95],
  Orelope: [8.83, 3.76],
  "Ori Ire": [8.03, 4.17],
  "Oyo East": [7.85, 3.95],
  "Oyo West": [7.86, 3.92],
  "Saki East": [8.62, 3.6],
  "Saki West": [8.67, 3.39],
  Surulere: [8.1, 4.23],
};

// Ibadan city centre — default map position.
export const DEFAULT_MAP_CENTER: [number, number] = [7.3775, 3.947];

export const VENUE_TYPES: {
  type: "Lounge" | "Bar" | "Club" | "Nightclub";
  image: string;
  blurb: string;
}[] = [
  {
    type: "Bar",
    image: "/images/type-bar.jpg",
    blurb: "Drinking spot or local bar serving drinks and small chops",
  },
  {
    type: "Lounge",
    image: "/images/type-lounge.jpg",
    blurb: "Sit-down lounge with seating, drinks and food service",
  },
  {
    type: "Club",
    image: "/images/type-club.jpg",
    blurb: "Members-style club or social club with entertainment",
  },
  {
    type: "Nightclub",
    image: "/images/type-nightclub.jpg",
    blurb: "Late-night venue with DJ, dance floor and bottle service",
  },
];

/** Carries the public-signup venue pick into the dashboard wizard. */
export const PENDING_TYPES_KEY = "oyo-lc:pending-venue-types";

export function readPendingVenueTypes(): ("Lounge" | "Bar" | "Club" | "Nightclub")[] {
  try {
    const raw = localStorage.getItem(PENDING_TYPES_KEY);
    if (raw) {
      localStorage.removeItem(PENDING_TYPES_KEY);
      const parsed = JSON.parse(raw) as unknown[];
      return parsed.filter((t): t is "Lounge" | "Bar" | "Club" | "Nightclub" =>
        ["Lounge", "Bar", "Club", "Nightclub"].includes(t as string),
      );
    }
  } catch {
    // ignore malformed storage
  }
  return [];
}
