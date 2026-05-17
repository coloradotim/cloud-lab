import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { selectLabForWorkbench } from "./app/workbenchRoute";
import {
  CLOUD_OPTICS_BEAUTY_LAB_ID,
  EVOLVING_BOUNDARY_LAYER_LAB_ID,
  FAIR_WEATHER_CUMULUS_LAB_ID,
  labCatalog,
  labById,
} from "./labs/labCatalog";
import { BUILT_IN_SCENARIOS } from "./simulationControls";
import { LabPicker } from "./workbench/LabPicker";
import { LabWorkbench, WorkbenchErrorFallback } from "./workbench/LabWorkbench";

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
    expect(html).toContain("Reduced-model v2 shell");
    expect(html).toContain("surface sensible heating");
    expect(html).toContain("1-D profile evolution");
    expect(html).toContain("prescribed lift");
    expect(html).toContain("controlled cloud formation");
    expect(html).toContain("lifted condensation level / cloud base");
    expect(html).toContain("cap / inversion suppression");
    expect(html).toContain("dry failed cumulus");
    expect(html).toContain("Reduced model");
  });

  it("marks future planned labs as visibly non-functional", () => {
    const html = renderToStaticMarkup(<LabPicker labs={labCatalog} onSelectLab={vi.fn()} />);

    expect(html).toContain("Coming next");
    expect(html).toContain("Future labs");
    expect(html).toContain("Not open yet");
    expect(html).toContain("aria-disabled=\"true\"");
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

  it("does not expose quarantined Boussinesq prototype scenarios in the normal Lab Picker", () => {
    const html = renderToStaticMarkup(<LabPicker labs={labCatalog} onSelectLab={vi.fn()} />);
    const boussinesqScenarios = BUILT_IN_SCENARIOS.filter(
      (scenario) => scenario.solverMode === "boussinesq_2d",
    );

    expect(boussinesqScenarios.length).toBeGreaterThan(0);
    expect(
      boussinesqScenarios.every(
        (scenario) => scenario.visibility === "developer_prototype",
      ),
    ).toBe(true);
    for (const scenario of boussinesqScenarios) {
      expect(html).not.toContain(scenario.name);
    }
    expect(html).not.toContain("Experimental Boussinesq prototype");
    expect(html).not.toContain("Yellow-status Boussinesq");
    expect(selectLabForWorkbench("boussinesq_2d")).toEqual({ view: "lab-picker" });
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

describe("Evolving Boundary Layer Workbench V2", () => {
  const boundaryLayerLab = labById(EVOLVING_BOUNDARY_LAYER_LAB_ID);

  if (!boundaryLayerLab) {
    throw new Error("Missing Evolving Boundary Layer lab");
  }

  it("opens inside Workbench V2 around boundary_layer_1d profile evolution", () => {
    const html = renderToStaticMarkup(
      <LabWorkbench lab={boundaryLayerLab} onBackToLabs={vi.fn()} />,
    );

    expect(selectLabForWorkbench("evolving-boundary-layer")).toEqual({
      view: "workbench",
      selectedLabId: "evolving-boundary-layer",
    });
    expect(html).toContain("Evolving Boundary Layer");
    expect(html).toContain("Simplified 1-D profile evolution");
    expect(html).toContain("V1 diagnoses cloud formation potential. It does not produce cloud water.");
    expect(html).toContain("Morning stable layer breaks down");
    expect(html).toContain("Moist surface, cumulus favorable");
    expect(html).toContain("Dry entrainment suppresses potential");
    expect(html).toContain("Surface moisture flux enables potential");
    expect(html).toContain("Strong cap suppresses growth");
    expect(html).toContain("No-flux control");
    expect(html).toContain("Surface heating strength");
    expect(html).toContain("Surface moisture flux");
    expect(html).toContain("Initial mixed-layer humidity");
    expect(html).toContain("Initial stability / lapse rate");
    expect(html).toContain("Inversion height");
    expect(html).toContain("Inversion strength");
    expect(html).toContain("Dry air above mixed layer");
    expect(html).toContain("Entrainment strength");
    expect(html).toContain("Profile / sounding hero view");
    expect(html).toContain("Temperature profile");
    expect(html).toContain("RH profile");
    expect(html).toContain("Initial profile");
    expect(html).toContain("Profile replay controls");
    expect(html).toContain("Replay evolution");
    expect(html).toContain("0.0 h after sunrise");
    expect(html).toContain("Duration after sunrise");
    expect(html).toContain("4.0 h after sunrise");
    expect(html).not.toContain("14400");
    expect(html).toContain("Mixed-layer depth");
    expect(html).toContain("LCL");
    expect(html).toContain("Inversion / cap");
    expect(html).toContain("Cloud formation potential");
    expect(html).toContain("Scenario check");
    expect(html).toContain("Expected");
    expect(html).toContain("Observed");
    expect(html).toContain("Try next");
    expect(html).toContain("Deterministic limiting reason");
    expect(html).toContain("Mixed-layer depth minus LCL");
    expect(html).toContain("No cloud water in v1");
    expect(html).toContain("Not cloud-resolving");
    expect(html).toContain("No live Boussinesq coupling");
    expect(html).toContain("Run profile");
    expect(html).toContain("Status: Ready");
    expect(html).not.toContain("Mode: single");
    expect(html).not.toContain("System drawer");
    expect(html).not.toContain("Stop</button>");
    expect(html).not.toContain("Scientific 2-D field view");
    expect(html).not.toContain("cloud_liquid_water_kg_per_kg");
    expect(html).not.toContain("Experimental 2-D prototype");
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
    expect(html).toContain("Baseline shallow cloud");
    expect(html).toContain("Ready");
  });

  it("renders setup, visualization, and inspector regions for the v2 shell", () => {
    const html = renderToStaticMarkup(
      <LabWorkbench lab={fairWeatherLab} onBackToLabs={vi.fn()} />,
    );

    expect(html).toContain("Setup");
    expect(html).toContain("Visualization stage");
    expect(html).toContain("Inspector");
    expect(html).toContain("Timeline / scrubber");
  });

  it("opens the Lower Atmosphere v2 reduced-model shell by default", () => {
    const html = renderToStaticMarkup(
      <LabWorkbench lab={fairWeatherLab} onBackToLabs={vi.fn()} />,
    );

    expect(html).toContain("Scenario");
    expect(html).toContain("Baseline shallow cloud");
    expect(html).toContain("Dry failed cumulus");
    expect(html).toContain("Capped / suppressed cloud");
    expect(html).toContain("Moist surface enables cloud");
    expect(html).toContain("What do you want to explore?");
    expect(html).toContain("Evolve atmosphere");
    expect(html).toContain("Lift cloud column");
    expect(html).toContain("Evolve + lift");
    expect(html).toContain("Atmosphere profile");
    expect(html).toContain("Surface forcing");
    expect(html).toContain("Cap / inversion");
    expect(html).toContain("Entrainment");
    expect(html).toContain("Prescribed lift");
    expect(html).toContain("Advanced settings");
    expect(html).toContain("Surface heating strength");
    expect(html).toContain("Surface moisture flux");
    expect(html).toContain("Initial mixed-layer humidity");
    expect(html).toContain("Dry air above mixed layer");
    expect(html).toContain("Inversion height");
    expect(html).toContain("Inversion strength");
    expect(html).toContain("Lift strength");
    expect(html).toContain("Lift duration");
    expect(html).not.toContain("Model size / runtime");
    expect(html).toContain(">Run v2 flow<");
    expect(html).not.toContain(">Stop<");
    expect(html).toContain(">Reset<");
    expect(html).toContain("Lower Atmosphere v2 reduced-model shell");
    expect(html).toContain("boundary_layer_1d profile view");
    expect(html).toContain("controlled_cloud_column view");
    expect(html).toContain("Atmosphere evolution produces no cloud water in v1");
    expect(html).toContain("Lift is prescribed forcing, not predicted circulation.");
    expect(html).toContain("Expected vs observed");
    expect(html).toContain("Precipitation status placeholder");
    expect(html).toContain("Reduced model");
    expect(html).toContain("1-D profile evolution");
    expect(html).toContain("Prescribed lift");
    expect(html).toContain("Controlled cloud formation");
    expect(html).toContain("Not cloud-resolving dynamics");
    expect(html).toContain("No Boussinesq default");
    expect(html).toContain("Not weather prediction");
    expect(html).not.toContain("Scientific 2-D field view");
    expect(html).not.toContain("Experimental 2-D prototype");
    expect(html).not.toContain("boussinesq_2d");
  });

  it("keeps Boussinesq prototype scenarios out of the Lower Atmosphere v2 scenario selector", () => {
    const html = renderToStaticMarkup(
      <LabWorkbench lab={fairWeatherLab} onBackToLabs={vi.fn()} />,
    );
    const boussinesqScenarioSlugs = BUILT_IN_SCENARIOS.filter(
      (scenario) => scenario.solverMode === "boussinesq_2d",
    ).map((scenario) => scenario.slug);

    expect(html).toContain("Lower Atmosphere v2 setup");
    expect(html).toContain("Baseline shallow cloud");
    expect(html).toContain("Rain-capable warm cloud later");
    for (const scenarioSlug of boussinesqScenarioSlugs) {
      expect(html).not.toContain(`value="${scenarioSlug}"`);
    }
    expect(html).not.toContain("Scientific 2-D field view");
    expect(html).not.toContain("Experimental 2-D prototype");
  });

  it("keeps Lower Atmosphere v2 scenario setup copy from duplicating the selected name", () => {
    const dryFailedScenario = fairWeatherLab.scenarios.find(
      (scenario) => scenario.id === "lower-atmosphere-v2-dry-failed-cumulus",
    );
    if (!dryFailedScenario) {
      throw new Error("Missing Dry failed cumulus scenario");
    }
    const dryFirstLab = {
      ...fairWeatherLab,
      scenarios: [
        dryFailedScenario,
        ...fairWeatherLab.scenarios.filter((scenario) => scenario.id !== dryFailedScenario.id),
      ],
    };

    const html = renderToStaticMarkup(
      <LabWorkbench lab={dryFirstLab} onBackToLabs={vi.fn()} />,
    );

    expect(html).toContain("Lower Atmosphere v2 setup");
    expect(html).toContain("Choose scenario");
    expect(html).toContain("Why can air rise but fail to form cloud?");
    expect(html).toContain("Air is lifted, but low humidity keeps the column cloud-free.");
    expect(html).not.toContain('<h2 id="setup-region-title">Dry failed cumulus</h2>');
    expect(html.match(/Dry failed cumulus/g)?.length ?? 0).toBeLessThanOrEqual(3);
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

  it("renders local workbench error fallback copy for crash protection", () => {
    const visualizationFallback = renderToStaticMarkup(
      <WorkbenchErrorFallback
        fallbackTitle="Profile visualization failed to render."
        fallbackBody="Reset the lab or change scenario settings and run again."
      />,
    );
    const inspectorFallback = renderToStaticMarkup(
      <WorkbenchErrorFallback
        fallbackTitle="Diagnostics failed to render."
        fallbackBody="The profile run data may be incomplete or inconsistent."
      />,
    );

    expect(visualizationFallback).toContain("Profile visualization failed to render.");
    expect(visualizationFallback).toContain("Reset the lab or change scenario settings and run again.");
    expect(inspectorFallback).toContain("Diagnostics failed to render.");
    expect(inspectorFallback).toContain("The profile run data may be incomplete or inconsistent.");
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
