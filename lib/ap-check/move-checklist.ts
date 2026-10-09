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
const LAB = { label: "normies.art docs: Normie Lab", url: "https://www.normies.art/docs/lab" }

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
      "#PIXEL on a Normie moves with the Normie. There is no wallet-to-wallet #PIXEL transfer, so leaving them on is the only way to move them to another wallet of yours. If you are selling it or giving it away, take them off first or they go to the new owner. Free pixels come off without touching the art; locked pixels back the drawing, so taking them off resets it.",
    source: LAB,
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
      "A wallet approved to spend #PIXEL can spend them from the wallet or from any Normie it owns. Moving a Normie into a wallet with a stray approval puts its pixels in reach. Check that wallet above first. Give only what is needed and revoke afterwards.",
    source: STORAGE,
  },
  {
    title: "Revenue share counts what you hold.",
    body: "Your pool share is measured four times a day, at unpredictable moments, during each epoch. Moving Normies or pixels out mid-epoch lowers it.",
    source: LAB,
  },
  {
    title: "Send it safely.",
    body:
      "Copy the address from its source, check the first and last characters, and never move a Normie through a site that asks you to approve all your NFTs.",
  },
]
