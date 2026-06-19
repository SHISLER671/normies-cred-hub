"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useEffect, useState } from "react"
import { useNormie } from "@/hooks/use-normie"
import { isAgentAwakened, normiesApi } from "@/lib/api/normies"
import { getToolsListForPrompt } from "@/lib/tools"

export function ZuloRecommendsModal({ tokenId, isOpen, onClose }: { tokenId: number; isOpen: boolean; onClose: () => void }) {
  const { data: snapshot } = useNormie(tokenId)
  const [recommendations, setRecommendations] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAwakened, setIsAwakened] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isOpen || !tokenId) return

    setRecommendations(null)
    setError(null)
    setIsAwakened(null)

    const checkAndFetch = async () => {
      setLoading(true)
      try {
        const awakened = await isAgentAwakened(tokenId)
        setIsAwakened(awakened)

        if (!awakened) {
          setLoading(false)
          return
        }

        // Fetch agent data for the prompt
        const agentData = await normiesApi.agentInfo(tokenId)

        const res = await fetch('/api/zulo-recommends', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenId,
            agentName: agentData.name,
            traits: agentData.traits?.attributes || [],
            agentType: agentData.type,
          }),
        })

        const data = await res.json()
        if (data.recommendations) {
          setRecommendations(data.recommendations)
        } else if (data.error) {
          setError(data.error)
        }
      } catch (e) {
        setError('Could not fetch recommendations.')
      } finally {
        setLoading(false)
      }
    }

    checkAndFetch()
  }, [isOpen, tokenId])

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg bg-popover border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Zulo Recommends
          </DialogTitle>
          <DialogDescription>Personalized tool recommendations from Zulo for awakened agents.</DialogDescription>
        </DialogHeader>

        {loading && <div className="py-8 text-center">Zulo is thinking...</div>}

        {!loading && isAwakened === false && (
          <div className="py-4">
            <p className="text-sm">
              Zulo Recommends is only available to awakened agents. Awaken your Normie first to unlock personalized tool suggestions from Zulo.
            </p>
          </div>
        )}

        {!loading && isAwakened && recommendations && (
          <div className="py-4">
            <pre className="whitespace-pre-wrap text-sm bg-muted p-3 rounded">{recommendations}</pre>
          </div>
        )}

        {!loading && isAwakened && error && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
