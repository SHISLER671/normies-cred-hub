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
> **Source of truth for live Canvas mechanics:** still Action Points (AP) until official Normies / Serc docs say otherwise.
> **Feature flag:** \`PIXEL_CURRENCY_ENABLED\` (default \`false\`).
> **Default settlement:** \`DEFAULT_CURRENCY=AP\`.

This document does **not** replace pixel-economy.md. It only frames the naming and conversion ambiguity around **Pixel** vs **AP**.

## 1. Pixel vs AP distinction

| Concept | Today (live) | PIXEL MARKET (planned) |
|---------|----------------|-------------------------|
| **Action Points (AP)** | Canvas-local transform budget on a specific Normie | May remain the internal name, or become a **legacy alias** |
| **Pixel (PIXEL)** | Not an independent ledger in this app | Candidate **market currency name** (Serc hint) for tradeable edit-budget units |

**Working assumptions (until docs drop):**

1. **Same unit:** Pixel is a rebrand / market-facing name for AP → **1 AP = 1 PIXEL**.
2. **Different units:** Pixel is a tradeable market token and AP stays Canvas-local → conversion via **oracle** (placeholder rate only).

Zulo must **never invent** live order books, transfer mechanics, or non-1:1 rates without published oracle docs.

## 2. Burn mechanics (earn AP / Pixel)

- **Earn only by burning** Normies into a receiver’s Canvas (commit → wait → reveal).
- Yield bands by on-pixel count (0–490, 491–890, 891+).
- Budget is **bound to a Normie Canvas**, not eth_getBalance and not TBA inventory.
- Spend: **1 unit = 1 pixel add or remove** on the current 40×40 grid.
- Prefer **Pixel** as primary market term when feature-enabled; keep **AP** as legacy alias and API field name.

## 3. PIXEL MARKET trading (planned)

- Venue: peer / agent market for scarce edit budget.
- Burn Efficiency / Market Sentinel still quote **AP per ETH** as the measurable proxy.
- Manifest: \`payment.pixelCurrencyStatus\` scaffolded; \`payment.conversionOracle\` planned until serc docs.

## 4. Conversion scenarios

- **Same unit (default):** 1 AP = 1 PIXEL (\`PIXEL_CONVERSION_MODE=same-unit\`).
- **Oracle:** PIXEL = AP × placeholder rate (\`PIXEL_AP_ORACLE_RATE\`); never present as live market price.
- Migration: keep AP workflows; advertise both currencies; enforce AP until flag + rails + official docs.

## 5. Safety rules

1. Flag off → speak in AP only; Pixel is planned naming only.
2. Flag on / scaffolded → dual vocabulary OK; never claim enforced Pixel settlement.
3. Never break burn-efficiency or Canvas math denominated in AP.
4. Prefer: “Canvas AP (market-facing name may be Pixel)” over inventing two balances.

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
      "Pixel may be the PIXEL MARKET name for what is currently AP (Serc hint)",
      "AP remains Canvas-local until official transfer/oracle docs",
      "Default assumption: 1 AP = 1 PIXEL (same-unit mode)",
      "Alternate: variable conversion via planned oracle",
    ],
    conversion: [
      "same-unit: identity rate (default)",
      "oracle: placeholder PIXEL_AP_ORACLE_RATE until live feed",
      "conversionOracle status: planned",
    ],
    principles: [
      "Never invent live Pixel order books",
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
