"use client";

/**
 * Sentropic: the catalog drawn with `@sentropic/design-system-react` in the
 * Sent Tech theme. Each component takes the props of the catalog component it
 * stands for. Only leaves are swapped (Badge, Button, Divider, Stat,
 * StatGroup, KeyValueList, Heading, Alert, Callout, Progress); containers keep
 * their implementation and take Sentropic's colors from the theme
 * (`./themes.ts`), so switching never remounts what is inside them.
 *
 * Every leaf renders inside Sentropic's `ThemeProvider`, whose default theme
 * is Sent Tech: the provider compiles the tenant tokens and scopes them under
 * `[data-st-theme="sent-tech"]`. The stylesheet itself loads lazily the first
 * time Sentropic is picked (`./sentropic-assets`, wired in `./context`).
 */
import type { ReactNode } from "react";
import {
  Alert as SentropicAlert,
  Badge as SentropicBadge,
  Button as SentropicButton,
  Card as SentropicCard,
  Divider as SentropicDivider,
  ProgressBar as SentropicProgressBar,
  ThemeProvider,
} from "@sentropic/design-system-react";
import type { BadgeTone } from "@sentropic/design-system-react";
import { useGenerativeUIAccessibility } from "@copilotkit/react-core/v2/generative-ui";
import { asArray } from "@/a2ui/catalog/renderers/format";
import type { RendererMap } from "@/a2ui/catalog/renderers/types";
import { str, trendOf, useButton, valueText } from "./shared";
import type { StandardProps } from "./shared";

/** One Sentropic theme scope: the provider's own element carries the tokens. */
function InSentropicTheme({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

/** The standard Button's variants and colors as Sentropic's. */
function SentropicThemedButton(p: StandardProps) {
  const { content, attributes } = useButton(p);
  return (
    <InSentropicTheme>
      <SentropicButton
        {...attributes}
        variant={
          p.color === "danger"
            ? "danger"
            : p.variant === "primary" || p.variant === "solid"
              ? "primary"
              : p.variant === "borderless" || p.variant === "ghost"
                ? "ghost"
                : "secondary"
        }
        size={p.size === "sm" || p.size === "xs" ? "sm" : "md"}
        data-block={p.block || undefined}
      >
        {content}
      </SentropicButton>
    </InSentropicTheme>
  );
}

/** The standard Badge's colors as Sentropic's tones. */
function SentropicThemedBadge(p: StandardProps) {
  const aria = useGenerativeUIAccessibility();
  const tone: BadgeTone =
    p.color === "danger" || p.color === "error"
      ? "error"
      : p.color === "success" || p.color === "warning" || p.color === "info"
        ? p.color
        : "neutral";
  return (
    <InSentropicTheme>
      <SentropicBadge {...aria} tone={tone}>
        {str(p.label)}
      </SentropicBadge>
    </InSentropicTheme>
  );
}

/** A delta pill: Sentropic Badge in the tone of the trend. */
function Delta({ delta, trend }: { delta?: string; trend?: string }) {
  if (!delta) return null;
  const t = trendOf(delta, trend);
  return (
    <SentropicBadge tone={t === "up" ? "success" : t === "down" ? "error" : "neutral"}>
      {delta}
    </SentropicBadge>
  );
}

export const sentropicStandard: Record<string, (p: StandardProps) => ReactNode> = {
  Badge: SentropicThemedBadge,
  Button: SentropicThemedButton,
  Divider: (p) => (
    <InSentropicTheme>
      <SentropicDivider orientation={p.axis === "vertical" ? "vertical" : "horizontal"} />
    </InSentropicTheme>
  ),
};

type Own =
  | "Stat"
  | "StatGroup"
  | "KeyValueList"
  | "Heading"
  | "Alert"
  | "Callout"
  | "Progress";

export const sentropicOwn: Partial<RendererMap<Own>> = {
  Stat: ({ props }) => (
    <InSentropicTheme>
      <SentropicCard className="st-ds-stat">
        <span className="st-ds-stat-label">{str(props.label)}</span>
        <span className="st-ds-stat-value">{valueText(props.value)}</span>
        <Delta delta={props.delta} trend={props.trend} />
        {props.caption ? (
          <span className="st-ds-note">{props.caption}</span>
        ) : null}
      </SentropicCard>
    </InSentropicTheme>
  ),
  StatGroup: ({ props }) => (
    <InSentropicTheme>
      <div className="st-ds-statgroup">
        {asArray<Record<string, unknown>>(props.items).map((it, i) => (
          <SentropicCard key={i} className="st-ds-stat">
            <span className="st-ds-stat-label">{str(it.label)}</span>
            <span className="st-ds-stat-value">{valueText(it.value)}</span>
            <Delta delta={str(it.delta)} trend={str(it.trend)} />
          </SentropicCard>
        ))}
      </div>
    </InSentropicTheme>
  ),
  KeyValueList: ({ props }) => (
    <InSentropicTheme>
      <SentropicCard className="st-ds-pairs">
        {props.title ? (
          <h4 className="st-ds-pairs-title">{props.title}</h4>
        ) : null}
        <dl>
          {asArray<{ label?: string; value?: unknown; hint?: string }>(
            props.items,
          ).map((it, i) => (
            <div key={i}>
              <dt>{str(it.label)}</dt>
              <dd>
                {valueText(it.value)}
                {it.hint ? <small>{it.hint}</small> : null}
              </dd>
            </div>
          ))}
        </dl>
      </SentropicCard>
    </InSentropicTheme>
  ),
  Heading: ({ props }) => (
    <InSentropicTheme>
      <header className="st-ds-heading" data-level={props.level ?? "2"}>
        {props.eyebrow ? (
          <span className="st-ds-eyebrow">{props.eyebrow}</span>
        ) : null}
        <h2>{props.text}</h2>
        {props.subtitle ? <p>{props.subtitle}</p> : null}
      </header>
    </InSentropicTheme>
  ),
  Alert: ({ props }) => (
    <InSentropicTheme>
      <SentropicAlert
        tone={props.tone ?? "info"}
        title={str(props.title)}
        message={props.message ? str(props.message) : undefined}
      />
    </InSentropicTheme>
  ),
  Callout: ({ props }) => (
    <InSentropicTheme>
      <SentropicAlert
        tone="info"
        title={str(props.title) || str(props.text)}
        message={props.title ? str(props.text) : undefined}
        actions={
          props.actionLabel && props.action ? (
            <SentropicButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={props.action}
            >
              {str(props.actionLabel)}
            </SentropicButton>
          ) : undefined
        }
      />
    </InSentropicTheme>
  ),
  Progress: ({ props }) => {
    const pct = Math.max(0, Math.min(100, Number(props.value) || 0));
    const tone =
      props.tone === "positive"
        ? "success"
        : props.tone === "negative"
          ? "error"
          : props.tone === "warning" || props.tone === "info"
            ? props.tone
            : "neutral";
    return (
      <InSentropicTheme>
        <SentropicProgressBar
          label={props.label ? str(props.label) : undefined}
          helperText={props.caption ? str(props.caption) : undefined}
          value={pct}
          max={100}
          tone={tone}
          showValue
        />
      </InSentropicTheme>
    );
  },
};
