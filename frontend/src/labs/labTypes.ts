export type LabStatus = "available" | "prototype" | "planned" | "later";

export type PhysicsCoreId = "boussinesq_2d" | "microphysics_lab";

export type LabControlTier = "primary" | "secondary" | "advanced";

export type LabDiagnosticKind = "display" | "warning" | "scenario-contract" | "hard-check";

export type VisualizationTruthLabel = "solver-output" | "derived-diagnostic" | "visual-approximation";

export type LabControlDefinition = {
  id: string;
  label: string;
  tier: LabControlTier;
  meaning: string;
  expectedEffect: string;
  unitsOrType: string;
  configPaths: string[];
};

export type LabDiagnosticDefinition = {
  id: string;
  label: string;
  purpose: string;
  kind: LabDiagnosticKind;
};

export type LabVisualizationModeDefinition = {
  id: string;
  name: string;
  description: string;
  consumesFields: string[];
  truthLabel: VisualizationTruthLabel;
};

export type LabScenarioDefinition = {
  id: string;
  labId: string;
  name: string;
  intendedPhenomenon: string;
  expectedBehavior: string;
  keyControls: string[];
  diagnosticExpectations: string[];
  limitations: string[];
};

export type LabDefinition = {
  id: string;
  name: string;
  question: string;
  description: string;
  status: LabStatus;
  statusLabel: string;
  supportedPhysicsCore: PhysicsCoreId | null;
  concepts: string[];
  limitations: string[];
  scenarios: LabScenarioDefinition[];
  controls: LabControlDefinition[];
  diagnostics: LabDiagnosticDefinition[];
  visualizationModes: LabVisualizationModeDefinition[];
  isSelectable: boolean;
};
