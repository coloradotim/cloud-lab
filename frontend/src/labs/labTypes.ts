export type LabStatus = "available" | "prototype" | "planned" | "later";

export type LabScenarioDefinition = {
  id: string;
  name: string;
  intendedPhenomenon: string;
  expectedBehavior: string;
};

export type LabDefinition = {
  id: string;
  name: string;
  question: string;
  description: string;
  status: LabStatus;
  statusLabel: string;
  concepts: string[];
  limitations: string[];
  scenarios: LabScenarioDefinition[];
  isSelectable: boolean;
};
