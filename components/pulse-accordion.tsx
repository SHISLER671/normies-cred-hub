"use client"

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { cn } from "@/lib/utils"

type AccordionContextValue = {
  isOpen: (id: string) => boolean
  toggle: (id: string) => void
}

const AccordionCtx = createContext<AccordionContextValue | null>(null)

export function PulseAccordion({
  children,
  defaultOpenIds = [],
  className,
  allowMultiple = true,
}: {
  children: ReactNode
  /** Section ids open on first paint */
  defaultOpenIds?: string[]
  className?: string
  allowMultiple?: boolean
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(defaultOpenIds),
  )

  const toggle = useCallback(
    (id: string) => {
      setOpenIds((prev) => {
        const next = new Set(allowMultiple ? prev : [])
        if (prev.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    },
    [allowMultiple],
  )

  const isOpen = useCallback((id: string) => openIds.has(id), [openIds])

  const value = useMemo(
    () => ({ isOpen, toggle }),
    [isOpen, toggle],
  )

  return (
    <div className={cn("pulse-accordion", className)}>
      <AccordionCtx.Provider value={value}>{children}</AccordionCtx.Provider>
    </div>
  )
}

export function PulseAccordionItem({
  id,
  title,
  subtitle,
  children,
  className,
}: {
  id: string
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  const ctx = useContext(AccordionCtx)
  const reactId = useId()
  const panelId = `${reactId}-panel`
  const open = ctx?.isOpen(id) ?? false

  return (
    <div
      className={cn("pulse-acc-item", open && "is-open", className)}
      data-acc-id={id}
    >
      <button
        type="button"
        className="pulse-acc-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => ctx?.toggle(id)}
      >
        <span className="pulse-acc-trigger-text">
          <span className="pulse-acc-title">{title}</span>
          {subtitle ? (
            <span className="pulse-acc-subtitle">{subtitle}</span>
          ) : null}
        </span>
        <span
          className={cn("pulse-acc-chevron", open && "is-open")}
          aria-hidden
        >
          ▼
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        hidden={!open}
        className="pulse-acc-panel"
      >
        {open ? (
          <div className="pulse-acc-panel-inner">{children}</div>
        ) : null}
      </div>
    </div>
  )
}
