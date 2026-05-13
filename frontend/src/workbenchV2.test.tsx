import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { selectLabForWorkbench } from "./app/workbenchRoute";
import {
  CLOUD_OPTICS_BEAUTY_LAB_ID,
  FAIR_WEATHER_CUMULUS_LAB_ID,
  labCatalog,
  labById,
} from "./labs/labCatalog";
import { LabPicker } from "./workbench/LabPicker";
import { LabWorkbench } from "./workbench/LabWorkbench";

describe("Workbench V2 lab picker", () => {
  it("renders the initial lab cards from the lab roadmap", () => {
    const html = renderToStaticMarkup(<LabPicker labs={labCatalog} onSelectLab={vi.fn()} />);

    expect(html).toContain("Lower Atmosphere Cloud Basics");
    expect(html).toContain("Clouds, Light, and Shadow");
    expect(html).toContain("Evolving Boundary Layer");
    expect(html).toContain("Layered Atmosphere");
    expect(html).toContain("Orographic / Terrain Clouds");
    expect(html).toContain("Warm Rain / Droplet Growth");
    expect(html).toContain("Fog / Stratus");
    expect(html).toContain("Mixed-Phase / Ice");
  });

  it("reflects the Lower Atmosphere Cloud Basics lab spec on the card", () => {
    const html = renderToStaticMarkup(<LabPicker labs={labCatalog} onSelectLab={vi.fn()} />);

    expect(html).toContain(
      "How do heating, moisture, and stability shape basic warm-cloud formation near the ground?",
    );
    expect(html).toContain("Experimental 2-D warm-cloud model");
    expect(html).toContain("surface sensible heating");
    expect(html).toContain("buoyant thermals");
    expect(html).toContain("source-layer moisture");
    expect(html).toContain("lifted condensation level / cloud base");
    expect(html).toContain("atmospheric stability and lapse rate");
    expect(html).toContain("dry failed cumulus");
    expect(html).toContain("Qualitative 2-D Boussinesq prototype");
  });

  it("marks future planned labs as visibly non-functional", () => {
    const html = renderToStaticMarkup(<LabPicker labs={labCatalog} onSelectLab={vi.fn()} />);

    expect(html).toContain("Coming next");
    expect(html).toContain("Future labs");
    expect(html).toContain("Not open yet");
    expect(html).toContain("aria-disabled=\"true\"");
    expect(selectLabForWorkbench("evolving-boundary-layer")).toEqual({ view: "lab-picker" });
  });

  it("shows Clouds, Light, and Shadow as a subordinate selectable shell", () => {
    const html = renderToStaticMarkup(<LabPicker labs={labCatalog} onSelectLab={vi.fn()} />);

    expect(CLOUD_OPTICS_BEAUTY_LAB_ID).toBe("cloud-optics-beauty");
    expect(html).toContain("Clouds, Light, and Shadow");
    expect(html).toContain("Prototype optics renderer");
    expect(html).toContain("Open Clouds, Light, and Shadow shell");
    expect(selectLabForWorkbench("cloud-optics-beauty")).toEqual({
      view: "workbench",
      selectedLabId: "cloud-optics-beauty",
    });
  });

  it("features Lower Atmosphere Cloud Basics as the guided start-here lab", () => {
    const html = renderToStaticMarkup(<LabPicker labs={labCatalog} onSelectLab={vi.fn()} />);

    expect(html).toContain("Start here");
    expect(html).toContain("featured-lab-card");
    expect(html).toContain("Open Lower Atmosphere Cloud Basics");
  });

  it("selects the legacy internal id for the first functional lab", () => {
    expect(FAIR_WEATHER_CUMULUS_LAB_ID).toBe("fair-weather-cumulus");
    expect(selectLabForWorkbench("fair-weather-cumulus")).toEqual({
      view: "workbench",
      selectedLabId: "fair-weather-cumulus",
    });
  });
});

