import Link from "next/link"

const X_PROFILE = "https://x.com/zulo7141"

/** Contact line for the thin site footer. No wallet addresses, TBA, or hot keys. */
export function SiteFooterContact() {
  return (
    <p className="site-footer-contact mono">
      shisler671.eth
      {" · "}
      <a
        href={X_PROFILE}
        className="footer-zulo"
        target="_blank"
        rel="noopener noreferrer"
      >
        @zulo7141
      </a>
      {" · "}
      <Link href="/privacy">Privacy</Link>
      {" · "}
      <Link href="/terms">Terms</Link>
    </p>
  )
}

/** The one site footer, on every page. `extra` adds a page's own line (e.g. where the dashboard's data comes from). */
export function SiteFooter({ extra }: { extra?: React.ReactNode } = {}) {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p className="site-footer-note">
          Read-only. We never ask for a transaction, an approval or a transfer. At most one free message to prove you own a wallet.
        </p>
        {extra ? <p className="site-footer-note">{extra}</p> : null}
        <p className="site-footer-note site-footer-independent">Independent community tool, not made or endorsed by the Normies team.</p>
        <SiteFooterContact />
      </div>
    </footer>
  )
}
