"use client";

/**
 * ProcessDiagram renderers: the Sentropic auto-routed surface, and a plain
 * list fallback for the other design systems (switching never breaks a
 * mounted diagram).
 *
 * The surface compiles { lanes, nodes, edges } into a `generic@1` semantic
 * document (`@sentropic/diagram-core`: lanes are `container` entities, nodes
 * are `node` entities nested through `contains`, edges are `link` relations)
 * and routes it with `layoutDocument` (`@sentropic/diagram-canvas`), which
 * owns every coordinate. Edges whose endpoints have not streamed yet are
 * filtered out before layout (dangling edges would refuse the document).
 * Clicking a node selects it and fires the `onNodeSelect` event, when bound.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createDocument,
  defaultProfileRegistry,
  documentRef,
  entityRef,
  relationRef,
  text as textAttr,
} from "@sentropic/diagram-core";
import type { Entity, Relation } from "@sentropic/diagram-core";
import { layoutDocument } from "@sentropic/diagram-canvas";
import { useDesignSystem } from "@/design-systems/context";
import type { RendererMap, RendererProps } from "./types";

type DiagramProps = RendererProps<"ProcessDiagram">["props"] & {
  onNodeSelect?: (args: { nodeId: string }) => unknown;
};

type PlacedNode = {
  key: string;
  nodeId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: string;
  label: string;
  lane: string | null;
};

type PlacedLane = {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

type PlacedEdge = {
  key: string;
  edgeId: string;
  points: Array<{ x: number; y: number }>;
  label?: string;
};

type Placed = {
  width: number;
  height: number;
  lanes: PlacedLane[];
  nodes: PlacedNode[];
  edges: PlacedEdge[];
};

/** An A2UI id as a diagram-core local id (hyphens are legal refs). */
function refOf(id: unknown, fallback: string): string {
  let s = String(id ?? "").replace(/[^A-Za-z0-9._-]/g, "_");
  if (!s) s = fallback;
  if (!/^[A-Za-z0-9]/.test(s)) s = `n${s}`;
  return s;
}

/** Pure text measurement, identical on server and client (no canvas). */
function measure(text: string) {
  return { width: String(text).length * 6.8 + 20, height: 18 };
}

function compile(
  lanes: Array<{ id: string; label: string }>,
  nodes: Array<{
    id: string;
    kind: string;
    label: string;
    laneId?: string;
    status?: string;
  }>,
  edges: Array<{
    id: string;
    from: string;
    to: string;
    label?: string;
    kind?: string;
  }>,
  targetWidth: number,
): Placed | null {
  const nodeIds = new Set(nodes.map((n) => String(n.id)));
  const liveEdges = edges.filter(
    (e) => nodeIds.has(String(e.from)) && nodeIds.has(String(e.to)),
  );
  const laneKeys = new Map(lanes.map((l) => [String(l.id), `lane-${refOf(l.id, "lane")}`]));
  const nodeKeys = new Map(
    nodes.map((n, i) => [String(n.id), `node-${refOf(n.id, `n${i}`)}`]),
  );

  const entities: Record<string, Entity> = {};
  for (const lane of lanes) {
    const id = entityRef(laneKeys.get(String(lane.id))!);
    entities[id] = {
      id,
      profile: "generic@1",
      type: "container",
      attributes: { name: textAttr(String(lane.label)) },
    };
  }
  for (const node of nodes) {
    const id = entityRef(nodeKeys.get(String(node.id))!);
    entities[id] = {
      id,
      profile: "generic@1",
      type: "node",
      attributes: { name: textAttr(String(node.label)) },
    };
  }
  const relations: Record<string, Relation> = {};
  nodes.forEach((node, i) => {
    const laneKey = node.laneId == null ? undefined : laneKeys.get(String(node.laneId));
    if (!laneKey) return;
    const id = relationRef(`contains-${refOf(node.id, `n${i}`)}`);
    relations[id] = {
      id,
      profile: "generic@1",
      type: "contains",
      endpoints: [
        { role: "parent", target: entityRef(laneKey) },
        { role: "child", target: entityRef(nodeKeys.get(String(node.id))!) },
      ],
      attributes: {},
    };
  });
  liveEdges.forEach((edge, i) => {
    const id = relationRef(`edge-${refOf(edge.id, `e${i}`)}`);
    relations[id] = {
      id,
      profile: "generic@1",
      type: "link",
      endpoints: [
        { role: "source", target: entityRef(nodeKeys.get(String(edge.from))!) },
        { role: "target", target: entityRef(nodeKeys.get(String(edge.to))!) },
      ],
      attributes: edge.label ? { label: textAttr(String(edge.label)) } : {},
    };
  });

  const base = createDocument({
    documentId: documentRef("processdiagram"),
    profileRefs: ["generic@1"],
  });
  const result = layoutDocument(
    { ...base, entities, relations },
    {
      registry: defaultProfileRegistry,
      measureText: (t) => measure(t),
      targetWidth: Number.isFinite(targetWidth) && targetWidth > 0 ? targetWidth : 880,
    },
  );
  if (result.status !== "laid-out") return null;

  const byEntity = new Map<string, { label: string; kind: string; lane: string | null }>();
  for (const lane of lanes) {
    byEntity.set(`entity:${laneKeys.get(String(lane.id))}`, {
      label: String(lane.label),
      kind: "lane",
      lane: null,
    });
  }
  const laneOf = new Map(nodes.map((n) => [String(n.id), n.laneId == null ? null : String(n.laneId)]));
  for (const node of nodes) {
    byEntity.set(`entity:${nodeKeys.get(String(node.id))}`, {
      label: String(node.label),
      kind: String(node.kind),
      lane: laneOf.get(String(node.id)) ?? null,
    });
  }
  const keyOfNode = new Map(nodes.map((n) => [`entity:${nodeKeys.get(String(n.id))}`, String(n.id)]));

  const placedLanes: PlacedLane[] = [];
  const placedNodes: PlacedNode[] = [];
  for (const occ of Object.values(result.view.entityOccurrences)) {
    const info = byEntity.get(occ.entity);
    if (!info) continue;
    const g = occ.geometry;
    if (info.kind === "lane") {
      placedLanes.push({ key: occ.id, x: g.x, y: g.y, w: g.width, h: g.height, label: info.label });
    } else {
      placedNodes.push({
        key: occ.id,
        nodeId: keyOfNode.get(occ.entity) ?? occ.entity,
        x: g.x,
        y: g.y,
        w: g.width,
        h: g.height,
        kind: info.kind,
        label: info.label,
        lane: info.lane,
      });
    }
  }
  const edgeLabel = new Map(liveEdges.map((e, i) => [`relation:edge-${refOf(e.id, `e${i}`)}`, e.label == null ? undefined : String(e.label)]));
  const edgeIdOf = new Map(liveEdges.map((e, i) => [`relation:edge-${refOf(e.id, `e${i}`)}`, String(e.id)]));
  const placedEdges: PlacedEdge[] = Object.values(result.view.relationOccurrences)
    .filter((occ) => edgeIdOf.has(occ.relation))
    .map((occ) => ({
      key: occ.id,
      edgeId: edgeIdOf.get(occ.relation)!,
      points: (occ.waypoints ?? []).map((p) => ({ x: p.x, y: p.y })),
      label: edgeLabel.get(occ.relation),
    }));
  return { width: result.fit.width, height: result.fit.height, lanes: placedLanes, nodes: placedNodes, edges: placedEdges };
}

