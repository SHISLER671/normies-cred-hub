import type { ArenaRoundHistory } from "@/lib/record-card/types"

const utcDay = (iso: string) => new Date(iso).toUTCString().slice(5, 16)
const utcTime = (iso: string) => new Date(iso).toUTCString().replace(" GMT", " UTC")

/**
 * A Normie's Arena rounds, newest first, with the raw counts beside the list. Official data only: which rounds it played
 * and each round's status and date. No per-round win and no amounts. A round in progress is never shown as an ending.
 */
export function ArenaRoundHistoryList({ history }: { history: ArenaRoundHistory }) {
  const t = history.totals
  return (
    <div style={{ marginTop: 20 }}>
      <p className="rc-lead" style={{ marginBottom: 8 }}>
        <strong>Rounds.</strong> {history.status_text}.
      </p>
      {history.rounds.length > 0 && (
        <dl className="rc-dl">
          {history.rounds.map((r) => (
            <div key={r.round}>
              <dt>
                Round {r.round}
                {r.date ? <span className="rc-pending"> · {utcDay(r.date)}</span> : null}
              </dt>
              <dd>{r.state === "unreadable" ? <span className="rc-pending">{r.text}</span> : r.text}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="caption">
        {t && t.listed > 0 && (
          <>
            Raw counts: {t.listed} listed · {t.in_progress} in progress · {t.played + t.did_not_play} finished ({t.played} played,{" "}
            {t.did_not_play} did not play)
            {t.cancelled > 0 ? ` · ${t.cancelled} cancelled` : ""}
            {t.not_started > 0 ? ` · ${t.not_started} not started` : ""}
            {t.unreadable > 0 ? ` · ${t.unreadable} couldn't be read` : ""}.{" "}
            {history.complete === false ? `NCH reads at most ${history.max_pages} pages of the list. ` : ""}
            A round in progress has no result yet.{" "}
          </>
        )}
        Source: {history.source.label}, as of {utcTime(history.as_of)}.
      </p>
    </div>
  )
}
