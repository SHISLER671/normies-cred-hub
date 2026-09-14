import Link from "next/link"

const X_PROFILE = "https://x.com/zulo7141"

/** Contact line for the thin site footer. No wallet addresses, TBA, or hot keys. */
export function SiteFooterContact() {
  return (
    <p className="site-footer-contact mono">
      shisler671.eth
      {" · "}
      <a href={X_PROFILE} target="_blank" rel="noopener noreferrer">
        @zulo7141
      </a>
      {" · "}
      <Link href="/privacy">Privacy</Link>
      {" · "}
      <Link href="/terms">Terms</Link>
    </p>
  )
}

/** Thin site footer — home, Ask, Moves, PULSE, legal, 404. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <SiteFooterContact />
      </div>
    </footer>
  )
}
