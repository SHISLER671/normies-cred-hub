import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    type: "https://ercs.ethereum.org/ERCS/erc-8257#tool-manifest-v1",
    name: "Normies Cred Pulse",
    description: "Returns reputation and trust signals for any Normie agent (token ID 0-9999). Useful for agents to check trust before interacting.",
    endpoint: "https://normiescredhub.vercel.app/api/agent",
    inputs: {
      type: "object",
      properties: {
        tokenId: {
          type: "integer",
          minimum: 0,
          maximum: 9999,
          description: "Normie token ID"
        }
      },
      required: ["tokenId"]
    },
    outputs: {
      type: "object",
      properties: {
        token_id: { type: "integer" },
        pulse_level: { type: "integer" },
        max_level: { type: "integer" },
        status: { type: "string" },
        breakdown: { type: "array" },
        next_signal: { type: ["string", "null"] }
      }
    },
    creatorAddress: "0xb8792e6516b88e73ed0723f8c1c8a92531a98767",
    tags: ["normies", "reputation", "trust", "erc8004"],
    version: "1.0.0"
  };

  return NextResponse.json(manifest);
}