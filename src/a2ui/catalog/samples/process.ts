import type { Sample } from "./types";
import type { ComponentName } from "../definitions";

/**
 * ProcessDiagram samples: scenario 1 (SOP-to-BPMN). A 3-lane procurement
 * process (requester, manager, finance) with an exclusive gateway, as plain
 * topology: no coordinates anywhere. The surface is checked without any LLM
 * through the component page preview (`sampleOps`) and the worked example in
 * `../examples.ts`.
 */
const PROCUREMENT = {
  title: "Procurement approval",
  notation: "bpmn",
  lanes: [
    { id: "lanerequester", label: "Requester" },
    { id: "lanemanager", label: "Manager" },
    { id: "lanefinance", label: "Finance" },
  ],
  nodes: [
    { id: "nstart", kind: "start", label: "Need identified", laneId: "lanerequester" },
    { id: "nsubmit", kind: "userTask", label: "Submit request", laneId: "lanerequester" },
    { id: "nreview", kind: "userTask", label: "Review request", laneId: "lanemanager" },
    { id: "ngate", kind: "exclusiveGateway", label: "Amount over $25k?", laneId: "lanemanager" },
    { id: "napprove", kind: "userTask", label: "Approve purchase", laneId: "lanemanager" },
    { id: "npay", kind: "serviceTask", label: "Pay invoice", laneId: "lanefinance" },
    { id: "ndone", kind: "end", label: "Closed", laneId: "lanefinance" },
  ],
  edges: [
    { id: "e1", from: "nstart", to: "nsubmit", kind: "sequence" },
    { id: "e2", from: "nsubmit", to: "nreview", kind: "sequence" },
    { id: "e3", from: "nreview", to: "ngate", kind: "sequence" },
    { id: "e4", from: "ngate", to: "napprove", label: "yes", kind: "sequence" },
    { id: "e5", from: "ngate", to: "npay", label: "no", kind: "sequence" },
    { id: "e6", from: "napprove", to: "npay", kind: "sequence" },
    { id: "e7", from: "npay", to: "ndone", kind: "sequence" },
  ],
} as const;

export const processSamples: Partial<Record<ComponentName, Sample>> = {
  ProcessDiagram: {
    components: [{ id: "root", component: "ProcessDiagram", ...PROCUREMENT }],
  },
};
