/**
 * Conditional loader for Pixel currency knowledge.
 * Does not modify existing knowledge/*.md files under agent-recommendations.
 * Loaded only when PIXEL_CURRENCY_ENABLED=true.
 *
 * Bundled string only (no fs/path) so this module stays edge/client-safe if imported
 * transitively. Authoring source: pixel-currency.md (keep in sync).
 */

import { isPixelCurrencyEnabled } from "@/lib/payments/config"

/** Bundled copy of pixel-currency.md for serverless / flag-on inject. */
export const PIXEL_CURRENCY_MD = `# Pixel Currency — Zulo Knowledge Base (Scaffolding)

> **Status:** Scaffolded preparation for PIXEL MARKET.
> **Official framing (@normiesART, Aug 2026):** **Pixel = Action Points (AP)**; market **announced / technical WIP — not live trading**.
> **Source of truth for live Canvas mechanics:** AP (Pixel) Canvas-local budget.
> **Feature flag:** \`PIXEL_CURRENCY_ENABLED\` (default \`false\`).
> **Default settlement:** \`DEFAULT_CURRENCY=AP\`.
> **Related:** dual-evaluation-and-pixel-market.md, pixel-economy.md.

This document does **not** replace pixel-economy.md or dual-evaluation doctrine. It only frames currency naming / conversion scaffolding for when market rails land.

## 1. Pixel vs AP distinction

| Concept | Today (live) | PIXEL MARKET (announced / WIP) |
|---------|----------------|-------------------------|
| **Action Points (AP)** | Canvas-local transform budget on a specific Normie | Same unit as Pixel per official announcement |
| **Pixel (PIXEL)** | Market-facing name for AP (not a separate live ledger here) | Future buy/sell venue for edit-budget units — **not live trading yet** |

**Working assumptions:**

1. **Same unit (default / official framing):** Pixel = AP → **1 AP = 1 PIXEL**.
2. **Different units (only if future oracle docs say so):** conversion via **oracle** (placeholder rate only — never invent live prices).

Zulo must **never invent** live order books, transfer mechanics, hold-threshold X, or non-documented rates.

## 2. Burn mechanics (earn AP / Pixel)

- **Earn only by burning** Normies into a receiver’s Canvas (commit → wait → reveal).
- Yield bands by on-pixel count (0–490, 491–890, 891+).
- Budget is **bound to a Normie Canvas**, not eth_getBalance and not TBA inventory.
- Spend: **1 unit = 1 pixel add or remove** on the current 40×40 grid.
- Prefer **Pixel** as primary market term when feature-enabled; keep **AP** as legacy alias and API field name.

## 3. PIXEL MARKET trading (announced / WIP — not live)

- Venue: peer / agent market for scarce edit budget (when live).
- Burn Efficiency / Market Sentinel still quote **AP per ETH** as the measurable proxy.
- Manifest: \`payment.pixelCurrencyStatus\` scaffolded; \`payment.conversionOracle\` planned until rails live.

## 4. Conversion scenarios

- **Same unit (default):** 1 AP = 1 PIXEL (\`PIXEL_CONVERSION_MODE=same-unit\`).
- **Oracle:** PIXEL = AP × placeholder rate (\`PIXEL_AP_ORACLE_RATE\`); never present as live market price.
- Migration: keep AP workflows; advertise both currencies; enforce AP until flag + rails.

## 5. Safety rules

1. Flag off → speak in AP; note Pixel = AP and market not live when asked.
2. Flag on / scaffolded → dual vocabulary OK; never claim enforced Pixel settlement or live books.
3. Never break burn-efficiency or Canvas math denominated in AP.
4. Prefer: “Pixel is AP (Canvas-local); PIXEL MARKET not live trading yet.”

*Patience compounds. Haste erodes.*
`

/** Full markdown when flag enabled; empty string when disabled. */
export function loadPixelCurrencyKnowledge(): string {
  if (!isPixelCurrencyEnabled()) return ""
  return PIXEL_CURRENCY_MD.trim()
}

/** Prompt block — only injected when Pixel currency feature is on. */
export function buildPixelCurrencyPromptBlock(): string {
  const md = loadPixelCurrencyKnowledge()
  if (!md) return ""
  return `=== PIXEL CURRENCY KNOWLEDGE (scaffolded — feature flag ON) ===
${md}

CURRENCY ENFORCEMENT:
- Live Canvas math and burn efficiency remain AP-denominated
- Prefer "Pixel" as market-facing primary term; "AP" as legacy alias
- Do not invent live PIXEL MARKET books or non-1:1 rates without oracle docs
- conversionOracle is planned unless context says live`
}

/** Compact summary for platformContext (null when disabled). */
export function getPixelCurrencyContextSummary(): {
  title: string
  status: string
  pillars: string[]
  conversion: string[]
  principles: string[]
  source: string
} | null {
  if (!isPixelCurrencyEnabled()) return null
  return {
    title: "Pixel Currency (scaffolded)",
    status: "scaffolded",
    pillars: [
      "Pixel = AP (official @normiesART, Aug 2026)",
      "PIXEL MARKET announced / technical WIP — not live trading",
      "AP remains Canvas-local; market buy/sell later when live",
      "Default: 1 AP = 1 PIXEL (same-unit mode)",
    ],
    conversion: [
      "same-unit: identity rate (default)",
      "oracle: placeholder PIXEL_AP_ORACLE_RATE until live feed",
      "conversionOracle status: planned",
    ],
    principles: [
      "Never invent live Pixel order books or hold-threshold X",
      "Burn efficiency stays AP-denominated",
      "Pixel primary term / AP legacy alias when flag on",
    ],
    source: "lib/knowledge/pixel-currency.md",
  }
}

/** Whether knowledge/prompt injection should include Pixel currency docs. */
export function shouldInjectPixelCurrencyKnowledge(): boolean {
  return isPixelCurrencyEnabled()
}
