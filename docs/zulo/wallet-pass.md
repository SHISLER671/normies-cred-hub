# Record card wallet pass (Google Wallet)

Drafted 2026-11-10 (ChST) by Claude.

> **Status: PARKED (Ryan, 2026-11-10).** The code is built, tested and switched off: with no `GOOGLE_WALLET_*` env vars, the button is hidden and the route returns 404, so merging changes nothing for visitors. Not a priority right now. Pick it up with "How to finish" below.

Apple Wallet is not built (see below).

## How to finish (in order)

1. **Review and merge** PR #155 (draft). Safe to merge while parked: it is off without the env vars.
2. **Google setup** (one time, about 30 minutes): steps 1–5 in "Turning it on" below. Use demo mode first.
3. **Test on a real Android phone**: open `/record/7141`, tap "Add to Google Wallet", save, and check the logo, big image and text read well. Tap Add again after a few minutes and confirm the same card updates (no second card).
4. **Clear the loose ends** below: a 660×660 logo, Google's official badge for the button, and a crop of the big image if it looks off.
5. **Ask Google for publishing access** in the Wallet console. Only after approval can anyone outside your test accounts save a pass.
6. **Optional later**: Apple Wallet (section at the end) and a scheduled refresh so saved cards stay current.

To switch it off again at any time: remove any one of the three env vars and redeploy.

## What it is

An "Add to Google Wallet" button on `/record/{tokenId}`. It saves a read-only snapshot of the Normie's record card to the phone's wallet app: name, Normie and agent number, trust gate, Pulse level, level, pixels on this Normie, Arena status line, and the as-of time. The QR code and link open the live record page.

Inspired by ERC-8426 (Wallet Pass Extension for NFTs, draft). **This is not ERC-8426.** That standard puts a `passURI` function inside the token contract, and NCH doesn't own the Normies contract or the ERC-8004 registry. If the Normies team ever adds ERC-8426, NCH can read their `passURI` instead.

## Safety (matches AGENTS.md)

- **Read-only.** A plain link. No wallet connection, no signature from the visitor, nothing on-chain.
- **No wallet details on the pass.** No owner, delegate, address or ENS name, so there is nothing to hide (tests fail if an address appears).
- **No comms.** The pass never sets `notifyPreference` or messages, so an update never pings anyone (tests check this).
- **One pass per Normie** (`{issuer}.nch_normie_{tokenId}`). Tapping Add writes the latest snapshot to that pass, so everyone who saved it sees the newer numbers next time they open it, silently.
- Route is rate-limited (`google-wallet` bucket), every Google call has an 8 s timeout, Google's error text is never returned, failures are not cached, and the same Normie isn't re-sent more than once every 5 minutes per server.
- The service-account key is server-only and can only manage Wallet passes (scope `wallet_object.issuer`). It can't touch any chain or wallet.

## Files

- `lib/wallet-pass/google-pass.ts`: pure pass builder, config reader and RS256 JWT signing (`node:crypto`, no new dependency).
- `lib/wallet-pass/google-api.ts`: Google Wallet API calls (sign-in, class, upsert pass).
- `app/api/zulo/record-card/[tokenId]/google-wallet/route.ts`: upserts the pass, then 303-redirects to Google's save page.
- `app/record/[tokenId]/page.tsx`: shows the button only when configured and the Normie is awakened.
- Tests: `lib/wallet-pass/google-pass.test.ts`.

## Turning it on (Ryan, one time)

1. Google Pay & Wallet Console (pay.google.com/business/console) → create an issuer account → note the **Issuer ID** (digits).
2. Google Cloud console → new project → enable the **Google Wallet API**.
3. Create a **service account** in that project → create a JSON key → keep the file private (never in git).
4. Back in the Wallet console → Users → invite the service account's email as a user.
5. Vercel → Project → Settings → Environment Variables (server-side, not `NEXT_PUBLIC_`):
   - `GOOGLE_WALLET_ISSUER_ID` = the Issuer ID
   - `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL` = `client_email` from the JSON key
   - `GOOGLE_WALLET_PRIVATE_KEY` = `private_key` from the JSON key (the `\n` sequences are fine as-is)
6. Redeploy. While the issuer is in **demo mode**, only test accounts you add in the console can save passes. Request publishing access in the console before announcing it.

Unset any of the three to turn the feature off: the button disappears and the route returns 404.

## Loose ends (before publishing access)

- **Logo size.** `public/images/NLOGO.png` is 92×96. Google wants a square logo, ideally 660×660 PNG. Add a bigger one and point the pass at it.
- **Official button.** Google's brand rules ask for their "Add to Google Wallet" badge before going public. The current button is plain text in NCH style.
- **Hero image** is the 1200×630 share image (`/record/{id}/opengraph-image`). Google recommends 1032×336; check it on a real phone and crop if it looks off.
- **Snapshot, not live.** The pass shows the numbers from the last time anyone tapped Add for that Normie, with the as-of time. A scheduled refresh could keep passes current later, if wanted.

## Apple Wallet (not built)

Needs an Apple Developer Program membership ($99/year), a Pass Type ID certificate, and PKCS#7 signing of the `.pkpass` bundle, which needs a new dependency (e.g. `passkit-generator`). Same safety rules would apply. Decide after Google is live and looks right.
