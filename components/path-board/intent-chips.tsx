"use client"

import { INTENT_CHIPS, type IntentTag } from "@/lib/path-ranker"
import { cn } from "@/lib/utils"

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
        const isBurnHighlight = chip.tag === "burn"
        return (
          <button
            key={chip.tag}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(chip.tag)}
            title={chip.hint}
            aria-label={`${chip.label}: ${chip.hint}`}
            data-hint={chip.hint}
            className={cn(
              "moves-chip",
              active && "is-active",
              isBurnHighlight && "moves-chip-highlight",
            )}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
