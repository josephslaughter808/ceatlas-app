"use client";

import { useCompare, type CompareItem } from "./compare-provider";

export default function CompareButton({ item }: { item: CompareItem }) {
  const { isCompared, toggleItem } = useCompare();
  const active = isCompared(item.id, item.kind);

  return (
    <button
      type="button"
      className={active ? "compare-button compare-button--active" : "compare-button"}
      onClick={() => toggleItem(item)}
      aria-pressed={active}
    >
      {active ? "Added to compare" : "Compare"}
    </button>
  );
}
