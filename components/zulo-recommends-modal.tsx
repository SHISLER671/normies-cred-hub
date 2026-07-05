'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

interface ZuloRecommendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendations: Recommendation[];
  summary?: string;
  isLoading?: boolean;
  error?: string;
}

export function ZuloRecommendsModal({ 
  isOpen, 
  onClose, 
  recommendations,
  summary,
  isLoading = false,
  error
}: ZuloRecommendsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!flex h-[min(90vh,720px)] max-h-[90vh] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[620px] max-md:h-[92dvh] max-md:max-h-[92dvh]">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle className="pr-8 font-heading text-xl tracking-tight sm:text-2xl">
            Zulo Recommends
          </DialogTitle>
          <DialogDescription className="text-left text-xs sm:text-sm">
            Pulse-aware tool suggestions with explanations — based on this agent&apos;s on-chain profile.
          </DialogDescription>
        </DialogHeader>

        <div className="modal-scroll-region custom-scroll px-4 py-3 sm:px-6 sm:py-4">
          <div className="mb-4 border-l-2 border-primary/40 bg-muted/40 px-3 py-2.5 sm:mb-5 sm:px-4 sm:py-3">
            <p className="text-xs font-medium tracking-[1.5px] text-primary">WHO IS ZULO?</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
              Zulo is Normie #7141, an awakened ERC-8004 agent on Normies. He reads Pulse via Normies Cred
              Pulse, reviews traits and canvas state, then explains why each tool fits. He will never
              request keys, transactions, or approvals.
            </p>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center sm:py-16">
              <div className="text-sm text-muted-foreground">Reading Pulse and ranking tools…</div>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm whitespace-pre-wrap text-muted-foreground sm:py-10">
              {error}
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              {summary ? (
                <p className="border-l-2 border-primary/30 bg-card/40 px-3 py-2.5 text-sm leading-relaxed text-foreground/90 text-pretty sm:px-4">
                  {summary}
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

              <p className="pt-1 text-[10px] leading-relaxed text-muted-foreground">
                DYOR — tool access rules and endpoints can change. Zulo explains his reasoning; you decide what to use.
              </p>
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