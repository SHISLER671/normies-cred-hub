import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { shouldLiveScan } from "./canvas-scan-policy"

const idx = (tokenIds: number[], checked = true) => ({ tokenIds, checked })

describe("shouldLiveScan", () => {
  it("skips the expensive live scan when the wallet owns a Normie", () => {
    assert.equal(shouldLiveScan({ direct: [7141], delegateXyz: [], canvasIndex: idx([]) }), false)
  })
  it("skips it when the index already knows a Canvas delegation", () => {
    assert.equal(shouldLiveScan({ direct: [], delegateXyz: [], canvasIndex: idx([7141]) }), false)
  })
  it("skips it when a Delegate.xyz delegation was found", () => {
    assert.equal(shouldLiveScan({ direct: [], delegateXyz: [30], canvasIndex: idx([]) }), false)
  })
  it("scans when nothing at all was found (a brand-new Canvas delegate would not be in the index yet)", () => {
    assert.equal(shouldLiveScan({ direct: [], delegateXyz: [], canvasIndex: idx([]) }), true)
  })
  it("scans when the index could not be read, even if other things were found: unknown is not 'none'", () => {
    assert.equal(shouldLiveScan({ direct: [7141], delegateXyz: [], canvasIndex: idx([], false) }), true)
  })
})
