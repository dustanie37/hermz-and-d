// useEventState.js — Phase 12d: one hook for "where are we in the active event?"
//
// Returns the active (non-published) event, this player's event_players state,
// and the blackout flag. Blackout (scope §5): while a player is in the
// 'scoring' state, FOR THAT PLAYER ONLY, prior-edition ranking data is hidden —
// MoviesList blocks entirely, MovieDetail hides its ranking-history sections.
// The other player's site is untouched.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../context/AuthContext'

export function useEventState() {
  const { session } = useAuth()
  const user = session?.user
  const [state, setState] = useState({ loading: true, event: null, myState: null, players: [] })

  useEffect(() => {
    if (!user) { setState({ loading: false, event: null, myState: null, players: [] }); return }
    let alive = true
    async function load() {
      const { data: events } = await supabase
        .from('ranking_events').select('*').neq('status', 'published')
        .order('created_at', { ascending: false }).limit(1)
      const ev = events?.[0] ?? null
      if (!ev) { if (alive) setState({ loading: false, event: null, myState: null, players: [] }); return }
      const { data: players } = await supabase
        .from('event_players').select('*').eq('event_id', ev.id)
      const me = (players || []).find(p => p.user_id === user.id)
      if (alive) setState({ loading: false, event: ev, myState: me?.state ?? null, players: players || [] })
    }
    load()
    return () => { alive = false }
  }, [user])

  return { ...state, blackout: state.myState === 'scoring' }
}
