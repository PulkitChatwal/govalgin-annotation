// Auth context: holds the current annotator row from Supabase.
// We deliberately do NOT cache this in localStorage — admin status is fetched
// fresh on every page load so it's always DB-authoritative.
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [annotator, setAnnotator] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch the annotator row by email. Auto-creates a non-admin row on first login.
  const loadAnnotator = useCallback(async (email) => {
    if (!email) {
      setAnnotator(null)
      return
    }
    const { data, error } = await supabase
      .from('annotators')
      .select('*')
      .eq('email', email)
      .maybeSingle()
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch annotator row:', error)
      setAnnotator(null)
      return
    }
    if (data) {
      setAnnotator(data)
      return
    }
    // First-time login: insert a stub row (non-admin). The user will be sent to
    // /select where they fill in their name and pick countries.
    const fallbackName = email.split('@')[0]
    const { data: inserted, error: insertErr } = await supabase
      .from('annotators')
      .insert({ email, name: fallbackName, is_admin: false, countries: [] })
      .select()
      .single()
    if (insertErr) {
      // eslint-disable-next-line no-console
      console.error('Failed to create annotator row:', insertErr)
      setAnnotator(null)
      return
    }
    setAnnotator(inserted)
  }, [])

  // Bootstrap: read current session and (re)fetch the annotator row.
  useEffect(() => {
    let mounted = true
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      if (session?.user?.email) {
        await loadAnnotator(session.user.email)
      }
      setLoading(false)
    }
    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        loadAnnotator(session.user.email)
      } else {
        setAnnotator(null)
      }
    })
    return () => {
      mounted = false
      sub?.subscription?.unsubscribe?.()
    }
  }, [loadAnnotator])

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setAnnotator(null)
  }, [])

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email) {
      await loadAnnotator(session.user.email)
    } else {
      setAnnotator(null)
    }
  }, [loadAnnotator])

  // Local state patcher (used after editing countries in CountrySelect).
  const setLocalAnnotator = useCallback((next) => setAnnotator(next), [])

  return (
    <AuthContext.Provider
      value={{ annotator, loading, signInWithGoogle, signOut, refresh, setLocalAnnotator }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}