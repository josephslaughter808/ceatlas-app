"use client";

import { track } from "@vercel/analytics";
import { useCompare, type CompareItem } from "./compare-provider";

export default function CompareButton({ item }: { item: CompareItem }) {
  const { isCompared, toggleItem } = useCompare();
  const active = isCompared(item.id, item.kind);

  return (
    <button
      type="button"
      className={active ? "compare-button compare-button--active" : "compare-button"}
      onClick={() => {
        track(active ? "compare_remove" : "compare_add", {
          item_kind: item.kind,
          item_id: item.id,
        });
        toggleItem(item);
      }}
      aria-pressed={active}
    >
      {active ? "Added to compare" : "Compare"}
    </button>
  );
}
