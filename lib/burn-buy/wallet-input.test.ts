import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { normalizeWalletInput as n } from "./wallet-input"

const A = "0xFafd8Fb6b4E43ACE0E365553f1b9242384591031"
const L = A.toLowerCase()

describe("normalizeWalletInput: cleans", () => {
  it("leaves a good address alone", () => assert.equal(n(A), A))
  it("trims spaces, quotes, brackets and trailing punctuation", () => {
    for (const x of [`  ${A}  `, `"${A}"`, `'${A}'`, `(${A})`, `${A}.`, `${A},`, `“${A}”`, `\`${A}\``]) assert.equal(n(x), A, x)
  })
  it("fixes 0X and a missing 0x", () => {
    assert.equal(n("0X" + A.slice(2)), A)
    assert.equal(n(A.slice(2)), A)
  })
  it("removes spaces inside an address", () => assert.equal(n(`${A.slice(0, 10)} ${A.slice(10, 30)} ${A.slice(30)}`), A))
  it("lower-cases ENS names", () => {
    assert.equal(n("Vitalik.ETH"), "vitalik.eth")
    assert.equal(n(" 32626.eth. "), "32626.eth")
  })
  it("pulls the one address out of a link", () => {
    assert.equal(n(`https://etherscan.io/address/${A}`), L)
    assert.equal(n(`https://normiescredhub.vercel.app/burn?wallet=${A}&goal=arena`), L)
    assert.equal(n(`https://etherscan.io/address/${A}#tokentxns`), L)
  })
})

describe("normalizeWalletInput: never guesses", () => {
  it("leaves too-short and too-long addresses unchanged", () => {
    assert.equal(n(A.slice(0, -1)), A.slice(0, -1))
    assert.equal(n(A + "0"), A + "0")
  })
  it("does not cut an address out of a 64-character transaction hash", () => {
    const tx = "0x" + "ab".repeat(32)
    assert.equal(n(`https://etherscan.io/tx/${tx}`), `https://etherscan.io/tx/${tx}`)
    assert.equal(n(tx), tx)
  })
  it("leaves a link with two different addresses alone", () => {
    const x = `https://example.com/?a=${A}&b=0x${"1".repeat(40)}`
    assert.equal(n(x), x)
  })
  it("leaves non-hex and junk unchanged", () => {
    for (const x of ["0x" + "g".repeat(40), "hello world", "", "notenough.eth.com", "vitalik"]) assert.equal(n(x), x.trim())
  })
})
