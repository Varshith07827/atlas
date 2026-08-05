import { isCloud, supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import type { AuthUser } from './backend'

const LOCAL_USER_KEY = 'atlas.local.user'

function localUser(): AuthUser {
  const raw = localStorage.getItem(LOCAL_USER_KEY)
  if (raw) {
    try {
      return JSON.parse(raw) as AuthUser
    } catch {
      /* fall through and mint a new one */
    }
  }
  const user: AuthUser = {
    id: uid(),
    email: 'you@thisdevice',
    display_name: 'You',
    avatar_url: null,
  }
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user))
  return user
}

function toAuthUser(u: {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}): AuthUser {
  const meta = u.user_metadata ?? {}
  return {
    id: u.id,
    email: u.email ?? '',
    display_name:
      (meta.display_name as string) ?? (meta.full_name as string) ?? (meta.name as string) ?? null,
    avatar_url: (meta.avatar_url as string) ?? null,
  }
}

export const auth = {
  /** In local mode there is always a signed-in device user. */
  async currentUser(): Promise<AuthUser | null> {
    if (!isCloud) return localUser()
    const { data } = await supabase!.auth.getSession()
    return data.session ? toAuthUser(data.session.user) : null
  },

  onChange(cb: (user: AuthUser | null) => void): () => void {
    if (!isCloud) return () => {}
    const { data } = supabase!.auth.onAuthStateChange((_event, session) => {
      cb(session ? toAuthUser(session.user) : null)
    })
    return () => data.subscription.unsubscribe()
  },

  async signIn(email: string, password: string) {
    if (!isCloud) return
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error) throw error
  },

  async signUp(email: string, password: string, displayName: string) {
    if (!isCloud) return
    const { error } = await supabase!.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) throw error
  },

  /** Passwordless. The link returns to the current origin + hash route. */
  async signInWithMagicLink(email: string) {
    if (!isCloud) return
    const { error } = await supabase!.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    })
    if (error) throw error
  },

  async resetPassword(email: string) {
    if (!isCloud) return
    const { error } = await supabase!.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    })
    if (error) throw error
  },

  async updateDisplayName(name: string) {
    if (!isCloud) {
      const u = localUser()
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify({ ...u, display_name: name }))
      return
    }
    const { error } = await supabase!.auth.updateUser({ data: { display_name: name } })
    if (error) throw error
  },

  async signOut() {
    if (!isCloud) return
    await supabase!.auth.signOut()
  },
}
