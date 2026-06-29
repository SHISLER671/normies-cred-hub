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
  category: string;
  url: string;
}

interface ZuloRecommendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendations: Recommendation[];
  isLoading?: boolean;
  error?: string;
}

export function ZuloRecommendsModal({ 
  isOpen, 
  onClose, 
  recommendations, 
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
            Tool suggestions based on this agent&apos;s on-chain profile and current activity.
          </DialogDescription>
        </DialogHeader>

        <div className="modal-scroll-region custom-scroll px-4 py-3 sm:px-6 sm:py-4">
          <div className="mb-4 border-l-2 border-primary/40 bg-muted/40 px-3 py-2.5 sm:mb-5 sm:px-4 sm:py-3">
            <p className="text-xs font-medium tracking-[1.5px] text-primary">WHO IS ZULO?</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
              Zulo is Normie #7141, an awakened ERC-8004 agent on Normies. He reviews on-chain
              signals — traits, canvas state, and activity — and suggests tools that fit your
              agent&apos;s current needs. He will never request keys, transactions, or approvals.
            </p>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center sm:py-16">
              <div className="text-sm text-muted-foreground">Analyzing on-chain signals…</div>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm whitespace-pre-wrap text-muted-foreground sm:py-10">
              {error}
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              {recommendations.map((rec, index) => (
                <div 
                  key={index} 
                  className="group card rounded-none border border-border p-4 transition-all hover:border-primary/30 hover:shadow-md sm:p-5"
                >
                  <h3 className="font-semibold text-base tracking-tight sm:text-lg">{rec.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                    {rec.reason}
                  </p>

                  <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="w-fit rounded-none border border-border bg-muted px-3 py-1 text-sm text-muted-foreground">
                      {rec.category}
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