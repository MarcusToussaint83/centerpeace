import type {
  Constraint,
  EventState,
  Guest,
  CenterpeaceTable,
} from "./types";

const guestNames: Array<Pick<Guest, "name" | "affiliation">> = [
  { name: "Marcus Toussaint", affiliation: "Seed Company · Host" },
  { name: "Dr. Naomi Adeyemi", affiliation: "Major donor" },
  { name: "Henry Adeyemi", affiliation: "Spouse · plus-one" },
  { name: "Sarah Chen", affiliation: "Foundation chair" },
  { name: "David Chen", affiliation: "Spouse" },
  { name: "Father Michael O'Connor", affiliation: "Diocese of Atlanta" },
  { name: "Aisha Patel", affiliation: "Mid-tier donor · prospect" },
  { name: "Vikram Patel", affiliation: "Spouse" },
  { name: "Reverend Joyce Williams", affiliation: "Faith partner" },
  { name: "Robert Williams", affiliation: "Spouse" },
  { name: "Tomás Herrera", affiliation: "Latin America program" },
  { name: "Maria Herrera", affiliation: "Spouse · translator" },
  { name: "Linda Park", affiliation: "Board member" },
  { name: "Jin Park", affiliation: "Spouse" },
  { name: "Ahmed El-Sayed", affiliation: "MENA program advisor" },
  { name: "Lily Wong", affiliation: "Tech committee · prospect" },
  { name: "Daniel Okafor", affiliation: "African operations" },
  { name: "Grace Okafor", affiliation: "Spouse" },
  { name: "Pastor Samuel Lee", affiliation: "Korean church partner" },
  { name: "Eunice Lee", affiliation: "Spouse" },
  { name: "Thomas Wright", affiliation: "Legacy donor" },
  { name: "Margaret Wright", affiliation: "Spouse · ambassador" },
  { name: "Jasmine Khoury", affiliation: "Young professionals chair" },
  { name: "Anthony Russo", affiliation: "Mid-tier prospect" },
  { name: "Olivia Russo", affiliation: "Spouse" },
  { name: "Imani Johnson", affiliation: "Communications partner" },
  { name: "Marcus Johnson", affiliation: "Spouse" },
  { name: "Wei Zhang", affiliation: "Asia Pacific advisor" },
  { name: "Mei Zhang", affiliation: "Spouse" },
  { name: "Sister Catherine Murphy", affiliation: "Religious order" },
  { name: "Father Brendan Murphy", affiliation: "Religious order" },
  { name: "Camilla Rossi", affiliation: "European foundation rep" },
  { name: "Giancarlo Rossi", affiliation: "Spouse" },
  { name: "Yusuf Hassan", affiliation: "Translation services partner" },
  { name: "Khadija Hassan", affiliation: "Spouse" },
  { name: "Eleanor Whitfield", affiliation: "Honorary board · founding" },
  { name: "Charles Whitfield", affiliation: "Spouse" },
  { name: "Priya Subramaniam", affiliation: "South Asia program" },
  { name: "Arjun Subramaniam", affiliation: "Spouse" },
  { name: "Rev. Daniel Okonkwo", affiliation: "Africa partnerships" },
];

let counter = 0;
const id = (prefix: string) => `${prefix}_${++counter}`;

export function buildDemoEvent(): EventState {
  counter = 0;

  const guests: Guest[] = guestNames.map((g) => ({
    id: id("g"),
    name: g.name,
    affiliation: g.affiliation,
  }));

  // Realistic banquet layout:
  //   - 1 rectangular head table up top (capacity 12)
  //   - 5 round tables of 8 below in a 3 + 2 arrangement
  // Canvas coords; camera centers the room on mount.
  const tables: CenterpeaceTable[] = [
    {
      id: id("t"),
      label: "Head table",
      shape: "rect",
      capacity: 12,
      x: 0,
      y: -340,
      rotation: 0,
      host: "Marcus Toussaint",
      purpose: "Host & major donors",
    },
  ];

  // Top row of rounds (3 tables)
  const topRounds = [
    { x: -320, y: 20, purpose: "Foundation cultivation", host: "Sarah Chen" },
    { x: 0, y: 20, purpose: "Faith partners", host: "Father O'Connor" },
    { x: 320, y: 20, purpose: "Africa programs", host: "Daniel Okafor" },
  ];
  topRounds.forEach((t, i) =>
    tables.push({
      id: id("t"),
      label: `Table ${i + 1}`,
      shape: "round",
      capacity: 8,
      x: t.x,
      y: t.y,
      rotation: 0,
      host: t.host,
      purpose: t.purpose,
    }),
  );

  // Bottom row (2 tables, centered)
  const bottomRounds = [
    { x: -160, y: 320, purpose: "Asia / Latin America", host: "Wei Zhang" },
    { x: 160, y: 320, purpose: "Young professionals", host: "Jasmine Khoury" },
  ];
  bottomRounds.forEach((t, i) =>
    tables.push({
      id: id("t"),
      label: `Table ${i + 4}`,
      shape: "round",
      capacity: 8,
      x: t.x,
      y: t.y,
      rotation: 0,
      host: t.host,
      purpose: t.purpose,
    }),
  );

  // Helper: find guest id by name. Throws if missing so seed bugs surface fast.
  const byName = (name: string): string => {
    const g = guests.find((x) => x.name === name);
    if (!g) throw new Error(`seed: missing guest "${name}"`);
    return g.id;
  };

  const constraints: Constraint[] = [
    {
      id: "c1",
      kind: "must-sit-with",
      a: byName("Dr. Naomi Adeyemi"),
      b: byName("Henry Adeyemi"),
      note: "Spouses",
    },
    {
      id: "c2",
      kind: "must-sit-with",
      a: byName("Sarah Chen"),
      b: byName("David Chen"),
      note: "Spouses",
    },
    {
      id: "c3",
      kind: "must-sit-with",
      a: byName("Aisha Patel"),
      b: byName("Vikram Patel"),
      note: "Spouses",
    },
    {
      id: "c4",
      kind: "must-not-sit-with",
      a: byName("Thomas Wright"),
      b: byName("Eleanor Whitfield"),
      note: "Bad blood from the 2023 board vote",
    },
    {
      id: "c5",
      kind: "must-sit-with",
      a: byName("Marcus Toussaint"),
      b: byName("Dr. Naomi Adeyemi"),
      note: "Host placing major donor at host table",
    },
  ];

  return {
    id: "demo",
    name: "Annual Gala 2026 — Demo",
    guests,
    tables,
    assignments: {},
    constraints,
  };
}
