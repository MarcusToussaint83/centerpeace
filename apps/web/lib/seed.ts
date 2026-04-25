import type { EventState, Guest, CenterpeaceTable } from "./types";

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

  // 6 round tables of 8, arranged in a 3x2 grid.
  // Canvas coordinate space; the camera centers the room on mount.
  const cols = 3;
  const rows = 2;
  const spacingX = 320;
  const spacingY = 320;
  const startX = -((cols - 1) * spacingX) / 2;
  const startY = -((rows - 1) * spacingY) / 2;

  const tables: CenterpeaceTable[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      tables.push({
        id: id("t"),
        label: `Table ${i + 1}`,
        shape: "round",
        capacity: 8,
        x: startX + col * spacingX,
        y: startY + row * spacingY,
        host:
          i === 0
            ? "Marcus Toussaint"
            : i === 1
              ? "Sarah Chen"
              : undefined,
        purpose:
          i === 0
            ? "Host table — major donors"
            : i === 1
              ? "Foundation cultivation"
              : i === 2
                ? "Faith partners"
                : i === 3
                  ? "Africa programs"
                  : i === 4
                    ? "Asia / Latin America"
                    : "Young professionals",
      });
    }
  }

  return {
    id: "demo",
    name: "Annual Gala 2026 — Demo",
    guests,
    tables,
    assignments: {},
  };
}
