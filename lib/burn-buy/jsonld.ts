// schema.org JSON-LD for /burn, so search engines and agents can read what the page is without running it.
// Only plain facts: no claims of endorsement, no ratings.

export function burnJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Burn or keep? (Normies CredHub)",
    url: `${origin}/burn`,
    description:
      "Look-only advice for Normies holders: which Normies to burn for #PIXEL, which to keep, and what to buy, for a goal of revenue share, Arena or art. Type a wallet address; nothing to sign.",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any (web)",
    browserRequirements: "None. Works without JavaScript.",
    isAccessibleForFree: true,
    inLanguage: "en",
    featureList: [
      "Per-Normie verdicts: keep, burn candidate, or either, with the reason",
      "Ranked moves by exact score change",
      "Cheapest #PIXEL per ETH among current listings",
      "Goals: revenue share, Arena, art",
      "Machine-readable JSON at /api/burn-buy",
    ],
    publisher: { "@type": "Organization", name: "Normies CredHub", url: origin },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${origin}/burn?wallet={wallet}&goal={goal}` },
      "query-input": ["required name=wallet", "optional name=goal"],
    },
  }
}

/** JSON for a <script type="application/ld+json"> tag: "<" is escaped so the data can never close the tag early. */
export const jsonLdScript = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c")
