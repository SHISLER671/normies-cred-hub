"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { tools, Tool, getTools } from "@/lib/tools";

export function ToolsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "category">("name");
  const [toolList, setToolList] = useState<Tool[]>(tools);
  const [loading, setLoading] = useState(false);

  // Load dynamic list when modal opens
  if (isOpen && !loading && toolList === tools) {
    setLoading(true);
    getTools().then((fetched) => {
      setToolList(fetched);
      setLoading(false);
    }).catch(() => {
      setToolList(tools);
      setLoading(false);
    });
  }

  const filteredTools = [...toolList]
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] bg-popover border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Browse Tools
          </DialogTitle>
          <DialogDescription>
            Explore community-built tools for Normies agents. Open to everyone.
            Some may be further gated on-chain via TraitGatedPredicate + AgentCheck (see Trust &amp; Gate Signals).
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Search tools..."
            className="flex-1 bg-card border border-border rounded px-3 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "name" | "category")}
            className="bg-card border border-border rounded px-3 text-sm"
          >
            <option value="name">Alphabetical</option>
            <option value="category">Category</option>
          </select>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading tools...</p>}

        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
          {filteredTools.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">No tools match your search.</p>
          )}
          {filteredTools.map((tool) => (
            <div key={tool.id} className="border border-border rounded-lg p-4 bg-card">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="font-medium text-base">{tool.name}</h3>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {tool.category}
                  </span>
                </div>
                <a
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-sm hover:underline whitespace-nowrap"
                >
                  Visit →
                </a>
              </div>
              <p className="text-sm text-muted-foreground mt-2 leading-snug">{tool.description}</p>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground mt-2">
          Tools curated from community sources including https://www.normies.art/tools. Dynamic list updates on load.
        </p>
      </DialogContent>
    </Dialog>
  );
}
