import { createElement } from "react";
import type { GeneratedOutfit } from "@/lib/domain/outfits";

export type ReasonChip = { label: string };

const MAX_RULE_DESCRIPTION_LENGTH = 48;
const MAX_CHIPS = 3;

function truncateLabel(label: string, maxLength: number): string {
  return label.length <= maxLength ? label : label.slice(0, maxLength);
}

export function chipsFromOutfit(outfit: GeneratedOutfit, extra?: string[]): ReasonChip[] {
  const chips: ReasonChip[] = [];

  const weatherInsight = outfit.insights.find((insight) => insight.key === "weather");
  if (weatherInsight?.title) {
    chips.push({ label: weatherInsight.title });
  }

  const firedRule = outfit.firedRules[0];
  if (firedRule?.description && chips.length < MAX_CHIPS) {
    chips.push({
      label: truncateLabel(firedRule.description, MAX_RULE_DESCRIPTION_LENGTH)
    });
  }

  const extraLabel = extra?.[0];
  if (extraLabel && chips.length < MAX_CHIPS) {
    chips.push({ label: extraLabel });
  }

  return chips;
}

export function ReasonStrip({ chips }: { chips: ReasonChip[] }) {
  if (!chips.length) {
    return null;
  }

  return createElement(
    "div",
    { className: "flex flex-wrap gap-2" },
    chips.map((chip) =>
      createElement(
        "span",
        {
          key: chip.label,
          className: "pw-chip normal-case tracking-normal"
        },
        chip.label
      )
    )
  );
}
