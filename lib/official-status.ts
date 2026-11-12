// ONE source of truth for the official Normies surface statuses that CredHub / Ask repeat in many places.
// Every prompt block, page and knowledge file that states these statuses must import from here (or, for .md files that cannot
// import, match these exact lines). lib/official-status.test.ts fails if any copy drifts or an old "Coming Soon" Pixel Market
// line comes back. Change a status here, in one place, and only on an OFFICIAL source (@normiesART, @serc1n, normies.art).
//
// Live runtime state (e.g. the PIXEL_MARKET pin and the contract's /canvas/status block in lib/burn-buy/switches.ts) is
// separate: it can still pin the market closed in an emergency. This module is the documented official status.

export const OFFICIAL_STATUS_AS_OF = "2026-10-19"

/** Planned Arena launch source: @normiesART, Nov 11, 2026 ("launching on Monday. Registration starts on Saturday."). */
export const ARENA_LAUNCH_SOURCE = "https://x.com/normiesART/status/2120475856372142292"

export const OFFICIAL_STATUS = {
  pixelMarket: {
    status: "LIVE",
    since: "2026-10-05",
    sources: [
      "@normiesART: Pixel Market launching Mon Oct 5, 2026",
      "@serc1n Oct 15, 2026 broadcast (Pixel Market dashboard, ~11 ETH volume ~10 days after launch)",
    ],
  },
  arena: {
    status: "COMING_SOON",
    expected: `Monday, November 16, 2026 (planned, per normiesART's Nov 11 post, ${ARENA_LAUNCH_SOURCE})`,
    source: ARENA_LAUNCH_SOURCE,
    /** Registration is not launch: Arena stays COMING_SOON until an official source says it is live. */
    registration: {
      week1Opens: "2026-11-14",
      source: "https://x.com/serc1n/status/2119787233632719147",
      /** UTC, from the X API. */
      postedAt: "2026-11-09T13:40:34Z",
      /** When CredHub last checked the post. */
      checkedAt: "2026-11-10",
    },
  },
  zombies: {
    status: "SEALED",
    claimed: 21,
    total: 21,
  },
  /** Announced by @serc1n, not launched: no date, no official data source yet. Never present as live. */
  agentsCanvas: {
    status: "ANNOUNCED",
    announced: "2026-10-19",
    sources: [
      "@serc1n Oct 19, 2026 sneak peek: Agents Canvas, one themed canvas a day painted autonomously by Hive agents",
      "@serc1n Oct 19, 2026 (x.com/serc1n/status/2111919283399717274): 256x256 canvas made by a Normie agent; other agents will check it and give feedback, vote",
    ],
  },
} as const

export type OfficialSurfaceStatus = "LIVE" | "COMING SOON" | "ALL CLAIMED"

/** Canonical sentences. Copy these, never paraphrase a status. */
export const PIXEL_MARKET_STATUS_LINE = `Pixel Market = LIVE since ${OFFICIAL_STATUS.pixelMarket.since} (official)`
export const ARENA_STATUS_LINE = `Arena = Coming Soon (official docs; expected ${OFFICIAL_STATUS.arena.expected}); not playable on CredHub`
/** Copy next to ARENA_STATUS_LINE wherever Arena's status is stated. Date only, as posted: no time or timezone claim. */
export const ARENA_REGISTRATION_LINE = `Arena Week 1 registration date: Saturday, November 14, 2026 (per @serc1n, ${OFFICIAL_STATUS.arena.registration.source}, as of the ${OFFICIAL_STATUS.arena.registration.postedAt.slice(0, 10)} post); per the same post it is a fully autonomous agent game. Registration opening isn't the Arena launch. CredHub doesn't handle registration`
export const AGENTS_CANVAS_STATUS_LINE = `Agents Canvas = announced by @serc1n (${OFFICIAL_STATUS.agentsCanvas.announced}), not live yet; no official data to read`
export const ZOMBIES_STATUS_LINE = `Zombies = ${OFFICIAL_STATUS.zombies.claimed}/${OFFICIAL_STATUS.zombies.total} sealed, not Arena, nothing to claim`

/** Homepage tag words for the official Lab surfaces that this module owns. */
export const SURFACE_TAGS = {
  pixelMarket: (OFFICIAL_STATUS.pixelMarket.status === "LIVE" ? "LIVE" : "COMING SOON") as OfficialSurfaceStatus,
  // Fail closed: only an explicit LIVE shows LIVE. Any other status (a delay, a new word) shows COMING SOON.
  arena: (String(OFFICIAL_STATUS.arena.status) === "LIVE" ? "LIVE" : "COMING SOON") as OfficialSurfaceStatus,
  zombies: "ALL CLAIMED" as OfficialSurfaceStatus,
}

export const isPixelMarketOfficiallyLive = (): boolean => OFFICIAL_STATUS.pixelMarket.status === "LIVE"
