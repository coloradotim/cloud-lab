import type { SimulationConfig } from "./simulationTypes";
import { normalizeConfig } from "./simulationControls";

export type SavedScenario = {
  id: string;
  kind: "user";
  name: string;
  created_at: string;
  updated_at: string;
  config_schema_version: SimulationConfig["schema_version"];
  config: SimulationConfig;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STORAGE_KEY = "cloud-lab.saved-scenarios.v1";

export function loadSavedScenarios(storage: StorageLike = window.localStorage): SavedScenario[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => coerceSavedScenario(item))
      .filter((scenario): scenario is SavedScenario => scenario !== null)
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  } catch {
    return [];
  }
}

export function saveNewScenario(
  scenarios: SavedScenario[],
  name: string,
  config: SimulationConfig,
  now = new Date(),
): SavedScenario[] {
  const trimmedName = name.trim() || "Untitled experiment";
  const timestamp = now.toISOString();
  return [
    {
      id: scenarioId(timestamp),
      kind: "user",
      name: trimmedName,
      created_at: timestamp,
      updated_at: timestamp,
      config_schema_version: config.schema_version,
      config: normalizeConfig(config),
    },
    ...scenarios,
  ];
}

export function updateSavedScenario(
  scenarios: SavedScenario[],
  scenarioIdToUpdate: string,
  config: SimulationConfig,
  now = new Date(),
): SavedScenario[] {
  const timestamp = now.toISOString();
  return scenarios.map((scenario) =>
    scenario.id === scenarioIdToUpdate
      ? {
          ...scenario,
          updated_at: timestamp,
          config_schema_version: config.schema_version,
          config: normalizeConfig(config),
        }
      : scenario,
  );
}

export function deleteSavedScenario(
  scenarios: SavedScenario[],
  scenarioIdToDelete: string,
): SavedScenario[] {
  return scenarios.filter((scenario) => scenario.id !== scenarioIdToDelete);
}

export function persistSavedScenarios(
  scenarios: SavedScenario[],
  storage: StorageLike = window.localStorage,
) {
  storage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
}

function coerceSavedScenario(item: unknown): SavedScenario | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Partial<SavedScenario>;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    !record.config ||
    typeof record.config !== "object"
  ) {
    return null;
  }

  const normalizedConfig = normalizeConfig(record.config as SimulationConfig);
  const createdAt = typeof record.created_at === "string" ? record.created_at : new Date(0).toISOString();
  const updatedAt = typeof record.updated_at === "string" ? record.updated_at : createdAt;

  return {
    id: record.id,
    kind: "user",
    name: record.name,
    created_at: createdAt,
    updated_at: updatedAt,
    config_schema_version: normalizedConfig.schema_version,
    config: normalizedConfig,
  };
}

function scenarioId(timestamp: string): string {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `scenario-${timestamp}-${randomPart}`;
}
