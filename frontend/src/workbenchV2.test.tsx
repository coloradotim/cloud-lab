import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { selectLabForWorkbench } from "./app/workbenchRoute";
import { FAIR_WEATHER_CUMULUS_LAB_ID, labCatalog, labById } from "./labs/labCatalog";
import { LabPicker } from "./workbench/LabPicker";
import { LabWorkbench } from "./workbench/LabWorkbench";

describe("Workbench V2 lab picker", () => {
  it("renders the initial lab cards from the lab roadmap", () => {
    const html = renderToStaticMarkup(<LabPicker labs={labCatalog} onSelectLab={vi.fn()} />);

    expect(html).toContain("Fair-Weather Cumulus");
    expect(html).toContain("Cloud Optics / Beauty");
    expect(html).toContain("Evolving Boundary Layer");
    expect(html).toContain("Layered Atmosphere");
    expect(html).toContain("Orographic / Terrain Clouds");
    expect(html).toContain("Warm Rain / Droplet Growth");
    expect(html).toContain("Fog / Stratus");
    expect(html).toContain("Mixed-Phase / Ice");
  });

  it("reflects the Fair-Weather Cumulus lab spec on the card", () => {
    const html = renderToStaticMarkup(<LabPicker labs={labCatalog} onSelectLab={vi.fn()} />);

    expect(html).toContain(
      "Why do puffy cumulus clouds form on some warm afternoons and not others?",
    );
    expect(html).toContain("Prototype / first reference lab");
    expect(html).toContain("surface heating");
    expect(html).toContain("buoyant thermals");
    expect(html).toContain("source-layer moisture");
    expect(html).toContain("LCL / cloud base");
    expect(html).toContain("stability");
    expect(html).toContain("dry failed cloud controls");
    expect(html).toContain("Qualitative 2-D Boussinesq prototype");
  });

  it("marks planned labs as visibly non-functional", () => {
    const html = renderToStaticMarkup(<LabPicker labs={labCatalog} onSelectLab={vi.fn()} />);

    expect(html).toContain("Planned for later");
    expect(html).toContain("disabled=\"\"");
    expect(selectLabForWorkbench("cloud-optics-beauty")).toEqual({ view: "lab-picker" });
  });

  it("selects Fair-Weather Cumulus as the first functional lab", () => {
    expect(FAIR_WEATHER_CUMULUS_LAB_ID).toBe("fair-weather-cumulus");
    expect(selectLabForWorkbench("fair-weather-cumulus")).toEqual({
      view: "workbench",
      selectedLabId: "fair-weather-cumulus",
    });
  });
});

describe("Workbench V2 shell", () => {
  const fairWeatherLab = labById("fair-weather-cumulus");

  if (!fairWeatherLab) {
    throw new Error("Missing Fair-Weather Cumulus lab");
  }

  it("renders lab identity in the top bar", () => {
    const html = renderToStaticMarkup(
      <LabWorkbench lab={fairWeatherLab} onBackToLabs={vi.fn()} />,
    );

    expect(html).toContain("Cloud Lab");
    expect(html).toContain("Fair-Weather Cumulus");
    expect(html).toContain("Moderate cloud base");
    expect(html).toContain("Ready");
  });

  it("renders setup, visualization, inspector, and timeline regions", () => {
    const html = renderToStaticMarkup(
      <LabWorkbench lab={fairWeatherLab} onBackToLabs={vi.fn()} />,
    );

    expect(html).toContain("Setup");
    expect(html).toContain("Visualization stage");
    expect(html).toContain("Inspector");
    expect(html).toContain("Timeline / replay");
  });

  it("keeps saved runs and comparison out of large default panels", () => {
    const html = renderToStaticMarkup(
      <LabWorkbench lab={fairWeatherLab} onBackToLabs={vi.fn()} />,
    );

    expect(html).not.toContain("saved-runs-panel");
    expect(html).not.toContain("comparison-panel");
    expect(html).not.toContain("Saved run artifacts");
    expect(html).not.toContain("Scenario comparison");
  });

  it("makes the new lab picker the default app entry point without the old giant hero", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Choose a cloud lab");
    expect(html).toContain("Fair-Weather Cumulus");
    expect(html).not.toContain("Run a seeded fair-weather cumulus slice");
    expect(html).not.toContain("Watch the sample plume");
  });
});
