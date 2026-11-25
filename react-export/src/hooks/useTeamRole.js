import { useEffect, useState, useCallback } from 'react'
import { bootstrap, phpAuth } from '../lib/phpApi'

// The PHP session is the single source of truth for staff identity and role.
export function useTeamRole() {
  const [state, setState] = useState({ loading: true, gid: null, role: null, isOwner: false, signedIn: false, user: null })
  const load = useCallback(async () => {
    try {
      const user = await bootstrap(true)
      const role = user?.role || null
      const staff = ['owner', 'operations', 'technician'].includes(role)
      setState({ loading: false, gid: null, role: staff ? role : null, isOwner: role === 'owner', signedIn: staff, user: staff ? user : null })
    } catch {
      setState({ loading: false, gid: null, role: null, isOwner: false, signedIn: false, user: null })
    }
  }, [])
  useEffect(() => {
    load()
    const unsubscribe = phpAuth.subscribe(() => load())
    return unsubscribe
  }, [load])
  return { ...state, refresh: load }
}
