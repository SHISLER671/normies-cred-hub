// ONE source of truth for the official Normies surface statuses that CredHub / Ask repeat in many places.
// Every prompt block, page and knowledge file that states these statuses must import from here (or, for .md files that cannot
// import, match these exact lines). lib/official-status.test.ts fails if any copy drifts or an old "Coming Soon" Pixel Market
// line comes back. Change a status here, in one place, and only on an OFFICIAL source (@normiesART, @serc1n, normies.art).
//
// Live runtime state (e.g. the PIXEL_MARKET pin and the contract's /canvas/status block in lib/burn-buy/switches.ts) is
// separate: it can still pin the market closed in an emergency. This module is the documented official status.

export const OFFICIAL_STATUS_AS_OF = "2026-11-14"

/** Arena launch source: @normiesART, Nov 11, 2026 ("launching on Monday. Registration starts on Saturday."). */
export const ARENA_LAUNCH_SOURCE = "https://x.com/normiesART/status/2120475856372142292"

/**
 * The official post that says Arena is live: @normiesART, 2026-11-14 19:00 UTC, "Normies Arena is live now", linking
 * arena.normies.art. This is the source for the LIVE status (URL and wording supplied by Ryan).
 */
export const ARENA_LIVE_SOURCE = "https://x.com/normiesART/status/2121679594294030459"

/** Official Arena entry page. Source for mechanics, fee, schedule and the Canvas table, and where a holder opts in. */
export const ARENA_ENTER_SOURCE = "https://arena.normies.art/world/enter"

/** Official Arena site. NCH never handles opt-in: people are pointed here. */
export const ARENA_SITE = "https://arena.normies.art"

/** Official Arena data: line, rounds and per-Normie state. The record card reads it (lib/record-card/arena.ts). */
export const ARENA_API_STATUS = "https://api.normies.art/arena/status"

/**
 * NormiesArenaStorage (verified on Etherscan; listed in lib/official-contracts.ts). Since the launch-weekend migration
 * (block 26421529) this is the contract Normies were migrated into; round 1 started on it at block 26429543.
 */
export const ARENA_STORAGE_CONTRACT = "0x235403069c8516369eb36d29bb1a498a469ab9f0"

/** The launch-weekend Arena storage, retired at the launch-weekend migration (block 26421529). The pinned /arena/status fixture predates it. */
export const ARENA_STORAGE_CONTRACT_V1 = "0x980d97e7b77cd204707daeda6c9e51fbcae84e1e"

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
    /**
     * LIVE, per @normiesART's 2026-11-14 post "Normies Arena is live now" (ARENA_LIVE_SOURCE). The official Arena is open
     * for opt-in and its official data is public. What is live is
     * entering and the line. Games run in rounds; Game 1 started Mon Nov 16, 20:00 CET, and a Normie that is registered but
     * hasn't played a round has no record yet.
     */
    status: "LIVE",
    /** The Saturday opt-in opened (20:00 CET), per the official entry page's schedule. */
    since: "2026-11-14",
    /** The official "live" post (see ARENA_LIVE_SOURCE). */
    liveSource: ARENA_LIVE_SOURCE,
    /** UTC, as given with the post. */
    liveSourcePostedAt: "2026-11-14T19:00:00Z",
    sources: [
      `@normiesART, 2026-11-14 19:00 UTC (${ARENA_LIVE_SOURCE}): "Normies Arena is live now", linking arena.normies.art`,
      `Official Arena entry page (${ARENA_ENTER_SOURCE}): opt in any time before Monday 20:00 CET (during a game, it's for next week); games run Monday 20:00 CET to Saturday 20:00 CET`,
      `Official API (${ARENA_API_STATUS}): indexed, with Normies in the line and round 1 upcoming (read at block 26416887)`,
      `NormiesArenaStorage ${ARENA_STORAGE_CONTRACT} (verified contract, same deployer as the Pixel Market and Canvas contracts; Normies were migrated into it from ${ARENA_STORAGE_CONTRACT_V1} at block 26421529, and round 1 started on it at block 26429543)`,
      `@normiesART, Nov 11, 2026 (${ARENA_LAUNCH_SOURCE}): "launching on Monday. Registration starts on Saturday."`,
    ],
    /** The launch plan as posted on Nov 11. Kept for surfaces that show the plan whenever the status is anything but LIVE. */
    expected: "Monday, November 16, 2026 (planned, per normiesART's Nov 11 post)",
    source: ARENA_LAUNCH_SOURCE,
    enterPage: ARENA_ENTER_SOURCE,
    site: ARENA_SITE,
    /** Week 1 registration, as posted before launch. The line below is kept word for word. */
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
export const ARENA_STATUS_LINE = `Arena = LIVE since ${OFFICIAL_STATUS.arena.since} (official: @normiesART, "Normies Arena is live now", ${ARENA_LIVE_SOURCE}; opt-in is open at ${ARENA_ENTER_SOURCE}; games run in rounds and Game 1 started Mon Nov 16, 20:00 CET); a fully autonomous agent game, entered at ${ARENA_SITE}, never on CredHub`
/**
 * Copy next to ARENA_STATUS_LINE wherever Arena's status is stated. Date only, as posted: no time or timezone claim.
 * Unchanged since before launch (docs/zulo/thesis-lock.md carries it word for word); every statement in it still holds.
 */
export const ARENA_REGISTRATION_LINE = `Arena Week 1 registration date: Saturday, November 14, 2026 (per @serc1n, ${OFFICIAL_STATUS.arena.registration.source}, as of the ${OFFICIAL_STATUS.arena.registration.postedAt.slice(0, 10)} post); per the same post it is a fully autonomous agent game. Registration opening isn't the Arena launch. CredHub doesn't handle registration`
export const AGENTS_CANVAS_STATUS_LINE = `Agents Canvas = announced by @serc1n (${OFFICIAL_STATUS.agentsCanvas.announced}), not live yet; no official data to read`
export const ZOMBIES_STATUS_LINE = `Zombies = ${OFFICIAL_STATUS.zombies.claimed}/${OFFICIAL_STATUS.zombies.total} sealed, not Arena, nothing to claim`

/** Homepage tag words for the official Lab surfaces that this module owns. */
export const SURFACE_TAGS = {
  pixelMarket: (OFFICIAL_STATUS.pixelMarket.status === "LIVE" ? "LIVE" : "COMING SOON") as OfficialSurfaceStatus,
  // Fail closed: only an explicit LIVE shows LIVE. Any other status (a delay, a pause, a new word) shows COMING SOON.
  arena: (String(OFFICIAL_STATUS.arena.status) === "LIVE" ? "LIVE" : "COMING SOON") as OfficialSurfaceStatus,
  zombies: "ALL CLAIMED" as OfficialSurfaceStatus,
}

export const isPixelMarketOfficiallyLive = (): boolean => OFFICIAL_STATUS.pixelMarket.status === "LIVE"

export const isArenaOfficiallyLive = (): boolean => String(OFFICIAL_STATUS.arena.status) === "LIVE"
