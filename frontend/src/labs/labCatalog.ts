import type { LabDefinition } from "./labTypes";

export const FAIR_WEATHER_CUMULUS_LAB_ID = "fair-weather-cumulus";

export const labCatalog: LabDefinition[] = [
  {
    id: FAIR_WEATHER_CUMULUS_LAB_ID,
    name: "Fair-Weather Cumulus",
    question: "Why do puffy cumulus clouds form on some warm afternoons and not others?",
    description:
      "Vary heating, moisture, stability, boundary-layer structure, and runtime to see whether shallow cumulus forms, when it forms, and why similar setups can fail.",
    status: "prototype",
    statusLabel: "Prototype / first reference lab",
    concepts: [
      "surface heating",
      "buoyant thermals",
      "source-layer moisture",
      "LCL / cloud base",
      "stability",
      "dry failed cloud controls",
    ],
    limitations: [
      "Qualitative 2-D Boussinesq prototype",
      "Simplified warm-cloud condensation",
      "Designed for learning and exploration, not weather prediction",
    ],
    scenarios: [
      {
        id: "moderate-cloud-base",
        name: "Moderate cloud base",
        intendedPhenomenon: "Baseline shallow cumulus case.",
        expectedBehavior:
          "Thermal develops first; cloud forms later near expected LCL; cloud top grows with heating and stability.",
      },
    ],
    isSelectable: true,
  },
  {
    id: "cloud-optics-beauty",
    name: "Cloud Optics / Beauty",
    question: "Why do clouds look bright, dark, soft, sharp, glowing, or dramatic?",
    description:
      "Future lab for bulk cloud appearance, sun/view controls, optical-depth labels, and later droplet-aware rendering.",
    status: "planned",
    statusLabel: "Planned",
    concepts: ["sun angle", "cloud thickness", "optical depth", "edge brightening"],
    limitations: ["Not implemented in Workbench V2 yet"],
    scenarios: [],
    isSelectable: false,
  },
  {
    id: "evolving-boundary-layer",
    name: "Evolving Boundary Layer",
    question: "How does the daytime atmosphere evolve into a cloud-producing environment?",
    description:
      "Future lab for mixed-layer growth, moisture redistribution, changing cloud base, and entrainment effects.",
    status: "planned",
    statusLabel: "Planned",
    concepts: ["mixed-layer depth", "surface fluxes", "entrainment", "cloud onset"],
    limitations: ["Dedicated lab spec and model work are planned later"],
    scenarios: [],
    isSelectable: false,
  },
  {
    id: "layered-atmosphere",
    name: "Layered Atmosphere",
    question: "Why do clouds form in separate layers at different altitudes?",
    description:
      "Future lab for moist layers, dry gaps, inversions, broad ascent, and cloud-layer diagnostics.",
    status: "planned",
    statusLabel: "Planned",
    concepts: ["moist layers", "dry layers", "inversions", "cloud layer detection"],
    limitations: ["Not implemented in Workbench V2 yet"],
    scenarios: [],
    isSelectable: false,
  },
  {
    id: "orographic-terrain-clouds",
    name: "Orographic / Terrain Clouds",
    question: "How does terrain lift create clouds?",
    description:
      "Future lab for idealized ridges, upstream moisture, terrain-induced lift, and terrain-relative diagnostics.",
    status: "planned",
    statusLabel: "Planned",
    concepts: ["terrain lift", "upstream LCL", "wind speed", "ridge clouds"],
    limitations: ["No terrain physics or terrain visualization in this issue"],
    scenarios: [],
    isSelectable: false,
  },
  {
    id: "warm-rain-droplet-growth",
    name: "Warm Rain / Droplet Growth",
    question: "Why does some cloud water become rain, while some clouds never rain?",
    description:
      "Future lab for bulk rain indicators, droplet-size distributions, collision/coalescence, and water-budget diagnostics.",
    status: "planned",
    statusLabel: "Planned",
    concepts: ["cloud water", "rain water", "droplet growth", "water budget"],
    limitations: ["No new rain or PySDM work is included here"],
    scenarios: [],
    isSelectable: false,
  },
  {
    id: "fog-stratus",
    name: "Fog / Stratus",
    question: "Why does fog or low stratus form near the surface, and why does it dissipate?",
    description:
      "Future lab for near-surface saturation, cooling/warming, shallow low cloud, and dissipation diagnostics.",
    status: "planned",
    statusLabel: "Planned",
    concepts: ["surface cooling", "near-surface RH", "fog depth", "dissipation time"],
    limitations: ["Not implemented in Workbench V2 yet"],
    scenarios: [],
    isSelectable: false,
  },
  {
    id: "mixed-phase-ice",
    name: "Mixed-Phase / Ice",
    question: "How do cold clouds differ from warm clouds?",
    description:
      "Later lab for freezing level, supercooled liquid, ice mass, and cold-cloud precipitation paths.",
    status: "later",
    statusLabel: "Later",
    concepts: ["freezing level", "supercooled liquid", "ice mass", "cold clouds"],
    limitations: ["Later-stage lab after warm-cloud foundations mature"],
    scenarios: [],
    isSelectable: false,
  },
];

export function labById(labId: string): LabDefinition | undefined {
  return labCatalog.find((lab) => lab.id === labId);
}
