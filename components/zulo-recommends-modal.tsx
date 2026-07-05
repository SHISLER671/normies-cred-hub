'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ZULO_DYOR_LONG, ZULO_DYOR_SHORT } from "@/lib/zulo/constants";
import type { ZuloPulseContext } from "@/lib/zulo/recommendations";
import type { ZuloTransparency } from "@/lib/zulo/transparency";
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export interface Recommendation {
  name: string;
  reason: string;
  pulseRationale?: string;
  category: string;
  url: string;
  source?: 'normies' | 'agent-tools';
  toolId?: number;
  chain?: string;
  accessNote?: string;
}

const LOADING_STEPS = [
  'Reading Pulse via Normies Cred Pulse…',
  'Discovering ERC-8257 Agent Tools…',
  'Ranking tools by context and gaps…',
  'Zulo analyzing and explaining picks…',
] as const;

interface ZuloRecommendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendations: Recommendation[];
  summary?: string;
  pulseContext?: ZuloPulseContext;
  transparency?: ZuloTransparency;
  isLoading?: boolean;
  error?: string;
  onRefresh?: () => void;
}

function PulseContextCard({ pulse }: { pulse: ZuloPulseContext }) {
  return (
    <div className="rounded-none border border-border bg-card/50 px-3 py-3 sm:px-4">
      <p className="text-[10px] font-medium uppercase tracking-[1.5px] text-primary">
        Pulse at decision time
      </p>
      <p className="mt-1.5 text-sm font-medium text-foreground">
        {pulse.level}/{pulse.maxLevel} — {pulse.status}
      </p>
      {pulse.breakdown.length > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Signals: {pulse.breakdown.join(' · ')}
        </p>
      ) : null}
      {pulse.gaps.length > 0 ? (
        <p className="mt-1 text-xs text-primary/80">
          Gaps: {pulse.gaps.join(' · ')}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">All four current Pulse signals present.</p>
      )}
    </div>
  );
}

