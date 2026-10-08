// "Before you move a Normie": what changes when a Normie changes wallets. Every item quotes or follows an official source
// (checked 2026-10-08); nothing here is a guess. Abnormie alignment is NOT covered: no official source describes what a transfer
// does to it, so it stays out until one does.

export interface MoveItem {
  title: string
  body: string
  /** Where it comes from. Absent only for plain safety habits that need no source. */
  source?: { label: string; url: string }
}

const AGENTIC = { label: "normies.art docs: Agentic", url: "https://www.normies.art/docs/agentic" }
const TECHNICAL = { label: "normies.art docs: Technical", url: "https://www.normies.art/docs/technical" }
const STORAGE = {
  label: "NormiesCanvasStorageV2 source",
  url: "https://etherscan.io/address/0x96F2DA32Bb9D429d59ac13dB469f4950cBe02084#code",
}
const API = { label: "Normies API docs", url: "https://api.normies.art/llms.txt" }
const SIMULATOR = { label: "Normies revenue share simulator", url: "https://simulator.normies.art/" }

export const MOVE_CHECKLIST: readonly MoveItem[] = [
  {
    title: "Its agent goes with it.",
    body:
      "If the Normie is awakened, whoever owns it controls its agent. The link between Normie and agent cannot be undone, and there is no way yet to keep the agent in a different wallet.",
    source: AGENTIC,
  },
  {
    title: "Its pixels go with it.",
    body:
      "#PIXEL attached to a Normie moves with the Normie and stops counting for you. To keep them, take them off first. Free pixels come off without touching the art; locked pixels back the drawing, so taking them off resets it.",
    source: API,
  },
  {
    title: "Canvas helpers lose access.",
    body: "Anyone you let paint this Normie loses that right when it changes hands. It only works again if the Normie comes back to you.",
    source: TECHNICAL,
  },
  {
    title: "Finish any burn first.",
    body:
      "A burn is set up by the owner of the Normie receiving the pixels. If this Normie is receiving one, reveal it before you move it: a burn that is not revealed in about 50 minutes pays the minimum.",
    source: TECHNICAL,
  },
  {
    title: "Check the new wallet's approvals.",
    body:
      "A wallet approved to spend #PIXEL can spend them from the wallet or from any Normie it owns. Moving a Normie into a wallet with a stray approval puts its pixels in reach. Check that wallet above first.",
    source: STORAGE,
  },
  {
    title: "Revenue share counts what you hold.",
    body: "Your pool share is measured at random moments during the month. Moving Normies or pixels out mid-month lowers it.",
    source: SIMULATOR,
  },
  {
    title: "Send it safely.",
    body:
      "Copy the address from its source, check the first and last characters, and never move a Normie through a site that asks you to approve all your NFTs.",
  },
]
