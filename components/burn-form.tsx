"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition, type FormEvent, type ReactNode } from "react"

import { GOALS, type Goal } from "@/lib/burn-buy/narrate"
import { normalizeWalletInput } from "@/lib/burn-buy/wallet-input"

/**
 * The wallet box and the goal tabs for /burn.
 *
 * It is a plain GET <form>, so it works with no JavaScript at all. With JavaScript it only adds comfort: tapping a
 * goal re-answers at once, and the results dim with a thin progress bar while the server works. It reads an address
 * you type and nothing else: no wallet connection, no signing.
 */
export function BurnForm({ wallet, goal, children }: { wallet: string; goal: Goal; children: ReactNode }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [text, setText] = useState(wallet)
  const [current, setCurrent] = useState<Goal>(goal)

  const go = (w: string, g: Goal) =>
    start(() => router.push(`/burn?wallet=${encodeURIComponent(normalizeWalletInput(w))}&goal=${g}`, { scroll: false }))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    go(text, current)
  }

  return (
    <>
      <div className="burn-progress" data-on={pending} aria-hidden="true" />
      <form method="get" action="/burn" onSubmit={onSubmit} className="burn-box burn-form" data-tag="Wallet">
        <label htmlFor="wallet" className="sr-only">Wallet address or .eth name</label>
        <div className="burn-inputrow">
          <input
            id="wallet"
            name="wallet"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            className="burn-input"
            aria-describedby="wallet-help"
          />
          <button type="submit" className="burn-go" aria-label="Show my answer">
            <span>Look</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
        <p id="wallet-help" className="burn-safeline">Look-only · just type an address · no signing</p>

        <fieldset className="burn-tabs">
          <legend className="sr-only">What are you burning for?</legend>
          {GOALS.map((g) => (
            <label key={g.id} className="burn-tab">
              <input
                type="radio"
                name="goal"
                value={g.id}
                checked={current === g.id}
                onChange={() => {
                  setCurrent(g.id)
                  go(text, g.id)
                }}
              />
              <span>{g.label}</span>
            </label>
          ))}
        </fieldset>
        <p className="burn-hint" aria-live="polite">{GOALS.find((g) => g.id === current)?.blurb}</p>
      </form>

      <div className="burn-results" data-pending={pending} aria-busy={pending}>
        {children}
      </div>
    </>
  )
}
