"use client"

import {
  ZULO_RECOMMENDATIONS_DYOR,
  type ZuloResponse,
} from "@/lib/agent-recommendations"
import { cn } from "@/lib/utils"

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-[1.5px] text-primary">
      {children}
    </p>
  )
}

export function ResponseCard({
  response,
  className,
}: {
  response: ZuloResponse
  className?: string
}) {
  const recommendations = Array.isArray(response.recommendation)
    ? response.recommendation
    : [response.recommendation]

  const confidence =
    typeof response.confidence === "number" && Number.isFinite(response.confidence)
      ? Math.max(0, Math.min(100, Math.round(response.confidence)))
      : null

  return (
    <div
      className={cn(
        "space-y-4 rounded-none border border-border bg-card/80 p-4 sm:p-5",
        className,
      )}
    >
      <section className="space-y-1.5">
        <FieldLabel>Understanding</FieldLabel>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {response.understanding}
        </p>
      </section>

      <section className="space-y-1.5 border-t border-border pt-4">
        <FieldLabel>Recommendation</FieldLabel>
        {recommendations.length === 1 ? (
          <p className="text-sm font-medium leading-relaxed text-foreground">
            {recommendations[0]}
          </p>
        ) : (
          <ol className="list-decimal space-y-2 pl-4 text-sm font-medium leading-relaxed text-foreground">
            {recommendations.map((item, i) => (
              <li key={`${i}-${item.slice(0, 24)}`}>{item}</li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-1.5 border-t border-border pt-4">
        <FieldLabel>Reasoning</FieldLabel>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {response.reasoning}
        </p>
      </section>

      {response.nextSteps.length > 0 ? (
        <section className="space-y-1.5 border-t border-border pt-4">
          <FieldLabel>Next steps</FieldLabel>
          <ol className="list-decimal space-y-1.5 pl-4 text-sm leading-relaxed text-foreground">
            {response.nextSteps.map((step, i) => (
              <li key={`${i}-${step.slice(0, 24)}`}>{step}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {response.sources && response.sources.length > 0 ? (
        <section className="space-y-1.5 border-t border-border pt-4">
          <FieldLabel>Sources</FieldLabel>
          <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            {response.sources.map((source, i) => {
              const isUrl = /^https?:\/\//i.test(source)
              return (
                <li key={`${i}-${source.slice(0, 32)}`} className="break-all font-mono">
                  {isUrl ? (
                    <a
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground underline-offset-2 hover:underline"
                    >
                      {source}
                    </a>
                  ) : (
                    source
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <footer className="space-y-2 border-t border-border pt-4">
        {confidence !== null ? (
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              Confidence
            </span>
            <span className="font-mono text-xs text-foreground">{confidence}%</span>
          </div>
        ) : null}
        {confidence !== null ? (
          <div className="h-1 w-full bg-muted">
            <div
              className="h-1 bg-foreground/80 transition-[width] duration-300"
              style={{ width: `${confidence}%` }}
              aria-hidden
            />
          </div>
        ) : null}
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {ZULO_RECOMMENDATIONS_DYOR}
        </p>
      </footer>
    </div>
  )
}
