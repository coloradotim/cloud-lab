import { useState } from "react";

import { labById, labCatalog } from "../labs/labCatalog";
import { LabPicker } from "../workbench/LabPicker";
import { LabWorkbench } from "../workbench/LabWorkbench";
import { selectLabForWorkbench } from "./workbenchRoute";
import type { CloudLabRoute } from "./workbenchRoute";

export function CloudLabApp() {
  const [route, setRoute] = useState<CloudLabRoute>({ view: "lab-picker" });
  const selectedLab =
    route.view === "workbench" ? labById(route.selectedLabId) : undefined;

  if (route.view === "workbench" && selectedLab) {
    return (
      <LabWorkbench
        lab={selectedLab}
        onBackToLabs={() => setRoute({ view: "lab-picker" })}
      />
    );
  }

  return (
    <LabPicker
      labs={labCatalog}
      onSelectLab={(labId) => setRoute(selectLabForWorkbench(labId))}
    />
  );
}
