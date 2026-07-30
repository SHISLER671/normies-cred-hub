# Pixel Currency — Zulo Knowledge Base (Scaffolding)

> **Status:** Scaffolded preparation for PIXEL MARKET.  
> **Source of truth for live Canvas mechanics:** still Action Points (AP) until official Normies / Serc docs say otherwise.  
> **Feature flag:** `PIXEL_CURRENCY_ENABLED` (default `false`).  
> **Default settlement:** `DEFAULT_CURRENCY=AP`.

This document does **not** replace `pixel-economy.md`. It only frames the naming and conversion ambiguity around **Pixel** vs **AP**.

---

## 1. Pixel vs AP distinction

| Concept | Today (live) | PIXEL MARKET (planned) |
|---------|----------------|-------------------------|
| **Action Points (AP)** | Canvas-local transform budget on a specific Normie | May remain the internal name, or become a **legacy alias** |
| **Pixel (PIXEL)** | Not an independent ledger in this app | Candidate **market currency name** (Serc hint) for tradeable edit-budget units |

**Working assumptions (until docs drop):**

1. **Same unit:** Pixel is a rebrand / market-facing name for AP → **1 AP = 1 PIXEL**.
2. **Different units:** Pixel is a tradeable market token and AP stays Canvas-local → conversion via **oracle** (placeholder rate only).

Zulo must **never invent** live order books, transfer mechanics, or non-1:1 rates without published oracle docs.

---

## 2. Burn mechanics (earn AP / Pixel)

Unchanged sacrificial economy (see pixel-economy doctrine):

- **Earn only by burning** Normies into a receiver’s Canvas (commit → wait → reveal).
- Yield bands by on-pixel count (0–490, 491–890, 891+).
- Budget is **bound to a Normie Canvas**, not `eth_getBalance` and not TBA inventory.
- Spend: **1 unit = 1 pixel add or remove** on the current 40×40 grid.

When speaking under Pixel-enabled UI:

- Prefer **“Pixel”** as the primary product term for market-facing copy.
- Keep **“AP”** as the legacy alias and for any API field still named `actionPoints`.
- Do not claim burned units are already transferable on PIXEL MARKET while rails are planned.

---

## 3. PIXEL MARKET trading (planned)

- Venue: peer / agent market for scarce edit budget (and related arena power).
- Zulo skills (Burn Efficiency, Market Sentinel) continue to quote **AP per ETH** floor-burn efficiency as the measurable proxy.
- When a live Pixel book exists, Sentinel should compare floor-buy→burn implied cost vs direct Pixel quotes — **not yet live** in this app.
- Manifest field: `payment.pixelCurrencyStatus` = `scaffolded` | `disabled` | (future) `live`.
- `payment.conversionOracle` = `planned` until serc/oracle docs.

---

## 4. Conversion scenarios

### Scenario A — Same unit (default)

```
1 AP = 1 PIXEL
```

- `PIXEL_CONVERSION_MODE=same-unit` (default)
- Conversion helpers return identity rate with status `placeholder` / note that docs may still rebrand only.

### Scenario B — Distinct units (oracle)

```
PIXEL = AP × oracleRate   (placeholder env: PIXEL_AP_ORACLE_RATE)
```

- `PIXEL_CONVERSION_MODE=oracle`
- Rate is **placeholder only** — never present as live market price.
- `conversionOracle: planned` in manifest until official feed.

### Migration path

1. Keep all existing AP workflows and field names (`actionPoints`, prices in AP).
2. Advertise `currencies: ['AP', 'PIXEL']` for discovery; enforce payment only in AP until flag + rails.
3. When official docs land: set `PIXEL_CURRENCY_ENABLED=true`, confirm same-unit vs oracle, flip `pixelCurrencyStatus` / default currency only with explicit product decision.
4. UI: Pixel primary term, AP legacy alias; auto-detect via feature flag (no forced dual ledger).

---

## 5. Operator env

| Env | Default | Meaning |
|-----|---------|---------|
| `PIXEL_CURRENCY_ENABLED` | `false` | Master feature flag |
| `DEFAULT_CURRENCY` | `AP` | Settlement preference (PIXEL only if flag on) |
| `PIXEL_CONVERSION_MODE` | `same-unit` | `same-unit` \| `oracle` |
| `PIXEL_AP_ORACLE_RATE` | `1` | Placeholder PIXEL per 1 AP when oracle mode |
| `PIXEL_CURRENCY_STATUS` | _(derived)_ | Force `live` only when product-ready |
| `PIXEL_CONVERSION_ORACLE` | `planned` | Oracle feed status |

---

## 6. Safety rules for Zulo answers

1. If flag off → speak in **AP** only; mention Pixel only as planned naming.
2. If flag on / scaffolded → dual vocabulary allowed; never claim enforced Pixel settlement.
3. Never break burn-efficiency or Canvas math denominated in AP.
4. Prefer: “Canvas AP (market-facing name may be Pixel)” over inventing two balances.

*Patience compounds. Haste erodes.*