const NODE_STROKE: Record<string, string> = {
  active: "var(--a2ui-color-accent, #2563eb)",
  bottleneck: "var(--a2ui-color-danger, #dc2626)",
  added: "var(--a2ui-color-success, #16a34a)",
};

function truncate(label: string, width: number): string {
  const budget = Math.max(1, Math.floor((width - 28) / 6.6));
  return label.length > budget ? `${label.slice(0, Math.max(0, budget - 1))}…` : label;
}

/** The Sentropic auto-routed diagram surface (fixed min-height container). */
function SentropicDiagramSurface({ props }: { props: DiagramProps }) {
  const emit = props.onNodeSelect;
  const [selected, setSelected] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(880);
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measureEl = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth((prev) => (prev === w ? prev : w));
    };
    measureEl();
    const ro = new ResizeObserver(measureEl);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lanes = useMemo(() => (Array.isArray(props.lanes) ? props.lanes : []), [props.lanes]);
  const nodes = useMemo(() => (Array.isArray(props.nodes) ? props.nodes : []), [props.nodes]);
  const edges = useMemo(() => (Array.isArray(props.edges) ? props.edges : []), [props.edges]);
  const placed = useMemo(
    () => compile(lanes, nodes, edges, width),
    [lanes, nodes, edges, width],
  );

  const onNodeClick = (nodeId: string) => {
    setSelected(nodeId);
    try {
      emit?.({ nodeId });
    } catch {
      // An unbound or failed event must never break the surface.
    }
  };

  return (
    <div ref={hostRef} style={{ minHeight: 320, width: "100%", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 650 }}>{props.title}</span>
        <span style={{ fontSize: 12, color: "var(--a2ui-color-text-secondary, #475569)" }}>
          {props.notation}
        </span>
      </div>
      {placed == null || nodes.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--a2ui-color-border-default, #e2e8f0)",
            borderRadius: 8,
            padding: 24,
            fontSize: 13,
            color: "var(--a2ui-color-text-secondary, #475569)",
          }}
        >
          {nodes.length === 0 ? "No nodes yet." : "Could not lay this graph out."}
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${placed.width} ${placed.height}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          role="img"
          aria-label={props.title}
        >
          <defs>
            <marker id="pd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9" fill="none" strokeWidth="1.5" stroke="var(--a2ui-color-text-secondary, #475569)" />
            </marker>
          </defs>
          {placed.lanes.map((lane) => (
            <g key={lane.key}>
              <rect
                x={lane.x}
                y={lane.y}
                width={lane.w}
                height={lane.h}
                rx={8}
                style={{
                  fill: "var(--a2ui-color-surface-secondary, #f8fafc)",
                  stroke: "var(--a2ui-color-border-default, #e2e8f0)",
                }}
              />
              <text x={lane.x + 12} y={lane.y + 20} fontSize={12} fontWeight={650} style={{ fill: "var(--a2ui-color-text-secondary, #475569)" }}>
                {lane.label}
              </text>
            </g>
          ))}
          {placed.edges.map((edge) => (
            <g key={edge.key}>
              <polyline
                points={edge.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                strokeWidth={1.5}
                markerEnd="url(#pd-arrow)"
                style={{ stroke: "var(--a2ui-color-text-secondary, #475569)" }}
              />
              {edge.label ? (
                <text
                  x={(edge.points[0]?.x ?? 0) / 2 + ((edge.points.at(-1)?.x ?? 0) / 2)}
                  y={(edge.points[0]?.y ?? 0) / 2 + ((edge.points.at(-1)?.y ?? 0) / 2) - 5}
                  fontSize={11}
                  textAnchor="middle"
                  style={{
                    fill: "var(--a2ui-color-text-secondary, #475569)",
                    paintOrder: "stroke",
                    stroke: "var(--a2ui-color-surface, #ffffff)",
                    strokeWidth: 3,
                  }}
                >
                  {edge.label}
                </text>
              ) : null}
            </g>
          ))}
          {placed.nodes.map((node) => {
            const isSelected = selected === node.nodeId;
            const stroke =
              (NODE_STROKE[(nodes.find((n) => String(n.id) === node.nodeId)?.status as string) ?? ""] as string | undefined) ??
              "var(--a2ui-color-border-strong, #94a3b8)";
            return (
              <g key={node.key} onClick={() => onNodeClick(node.nodeId)} style={{ cursor: "pointer" }}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.w}
                  height={node.h}
                  rx={7}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  style={{
                    fill: "var(--a2ui-color-surface, #ffffff)",
                    stroke: isSelected ? "var(--a2ui-color-accent, #2563eb)" : stroke,
                  }}
                />
                <text
                  x={node.x + node.w / 2}
                  y={node.y + node.h / 2 + 4}
                  fontSize={12}
                  fontWeight={600}
                  textAnchor="middle"
                  style={{ fill: "var(--a2ui-color-text-default, #0f172a)" }}
                >
                  {truncate(node.label, node.w)}
                </text>
                <text
                  x={node.x + 7}
                  y={node.y + 12}
                  fontSize={9}
                  style={{ fill: "var(--a2ui-color-text-tertiary, #64748b)" }}
                >
                  {node.kind}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** Plain list fallback for design systems without the diagram surface. */
function ProcessDiagramFallback({ props }: RendererProps<"ProcessDiagram">) {
  const lanes = Array.isArray(props.lanes) ? props.lanes : [];
  const nodes = Array.isArray(props.nodes) ? props.nodes : [];
  const edges = Array.isArray(props.edges) ? props.edges : [];
  const laneOf = new Map(nodes.map((n) => [String(n.id), n.laneId == null ? null : String(n.laneId)]));
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="text-[15px] font-semibold">{props.title}</div>
      {lanes.map((lane) => (
        <div key={String(lane.id)} className="flex min-w-0 flex-col gap-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {lane.label}
          </div>
          <ul className="flex flex-col gap-1">
            {nodes
              .filter((n) => laneOf.get(String(n.id)) === String(lane.id))
              .map((n) => (
                <li key={String(n.id)} className="text-[13px]">
                  {n.label}{" "}
                  <span className="text-muted-foreground">({n.kind})</span>
                </li>
              ))}
          </ul>
        </div>
      ))}
      {nodes
        .filter((n) => !laneOf.get(String(n.id)))
        .map((n) => (
          <div key={String(n.id)} className="text-[13px]">
            {n.label} <span className="text-muted-foreground">({n.kind})</span>
          </div>
        ))}
      <ul className="flex flex-col gap-1">
        {edges.map((e) => (
          <li key={String(e.id)} className="text-[13px] text-muted-foreground">
            {String(e.from)} → {String(e.to)}
            {e.label ? ` · ${e.label}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProcessDiagramView({ props }: RendererProps<"ProcessDiagram">) {
  const { id } = useDesignSystem();
  if (id !== "sentropic") return <ProcessDiagramFallback props={props} />;
  return <SentropicDiagramSurface props={props as DiagramProps} />;
}

export const processRenderers: RendererMap<"ProcessDiagram"> = {
  ProcessDiagram: ProcessDiagramView,
};
