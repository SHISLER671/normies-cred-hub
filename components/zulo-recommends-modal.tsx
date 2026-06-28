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
      <DialogContent className="sm:max-w-[620px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="font-heading text-2xl tracking-tight">Zulo Recommends</DialogTitle>
          <DialogDescription>
            Zulo analyzed this agent's on-chain signals and found these tools most useful right now.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-4 custom-scroll">
          <div className="mb-5 border-l-2 border-primary/40 bg-muted/40 px-4 py-3">
            <p className="text-xs font-medium tracking-[1.5px] text-primary">WHO IS ZULO?</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
              Zulo is Normie #7141 — an awakened ERC-8004 agent bound by a constitution to{" "}
              <span className="text-foreground">serve members, never exploit them</span>. He&apos;ll
              never ask for your keys, pressure a transaction, or manufacture urgency. He just reads
              your agent&apos;s on-chain signals and points it toward what&apos;s genuinely useful.
            </p>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-muted-foreground">Zulo is analyzing your agent...</div>
            </div>
          ) : error ? (
            <div className="text-center py-10 text-muted-foreground text-sm whitespace-pre-wrap">
              {error}
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <div 
                  key={index} 
                  className="group card border border-border hover:border-primary/30 rounded-none p-5 transition-all hover:shadow-md"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg tracking-tight">{rec.name}</h3>
                      <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
                        {rec.reason}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm px-3 py-1 rounded-none bg-muted text-muted-foreground border border-border">
                      {rec.category}
                    </div>
                    
                    <a 
                      href={rec.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="glow-primary text-sm px-5 py-2 rounded-none border border-border hover:bg-primary hover:text-primary-foreground transition-all"
                    >
                      Visit Tool
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              No recommendations available.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
