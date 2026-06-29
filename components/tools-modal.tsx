"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { tools } from "@/lib/tools";

export function ToolsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "category">("name");

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSortBy("name");
    }
  }, [isOpen]);

  const filteredTools = [...tools]
    .filter((tool) =>
      tool.name.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return a.category.localeCompare(b.category);
    });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!flex h-[min(90vh,720px)] max-h-[90vh] min-h-0 flex-col gap-0 overflow-hidden bg-popover p-0 sm:max-w-2xl max-md:h-[92dvh] max-md:max-h-[92dvh]">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle className="pr-8">Browse Tools</DialogTitle>
          <DialogDescription className="text-left text-xs sm:text-sm">
            Explore community-built tools for Normies agents. Open to everyone.
            Some may be further gated on-chain via TraitGatedPredicate + AgentCheck.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4">
          <div className="mb-3 flex shrink-0 flex-col gap-2 sm:mb-4 sm:flex-row sm:gap-3">
            <input
              type="text"
              placeholder="Search tools..."
              className="flex-1 rounded-none border border-border bg-card px-3 py-2.5 text-sm focus:border-primary/50 focus:outline-none sm:px-4"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "category")}
              className="rounded-none border border-border bg-card px-3 py-2.5 text-sm focus:border-primary/50 focus:outline-none"
            >
              <option value="name">Alphabetical</option>
              <option value="category">Category</option>
            </select>
          </div>

          <div className="mb-2 shrink-0 text-xs text-muted-foreground">
            {filteredTools.length} tools
          </div>

          <div className="modal-scroll-region custom-scroll pr-1">
            {filteredTools.length === 0 && (
              <p className="text-sm text-muted-foreground">No tools match your search.</p>
            )}
            {filteredTools.map((tool) => (
              <div
                key={tool.id}
                className="card group mb-3 rounded-none border border-border p-4 transition-all hover:border-primary/30 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold tracking-tight">{tool.name}</h3>
                    <span className="mt-1.5 inline-block rounded-none bg-muted px-2 py-0.5 text-[10px] tracking-[1.5px] text-muted-foreground">
                      {tool.category}
                    </span>
                  </div>
                  <a
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glow-primary shrink-0 rounded-none border border-border px-4 py-2 text-center text-sm transition-all hover:bg-primary hover:text-primary-foreground sm:mt-1 sm:py-1.5"
                  >
                    Visit →
                  </a>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
              </div>
            ))}
          </div>

          <p className="mt-2 shrink-0 text-[10px] text-muted-foreground">
            Tools curated from community sources including https://www.normies.art/tools.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}