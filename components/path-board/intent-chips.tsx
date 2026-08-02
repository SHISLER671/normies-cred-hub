"use client"

import { INTENT_CHIPS, type IntentTag } from "@/lib/path-ranker"

type IntentChipsProps = {
  selected?: IntentTag | null
  onSelect: (tag: IntentTag) => void
  disabled?: boolean
}

export function IntentChips({ selected, onSelect, disabled }: IntentChipsProps) {
  return (
    <div role="group" aria-label="Move intents" className="moves-chips">
      {INTENT_CHIPS.map((chip) => {
        const active = selected === chip.tag
        return (
          <button
            key={chip.tag}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(chip.tag)}
            title={chip.hint}
            className={active ? "moves-chip is-active" : "moves-chip"}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
