"use client"

import { useEffect, useRef, useState } from "react"

/**
 * The phone/tablet Menu button for ZuloChromeHeader. Below 1180px the header is one compact row (wordmark + this button)
 * and the nav, wallet and theme live in a panel this opens. Progressive: without JavaScript the header never gets
 * `js-menu`, so the nav simply stays visible.
 */
export function HeaderMenuToggle({ navId }: { navId: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const header = ref.current?.closest(".header")
    if (!header) return
    header.classList.add("js-menu")
    return () => header.classList.remove("js-menu", "is-menu-open")
  }, [])

  useEffect(() => {
    const header = ref.current?.closest(".header")
    if (!header) return
    header.classList.toggle("is-menu-open", open)
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        ref.current?.focus()
      }
    }
    // A tap on a link in the panel navigates; close so the next page starts with the menu shut.
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest(`#${navId} a`)) setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    header.addEventListener("click", onClick as EventListener)
    return () => {
      document.removeEventListener("keydown", onKey)
      header.removeEventListener("click", onClick as EventListener)
    }
  }, [open, navId])

  return (
    <button
      ref={ref}
      type="button"
      className="header-menu-btn"
      aria-expanded={open}
      aria-controls={navId}
      onClick={() => setOpen((v) => !v)}
    >
      <span aria-hidden="true" className="header-menu-icon">{open ? "×" : "≡"}</span>
      <span>{open ? "Close" : "Menu"}</span>
    </button>
  )
}
