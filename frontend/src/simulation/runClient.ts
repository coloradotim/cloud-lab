import type { SimulationConfig, SimulationFrame } from "../simulationTypes";

export type RunStatus = "idle" | "starting" | "running" | "stopped" | "complete" | "error";

export type SimulationRunMetadata = {
  run_id: string;
  status?: string;
  duration_seconds?: number;
  frame_interval_seconds?: number;
  last_frame_time_seconds?: number;
};

export type SimulationStreamMessage =
  | { type: "metadata"; run: SimulationRunMetadata }
  | { type: "frame"; run_id: string; frame: SimulationFrame }
  | { type: "complete"; run: SimulationRunMetadata }
  | { type: "stopped"; run: SimulationRunMetadata }
  | { type: "error"; message?: string };

export type RunStreamCleanup = () => void;

export type WorkbenchRunClient = {
  startRun: (config: SimulationConfig) => Promise<SimulationRunMetadata>;
  stopRun: (runId: string) => Promise<void>;
  streamRun: (
    runId: string,
    onMessage: (message: SimulationStreamMessage) => void,
    onError: (message: string) => void,
  ) => RunStreamCleanup;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const websocketBaseUrl = apiBaseUrl.replace(/^http/, "ws");

export const defaultWorkbenchRunClient: WorkbenchRunClient = {
  async startRun(config) {
    const response = await fetch(`${apiBaseUrl}/simulations/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Start returned HTTP ${response.status}`);
    }

    return (await response.json()) as SimulationRunMetadata;
  },

  async stopRun(runId) {
    const response = await fetch(`${apiBaseUrl}/simulations/runs/${runId}/stop`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Stop returned HTTP ${response.status}`);
    }
  },

  streamRun(runId, onMessage, onError) {
    const websocket = new WebSocket(`${websocketBaseUrl}/simulations/runs/${runId}/stream`);

    websocket.onmessage = (event: MessageEvent<string>) => {
      onMessage(JSON.parse(event.data) as SimulationStreamMessage);
    };
    websocket.onerror = () => {
      onError("WebSocket stream failed.");
    };

    return () => websocket.close();
  },
};
