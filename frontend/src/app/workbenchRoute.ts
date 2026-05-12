import { labById } from "../labs/labCatalog";

export type CloudLabRoute =
  | { view: "lab-picker" }
  | { view: "workbench"; selectedLabId: string };

export function selectLabForWorkbench(labId: string): CloudLabRoute {
  const lab = labById(labId);

  if (!lab?.isSelectable) {
    return { view: "lab-picker" };
  }

  return { view: "workbench", selectedLabId: lab.id };
}