function TransparencyPanel({ transparency }: { transparency: ZuloTransparency }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-none border border-border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left sm:px-4"
        aria-expanded={open}
      >
        <span className="text-xs font-medium uppercase tracking-[1.5px] text-primary">
          How Zulo decided
          {transparency.cached ? (
            <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">
              (cached)
            </span>
          ) : null}
        </span>
        {open ? (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open ? (
        <div className="space-y-2 border-t border-border px-3 py-3 sm:px-4">
          {transparency.steps.map((step) => (
            <div key={step.id} className="flex gap-2.5 text-xs sm:text-sm">
              {step.status === 'ok' ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500/90" aria-hidden />
              ) : step.status === 'unavailable' ? (
                <Circle className="mt-0.5 size-4 shrink-0 text-amber-500/80" aria-hidden />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <div>
                <p className="font-medium text-foreground">{step.label}</p>
                <p className="mt-0.5 leading-relaxed text-muted-foreground">{step.detail}</p>
              </div>
            </div>
          ))}
          <p className="pt-1 text-[10px] text-muted-foreground">
            Pulse source: {transparency.pulseEndpoint} · Generated{' '}
            {new Date(transparency.generatedAt).toLocaleString()}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function LoadingState() {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((i) => (i + 1) % LOADING_STEPS.length)
    }, 2200)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center sm:py-16">
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
      <div className="space-y-1.5">
        {LOADING_STEPS.map((step, i) => (
          <p
            key={step}
            className={cn(
              'text-sm transition-opacity',
              i === stepIndex ? 'text-foreground' : 'text-muted-foreground/50',
            )}
          >
            {step}
          </p>
        ))}
      </div>
    </div>
  );
}

export function ZuloRecommendsModal({ 
  isOpen, 
  onClose, 
  recommendations,
  summary,
  pulseContext,
  transparency,
  isLoading = false,
  error,
  onRefresh,
}: ZuloRecommendsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!flex h-[min(90vh,720px)] max-h-[90vh] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[620px] max-md:h-[92dvh] max-md:max-h-[92dvh]">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle className="pr-8 font-heading text-xl tracking-tight sm:text-2xl">
            Zulo Recommends
          </DialogTitle>
          <DialogDescription className="text-left text-xs sm:text-sm">
            Pulse-aware, explained tool picks — transparent steps, DYOR always.
          </DialogDescription>
        </DialogHeader>

        <div className="modal-scroll-region custom-scroll px-4 py-3 sm:px-6 sm:py-4">
          <div className="mb-4 border-l-2 border-primary/40 bg-muted/40 px-3 py-2.5 sm:mb-5 sm:px-4 sm:py-3">
            <p className="text-xs font-medium tracking-[1.5px] text-primary">WHO IS ZULO?</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
              Zulo is Normie #7141. He reads Pulse, ranks Normies + Agent Tools, shows his work,
              and explains every pick. He will never request keys, transactions, or approvals.
            </p>
          </div>

          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <div className="py-8 text-center text-sm whitespace-pre-wrap text-muted-foreground sm:py-10">
              {error}
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              {pulseContext ? <PulseContextCard pulse={pulseContext} /> : null}

              {transparency ? (
                <div className="space-y-2">
                  <TransparencyPanel transparency={transparency} />
                  {onRefresh && transparency.cached ? (
                    <button
                      type="button"
                      onClick={onRefresh}
                      className="text-xs text-primary hover:underline"
                    >
                      Refresh recommendations (bypasses cache)
                    </button>
                  ) : null}
                </div>
              ) : null}

              {summary ? (
                <p className="border-l-2 border-primary/30 bg-card/40 px-3 py-2.5 text-sm leading-relaxed text-foreground/90 text-pretty sm:px-4">
                  <span className="text-[10px] font-medium uppercase tracking-[1.5px] text-primary">
                    Zulo&apos;s take
                  </span>
                  <span className="mt-1 block">{summary}</span>
                </p>
              ) : null}

              {recommendations.map((rec, index) => (
                <div 
                  key={index} 
                  className="group card rounded-none border border-border p-4 transition-all hover:border-primary/30 hover:shadow-md sm:p-5"
                >
                  <h3 className="font-semibold text-base tracking-tight sm:text-lg">{rec.name}</h3>

                  {rec.pulseRationale ? (
                    <p className="mt-2 text-xs leading-relaxed text-primary/90 sm:text-sm">
                      <span className="font-medium tracking-wide">Pulse: </span>
                      {rec.pulseRationale}
                    </p>
                  ) : null}

                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                    {rec.reason}
                  </p>

                  {rec.source === 'agent-tools' && rec.accessNote ? (
                    <p className="mt-2 text-xs text-muted-foreground/90">
                      Access: {rec.accessNote}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                      <div className="w-fit rounded-none border border-border bg-muted px-3 py-1 text-sm text-muted-foreground">
                        {rec.category}
                      </div>
                      {rec.source === 'agent-tools' && rec.toolId != null ? (
                        <div className="w-fit rounded-none border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
                          Tool #{rec.toolId}{rec.chain ? ` · ${rec.chain}` : ''}
                        </div>
                      ) : null}
                    </div>
                    
                    <a 
                      href={rec.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="glow-primary rounded-none border border-border px-5 py-2.5 text-center text-sm transition-all hover:bg-primary hover:text-primary-foreground sm:w-auto"
                    >
                      Visit Tool
                    </a>
                  </div>
                </div>
              ))}

              <div className="space-y-1 border-t border-border/60 pt-3">
                <p className="text-[10px] leading-relaxed text-muted-foreground">{ZULO_DYOR_SHORT}</p>
                <p className="text-[10px] leading-relaxed text-muted-foreground/80">{ZULO_DYOR_LONG}</p>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground sm:py-10">
              No recommendations available.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}