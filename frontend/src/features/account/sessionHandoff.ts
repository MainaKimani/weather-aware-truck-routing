/**
 * Leaving the account page after the session ends. Its guard would send a
 * signed-out visitor to log in, and navigation finishes after the session
 * refresh would, so the page doesn't refresh it: it says what happened in
 * the navigation's state, and the planner refreshes once it is on screen.
 */
import type { QueryClient } from '@tanstack/react-query'

import { refreshSession } from '../../api/auth'

export type SessionEnded = 'signed_out' | 'deleted'

export interface HandoffState {
  sessionEnded?: SessionEnded
}

export function sessionEndedIn(state: unknown): SessionEnded | null {
  const value = (state as HandoffState | null)?.sessionEnded
  return value === 'signed_out' || value === 'deleted' ? value : null
}

/** Run by the planner on arrival: forget what the ended session could see. */
export async function finishSessionEnd(queryClient: QueryClient, ended: SessionEnded) {
  if (ended === 'deleted') queryClient.removeQueries({ queryKey: ['trips'] })
  await refreshSession(queryClient)
}
