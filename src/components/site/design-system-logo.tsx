import { Puzzle } from "lucide-react";
import type { DesignSystemId } from "@/design-systems/registry";
import { cn } from "@/lib/utils";
import { CopilotKitKite, MaterialMark, ShadcnMark } from "./brand";

/**
 * Each design system as its own mark, in its own colour: CopilotKit's kite, Material 3's blue tile,
 * shadcn/ui in ink (its brand is black and white), Sentropic as a text mark in Sent Tech blue, and your
 * own components as a puzzle piece. The colours are marked important: menus style their icons dim, and a
 * logo keeps its own colour.
 */
export function DesignSystemLogo({
  id,
  className,
}: {
  id: DesignSystemId;
  className?: string;
}) {
  const cls = cn("flex-none", className);
  switch (id) {
    case "copilotkit":
      return <CopilotKitKite className={cn(cls, "!opacity-100")} />;
    case "shadcn":
      return (
        <ShadcnMark className={cn(cls, "!text-foreground !opacity-100")} />
      );
    case "material":
      return <MaterialMark className={cn(cls, "!opacity-100")} />;
    case "sentropic":
      return (
        <span
          aria-hidden
          className={cn(
            cls,
            "text-[15px] font-extrabold leading-none tracking-tight",
            "!text-[#2563eb] dark:!text-[oklch(72%_0.13_242)] !opacity-100",
          )}
        >
          S
        </span>
      );
    default:
      return (
        <Puzzle
          aria-hidden
          strokeWidth={1.75}
          className={cn(
            cls,
            "!text-[#0b5cff] !opacity-100 dark:!text-[#7aa2ff]",
          )}
        />
      );
  }
}
