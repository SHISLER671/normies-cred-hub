// Legacy path — redirects to the unified Zulo experience at /zulo

import { redirect } from "next/navigation"

export default function AgentRecommendationsPage() {
  redirect("/zulo")
}
