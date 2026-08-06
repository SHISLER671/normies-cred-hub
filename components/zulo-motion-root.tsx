"use client"

import { useEffect } from "react"

/**
 * Product-wide motion runtime for .zulo-chrome surfaces.
 * - Sticky header scroll state
 * - Scroll reveal for [data-reveal]
 * - Desktop cursor ring on interactives (fine pointer only)
 * Honors prefers-reduced-motion and coarse/touch pointers.
 */
export function ZuloMotionRoot() {
  useEffect(() => {
    const roots = Array.from(
      document.querySelectorAll<HTMLElement>(".zulo-chrome"),
    )
    const root = roots[0] ?? document.body

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const finePointer =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches

    /* ---------- sticky header ---------- */
    const headers = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".zulo-chrome .header.header-fixed",
      ),
    )

    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop
      for (const h of headers) {
        h.classList.toggle("is-scrolled", y > 8)
      }
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })

    /* ---------- scroll reveal ---------- */
    let observer: IntersectionObserver | null = null
    let mo: MutationObserver | null = null

    const revealAll = () => {
      document
        .querySelectorAll<HTMLElement>(".zulo-chrome [data-reveal]")
        .forEach((el) => el.classList.add("is-revealed"))
    }

    const revealInView = () => {
      const vh = window.innerHeight || 800
      document
        .querySelectorAll<HTMLElement>(".zulo-chrome [data-reveal]")
        .forEach((el) => {
          const top = el.getBoundingClientRect().top
          if (top < vh * 0.96) el.classList.add("is-revealed")
        })
    }

    if (reduced) {
      revealAll()
    } else if (typeof IntersectionObserver !== "undefined") {
      // Mark above-the-fold first, then enable hide/show CSS (no flash of empty)
      revealInView()
      for (const r of roots) r.classList.add("js-motion")

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            const el = entry.target as HTMLElement
            el.classList.add("is-revealed")
            observer?.unobserve(el)
          }
        },
        {
          root: null,
          rootMargin: "0px 0px -6% 0px",
          threshold: 0.08,
        },
      )

      const watch = () => {
        document
          .querySelectorAll<HTMLElement>(
            ".zulo-chrome [data-reveal]:not(.is-revealed)",
          )
          .forEach((el) => {
            // Dynamic inserts (Moves results): reveal if already in view
            const top = el.getBoundingClientRect().top
            const vh = window.innerHeight || 800
            if (top < vh * 0.96 && top > -el.getBoundingClientRect().height) {
              el.classList.add("is-revealed")
              return
            }
            observer?.observe(el)
          })
      }
      watch()

      mo = new MutationObserver(() => watch())
      for (const r of roots) {
        mo.observe(r, { childList: true, subtree: true })
      }
    } else {
      revealAll()
    }

    /* ---------- cursor ring (desktop fine pointer only) ---------- */
    /* Reduced-motion: still show static high-contrast ring (CSS kills pulse). */
    let ring: HTMLDivElement | null = null
    let moveHandler: ((e: PointerEvent) => void) | null = null
    let overHandler: ((e: Event) => void) | null = null
    let outHandler: ((e: Event) => void) | null = null
    let downHandler: (() => void) | null = null
    let upHandler: (() => void) | null = null

    if (finePointer) {
      ring = document.createElement("div")
      ring.className = "zulo-cursor-ring"
      ring.setAttribute("aria-hidden", "true")
      // Mount on body so overflow:clip on .zulo-chrome never clips the ring.
      // Theme colors come from :root / .dark CSS variables.
      document.body.appendChild(ring)
      root.classList.add("has-cursor-ring")

      let x = 0
      let y = 0
      let visible = false

      moveHandler = (e: PointerEvent) => {
        x = e.clientX
        y = e.clientY
        if (!ring) return
        // Position only via translate — scale pulse lives in CSS on the element
        ring.style.translate = `${x}px ${y}px`
        if (!visible) {
          visible = true
          ring.classList.add("is-visible")
        }
      }

      const interactiveSelector =
        "a, button, input, textarea, select, summary, [role='button'], .button, .theme-toggle, .home-surface-card, .path-card, .move-card, .moves-chip, .quick-prompt, .pulse-action-btn, .my-agent-card, .pulse-acc-trigger, .active-normie-trigger, .chat-input-field, .moves-input"

      overHandler = (e: Event) => {
        const t = e.target
        if (!(t instanceof Element)) return
        if (t.closest(interactiveSelector)) {
          ring?.classList.add("is-hot")
        }
      }
      outHandler = (e: Event) => {
        const t = e.target
        if (!(t instanceof Element)) return
        if (t.closest(interactiveSelector)) {
          // only cool if leaving interactive (relatedTarget check)
          const related = (e as MouseEvent).relatedTarget
          if (
            related instanceof Element &&
            related.closest(interactiveSelector)
          ) {
            return
          }
          ring?.classList.remove("is-hot")
        }
      }
      downHandler = () => ring?.classList.add("is-press")
      upHandler = () => ring?.classList.remove("is-press")

      window.addEventListener("pointermove", moveHandler, { passive: true })
      root.addEventListener("mouseover", overHandler)
      root.addEventListener("mouseout", outHandler)
      window.addEventListener("pointerdown", downHandler)
      window.addEventListener("pointerup", upHandler)
    }

    return () => {
      window.removeEventListener("scroll", onScroll)
      observer?.disconnect()
      mo?.disconnect()

      if (moveHandler) {
        window.removeEventListener("pointermove", moveHandler)
      }
      if (overHandler) root.removeEventListener("mouseover", overHandler)
      if (outHandler) root.removeEventListener("mouseout", outHandler)
      if (downHandler) window.removeEventListener("pointerdown", downHandler)
      if (upHandler) window.removeEventListener("pointerup", upHandler)
      ring?.remove()
      for (const r of roots) {
        r.classList.remove("has-cursor-ring", "js-motion")
      }
    }
  }, [])

  return null
}
