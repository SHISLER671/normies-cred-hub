export type Erc8257Chain = "mainnet" | "base"

export type RegistryToolAccess = {
  openAccess: boolean
  predicateAddress: string | null
  predicateName: string | null
  logic: "AND" | "OR"
  requirementLabels: string[]
  accessNote: string
  manifestAccessMismatch: boolean
}

export type RegistryTool = {
  toolId: number
  chain: Erc8257Chain
  chainId: number
  name: string
  description: string
  tags: string[]
  endpoint: string
  manifestUri: string
  manifestHash: string
  manifestVerified: boolean
  creator: string
  access: RegistryToolAccess
  openseaUrl: string
}

export type DiscoverToolsOptions = {
  chains?: Erc8257Chain[]
  tags?: string[]
  limit?: number
}