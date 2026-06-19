'use client';

import { X } from 'lucide-react';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 p-0 md:p-6">
      <div className="bg-zinc-950 border border-white/10 w-full md:max-w-[620px] rounded-t-3xl md:rounded-3xl flex flex-col max-h-[92vh] md:max-h-[82vh]">
        
        {/* Header */}
        <div className="flex justify-between items-start p-6 pb-5 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Zulo Recommends</h2>
            <p className="text-zinc-400 text-sm mt-1">
              Personalized tool suggestions for your awakened agent.
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-zinc-400 hover:text-white transition-colors p-1 -mr-2"
          >
            <X size={22} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-5 custom-scroll">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-zinc-400">Zulo is analyzing your agent...</div>
            </div>
          ) : error ? (
            <div className="text-center py-10 text-zinc-400 text-sm whitespace-pre-wrap">
              {error}
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <div 
                  key={index} 
                  className="group border border-white/10 hover:border-white/20 rounded-2xl p-5 transition-colors bg-zinc-900/40"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg tracking-tight">{rec.name}</h3>
                      <p className="text-zinc-400 mt-2 text-[15px] leading-relaxed">
                        {rec.reason}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs px-3 py-1 rounded-full bg-white/5 text-zinc-400 border border-white/10">
                      {rec.category}
                    </div>
                    
                    <a 
                      href={rec.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm px-5 py-2 rounded-xl border border-white/20 hover:bg-white hover:text-black transition-all"
                    >
                      Visit Tool
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-zinc-400">
              No recommendations available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