describe("Clouds, Light, and Shadow Workbench V2 shell", () => {
  const cloudOpticsLab = labById("cloud-optics-beauty");

  if (!cloudOpticsLab) {
    throw new Error("Missing Clouds, Light, and Shadow lab");
  }

  it("opens inside Workbench V2 with interactive renderer states", () => {
    const html = renderToStaticMarkup(
      <LabWorkbench lab={cloudOpticsLab} onBackToLabs={vi.fn()} />,
    );

    expect(html).toContain("Clouds, Light, and Shadow");
    expect(html).toContain("Small Puffy Cumulus");
    expect(html).toContain("Static optics lab");
    expect(html).toContain("Reset controls");
    expect(html).toContain("Save setup");
    expect(html).not.toContain(">Run<");
    expect(html).not.toContain(">Stop<");
    expect(html).not.toContain("Timeline / replay");
    expect(html).not.toContain("No frames buffered yet");
    expect(html).toContain("Rendered appearance");
    expect(html).toContain("Cloud water field");
    expect(html).toContain("Optical depth");
    expect(html).toContain("Light path / shadow");
    expect(html).toContain("What does the cloud look like under the current light and camera setup?");
    expect(html).toContain("Source grid");
    expect(html).toContain("72 x 48");
    expect(html).toContain("Source scene field");
    expect(html).toContain("cloud-optics-scene-v1");
    expect(html).toContain("Optical-depth estimate");
    expect(html).toContain("Cloud water / density summary");
    expect(html).toContain("Light geometry state");
    expect(html).toContain("Light-path length proxy");
    expect(html).toContain("Edge softness state");
    expect(html).toContain("Base/interior darkness state");
    expect(html).toContain("Bright-edge likelihood");
    expect(html).toContain("Layered depth explanation");
    expect(html).toContain("Approximation/honesty label availability");
    expect(html).toContain("Source-field immutability");
    expect(html).toContain("Renderer controls adjust the visual interpretation only");
    expect(html).toContain("Sun direction");
    expect(html).toContain("Front");
    expect(html).toContain("Left");
    expect(html).toContain("Right");
    expect(html).toContain("Behind");
    expect(html).toContain("Sun elevation");
    expect(html).toContain("Low");
    expect(html).toContain("Medium");
    expect(html).toContain("High");
    expect(html).toContain("Camera angle");
    expect(html).toContain("Changes how far the viewer looks through the simplified cloud volume");
    expect(html).toContain("Light and camera orientation guide");
    expect(html).toContain("2.5-D visual scene: this lab turns a simplified cloud-water field into a shallow visual volume");
    expect(html).toContain("Cloud water density");
    expect(html).toContain("Optical depth / scattering strength");
    expect(html).toContain("Visual approximation");
    expect(html).toContain("Not full radiative transfer");
    expect(html).toContain("Not droplet-resolved Mie scattering");
    expect(html).toContain("Not a calibrated radiance product");
    expect(html).toContain("Preset cloud field, not new cloud formation");
  });
});

describe("Workbench V2 shell", () => {
  const fairWeatherLab = labById("fair-weather-cumulus");

  if (!fairWeatherLab) {
    throw new Error("Missing Lower Atmosphere Cloud Basics lab");
  }

  it("renders lab identity in the top bar", () => {
    const html = renderToStaticMarkup(
      <LabWorkbench lab={fairWeatherLab} onBackToLabs={vi.fn()} />,
    );

    expect(html).toContain("Cloud Lab");
    expect(html).toContain("Lower Atmosphere Cloud Basics");
    expect(html).toContain("Fair-weather cumulus / baseline shallow cloud");
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

  it("supports the lower-atmosphere reference flow from lab contract controls to run actions", () => {
    const html = renderToStaticMarkup(
      <LabWorkbench lab={fairWeatherLab} onBackToLabs={vi.fn()} />,
    );

    expect(html).toContain("Scenario");
    expect(html).toContain("Fair-weather cumulus / baseline shallow cloud");
    expect(html).toContain("Dry failed cumulus");
    expect(html).toContain("Capped / suppressed cloud");
    expect(html).toContain("Surface heating strength");
    expect(html).toContain("Surface heating pattern");
    expect(html).toContain("Source-layer humidity");
    expect(html).toContain("Free-atmosphere humidity");
    expect(html).toContain("Stability / lapse rate");
    expect(html).toContain("Boundary-layer depth / cap height");
    expect(html).toContain("Model resolution");
    expect(html).toContain("Domain width");
    expect(html).toContain("Domain height");
    expect(html).toContain("Run length");
    expect(html).not.toContain("Model size / runtime");
    expect(html).toContain(">Run<");
    expect(html).toContain(">Stop<");
    expect(html).toContain(">Reset<");
    expect(html).toContain("Scientific 2-D field view");
    expect(html).toContain("Expected LCL / cloud base");
    expect(html).toContain("Simplified warm-cloud condensation");
    expect(html).toContain("Qualitative 2-D Boussinesq prototype");
  });

  it("keeps saved runs and comparison out of large default panels", () => {
    const html = renderToStaticMarkup(
      <LabWorkbench lab={fairWeatherLab} onBackToLabs={vi.fn()} />,
    );

    expect(html).not.toContain("saved-runs-panel");
    expect(html).not.toContain("comparison-panel");
    expect(html).not.toContain("Saved run artifacts");
    expect(html).not.toContain("Scenario comparison");
    expect(html).not.toContain("Developer details");
    expect(html).not.toContain("Sample output");
  });

  it("makes the new lab picker the default app entry point without the old giant hero", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Start with a focused cloud lab");
    expect(html).toContain("Open Lower Atmosphere Cloud Basics");
    expect(html).toContain("Lower Atmosphere Cloud Basics");
    expect(html).not.toContain("workbench-shell");
    expect(html).not.toContain("dashboard-panel");
    expect(html).not.toContain("saved-runs-panel");
    expect(html).not.toContain("comparison-panel");
    expect(html).not.toContain("Run a seeded fair-weather cumulus slice");
    expect(html).not.toContain("Watch the sample plume");
  });
});
