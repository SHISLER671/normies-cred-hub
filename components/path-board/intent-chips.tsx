"use client"

import { INTENT_CHIPS, type IntentTag } from "@/lib/path-ranker"

type IntentChipsProps = {
  selected?: IntentTag | null
  onSelect: (tag: IntentTag) => void
  disabled?: boolean
}

export function IntentChips({ selected, onSelect, disabled }: IntentChipsProps) {
  return (
    <div
      role="group"
      aria-label="Intent chips"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      {INTENT_CHIPS.map((chip) => {
        const active = selected === chip.tag
        return (
          <button
            key={chip.tag}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(chip.tag)}
            title={chip.hint}
            style={{
              fontFamily: "inherit",
              fontSize: 13,
              padding: "8px 12px",
              border: "1px solid var(--border, #1a1a1a)",
              background: active
                ? "var(--bg-dark, #1a1a1a)"
                : "var(--bg-primary, #e5e5e5)",
              color: active
                ? "var(--text-inverse, #e5e5e5)"
                : "var(--text-primary, #1a1a1a)",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
            }}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
