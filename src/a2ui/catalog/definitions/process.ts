import { z } from "zod";
import { def } from "./shared";

/**
 * ProcessDiagram: the one coarse-grained diagram surface. The model emits
 * graph topology only (never x/y coordinates): the renderer compiles
 * { lanes, nodes, edges } with `@sentropic/diagram-core` and auto-routes it
 * with `@sentropic/diagram-canvas`.
 *
 * Key order is the streaming order (title, notation, lanes, nodes, edges):
 * the installed engine exposes no `parameterOrder` field for own components
 * (verified against `@copilotkit/react-core@1.85.0`), so the Zod object order
 * is what fixes the JSON Schema property order the Express compiler streams.
 */
export const processDefinitions = {
  ProcessDiagram: def(
    "Domain",
    "Auto-routed BPMN, flowchart, or ERD canvas. Emit graph topology only; never emit x/y coordinates.",
    z.object({
      title: z.string(),
      notation: z.enum(["bpmn", "flowchart", "erd"]).default("bpmn"),
      lanes: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
          }),
        )
        .optional(),
      nodes: z.array(
        z.object({
          id: z.string(),
          kind: z.enum([
            "start",
            "end",
            "userTask",
            "serviceTask",
            "exclusiveGateway",
            "parallelGateway",
            "subProcess",
            "entity",
          ]),
          label: z.string(),
          laneId: z.string().optional(),
          status: z
            .enum(["default", "active", "bottleneck", "added"])
            .optional(),
        }),
      ),
      edges: z.array(
        z.object({
          id: z.string(),
          from: z.string(),
          to: z.string(),
          label: z.string().optional(),
          kind: z.enum(["sequence", "message", "association"]).default("sequence"),
        }),
      ),
    }),
    {
      events: {
        onNodeSelect: {
          description: "Fires when a node is clicked, with the A2UI node id.",
          parameters: z.object({ nodeId: z.string() }),
        },
      },
    },
  ),
};
