import { useEffect, useState, useCallback } from 'react'
import { bootstrap, phpAuth } from '../lib/phpApi'

const toState = (user) => {
  const role = user?.role || null
  const staff = ['owner', 'operations', 'technician'].includes(role)
  return { loading: false, gid: null, role: staff ? role : null, isOwner: role === 'owner', signedIn: staff, user: staff ? user : null }
}

// The PHP session is the single source of truth for staff identity and role.
export function useTeamRole() {
  const [state, setState] = useState({ loading: true, gid: null, role: null, isOwner: false, signedIn: false, user: null })
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }))
    try { setState(toState(await bootstrap(true))) }
    catch { setState(toState(null)) }
  }, [])
  useEffect(() => {
    const unsubscribe = phpAuth.subscribe((user) => setState(toState(user)))
    bootstrap().then((user) => setState(toState(user))).catch(() => setState(toState(null)))
    return unsubscribe
  }, [])
  return { ...state, refresh: load }
}
