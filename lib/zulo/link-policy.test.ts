import assert from "node:assert/strict"
import { test } from "node:test"

import { linkHost, trustedHref } from "./link-policy"

test("trusted hosts and their subdomains are clickable", () => {
  for (const u of [
    "https://normies.art/normie/7141",
    "https://api.normies.art/normie/7141/image.svg",
    "https://opensea.io/collection/normies",
    "https://etherscan.io/address/0x0000000000000000000000000000000000000000",
    "https://x.com/serc1n",
    "https://app.ethos.network/profile/x/foo",
    "https://normiescredhub.vercel.app/record/7141",
  ]) {
    assert.ok(trustedHref(u), u)
  }
  assert.ok(trustedHref("https://preview.example.dev/x", ["preview.example.dev"]))
})

test("look-alikes, other hosts and tricks are never clickable", () => {
  for (const u of [
    "https://normies-claim.xyz/claim",
    "https://normies.art.evil.com/",
    "https://evilnormies.art/",
    "https://opensea.io@evil.com/",
    "https://user:pass@opensea.io/",
    "javascript:alert(1)",
    "data:text/html,hi",
    "ftp://normies.art/",
    "not a url",
  ]) {
    assert.equal(trustedHref(u), null, u)
  }
})

test("the real host is shown for links that aren't clickable", () => {
  assert.equal(linkHost("https://normies-claim.xyz/claim?x=1"), "normies-claim.xyz")
})
