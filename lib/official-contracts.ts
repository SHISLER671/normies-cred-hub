// Every contract the Normies team publishes, from normies.art/docs > Technical > Contract addresses (read 2026-10-06), plus the
// pixel treasury the canvas contract itself reports (api.normies.art /canvas/status pixelMarket.treasury). One list for the
// whole site: the Safety tab's "Is this contract official?" check and the labels on pixel approvals both read it.

export interface OfficialContract {
  name: string
  /** What it does, in plain words. */
  role: string
}

const LIST: Array<[string, string, string]> = [
  ["0x9Eb6E2025B64f340691e424b7fe7022fFDE12438", "Normies", "The Normies NFT collection"],
  ["0x1B976bAf51cF51F0e369C070d47FBc47A706e602", "NormiesStorage", "Original art storage"],
  ["0xBe57fC4D0c729b8e8d33b638Dd441F57365e4c25", "NormiesRenderer", "Image renderer (v1)"],
  ["0x7818f24d3239c945510e0a1a523dd9971812c6c0", "NormiesRendererV2", "Image renderer (v2)"],
  ["0x1af01b902256d77cf9499a14ef4e494897380b05", "NormiesRendererV3", "Image renderer (v3)"],
  ["0x8eC46Cc1f306652868a4dfbAAae87CBa2715A0eB", "NormiesRendererV4", "Image renderer (v4)"],
  ["0x7c726f02C5e840e1656b522A5C22caaf87C1C35C", "NormiesRendererV5", "Image renderer (v5)"],
  ["0xd6747533697878a6a3a29B5cCf815740BA23998D", "NormiesRendererV6", "Image renderer (current)"],
  ["0xC74994dD70FFb621CC514cE18a4F6F52124e296d", "NormiesMinter", "Original minter (minting is over)"],
  ["0xc513272597d3022D77b3d7EEBA92cea5D7fb2808", "NormiesMinterV2", "Original minter v2 (minting is over)"],
  ["0x64951d92e345C50381267380e2975f66810E869c", "NormiesCanvas", "Old canvas (paused)"],
  ["0xC255BE0983776BAB027a156681b6925cde47B2D1", "NormiesCanvasStorage", "Old canvas storage"],
  ["0xF14f2852e1fD6A4108156054AF49B3915dc40E2e", "NormiesCanvasV2", "The Canvas: burn, paint, put pixels on and take them off"],
  ["0x96F2DA32Bb9D429d59ac13dB469f4950cBe02084", "NormiesCanvasStorageV2", "#PIXEL balances, allowances and edits"],
  ["0x86156A8d6e4B9925F7fEca527ea5D71B0deeDB64", "NormiesPixelMarket", "The Pixel Market"],
  ["0x481384812e79bf0d11FC0b1704af445D5F06813c", "NormiesRevenuePool", "Holder revenue pool (claims)"],
  ["0xA68A225f62772E6158f2B5f8afC184AdB69c3282", "NormiesRoyaltySplitter", "Splits OpenSea royalties into the pool"],
  ["0x18533ad55a54c3847Da06A48b51aD7DcB2551202", "NormiesZombie", "Zombie conversions"],
  ["0xA331bD22C90D1DA096934Db8bc6b69F0e1491E26", "NormiesZombieStorage", "Zombie art storage"],
  ["0xfA55f6592522dA74224a67c7D3Fd1DF759c628e8", "NormiesLegendaryCanvas", "Legendary canvases"],
  ["0xde152AfB7db5373F34876E1499fbD893A82dD336", "Adapter8004", "Awakening (ERC-8004 agent identities)"],
  ["0x00000000000000447e69651d841bD8D104Bed493", "delegate.xyz V2", "Delegation registry (not Normies-run, used by it)"],
  ["0x00000000000076A84feF008CDAbe6409d2FE638B", "delegate.xyz V1", "Delegation registry (not Normies-run, used by it)"],
  ["0xAF8e9BDcF6463EA1f50f8f70ECF13d85a092a1Aa", "Pixel treasury", "Treasury named by the canvas contract (api.normies.art /canvas/status)"],
]

export const OFFICIAL_CONTRACTS: ReadonlyMap<string, OfficialContract> = new Map(
  LIST.map(([address, name, role]) => [address.toLowerCase(), { name, role }]),
)

const ADDRESS = /^0x[0-9a-fA-F]{40}$/

/** Pulls one address out of what people paste: a bare address, or an Etherscan / OpenSea link with exactly one in it. */
export function parseAddressInput(input: string | null | undefined): string | null {
  if (!input) return null
  const found = new Set((input.match(/0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g) ?? []).map((a) => a.toLowerCase()))
  if (found.size !== 1) return null
  const [a] = [...found]
  return ADDRESS.test(a) ? a : null
}

export type ContractCheck = { address: string; official: true; contract: OfficialContract } | { address: string; official: false }

export function checkContract(address: string): ContractCheck {
  const a = address.toLowerCase()
  const contract = OFFICIAL_CONTRACTS.get(a)
  return contract ? { address: a, official: true, contract } : { address: a, official: false }
}
