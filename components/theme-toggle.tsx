'use client'

import { useTheme } from 'next-themes'
import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
} from 'react'

/**
 * Light / dark toggle for shared chrome.
 * Moon in light mode, sun in dark mode. Monochrome SVG, 44px target.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === 'dark'

  const toggle = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark')
  }, [isDark, setTheme])

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggle()
      }
    },
    [toggle],
  )

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      onKeyDown={onKeyDown}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      aria-pressed={mounted ? isDark : undefined}
    >
      {/* Pre-mount: neutral moon to avoid layout shift; no theme flash (html class set early) */}
      {isDark ? (
        <svg
          className="theme-toggle-icon"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="square"
          strokeLinejoin="miter"
          aria-hidden
        >
          {/* Sun */}
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg
          className="theme-toggle-icon"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="square"
          strokeLinejoin="miter"
          aria-hidden
        >
          {/* Moon */}
          <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" />
        </svg>
      )}
      <span className="sr-only">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  )
}
