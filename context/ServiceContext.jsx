import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/router'

const ServiceContext = createContext(null)

export function ServiceProvider({ children, defaultService = 'pickup' }) {
  const router = useRouter()
  const [service, setService] = useState(defaultService)
  const [hydrated, setHydrated] = useState(false)

  // Initialize from URL if provided
  useEffect(() => {
    if (!router || !router.isReady) return
    let initial = router.query?.service
    if (initial !== 'delivery' && initial !== 'pickup') {
      try {
        const ls = typeof window !== 'undefined' ? localStorage.getItem('lastService') : null
        if (ls === 'delivery' || ls === 'pickup') initial = ls
      } catch {}
    }
    if (initial === 'delivery' || initial === 'pickup') {
      setService(initial)
    }
    setHydrated(true)
  }, [router?.isReady])

  // Keep URL in sync when service changes
  useEffect(() => {
    if (!router || !router.isReady || !hydrated) return
    const current = router.query?.service
    if (current === service) return
    const newQuery = { ...router.query, service }
    router.replace({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true })
  }, [service, router?.isReady, hydrated])

  // Persist to localStorage for cross-page continuity
  useEffect(() => {
    try { if (typeof window !== 'undefined') localStorage.setItem('lastService', service) } catch {}
  }, [service])

  return (
    <ServiceContext.Provider value={{ service, setService }}>
      {children}
    </ServiceContext.Provider>
  )
}

export function useService() {
  const ctx = useContext(ServiceContext)
  if (!ctx) throw new Error('useService must be used within ServiceProvider')
  return ctx
}

export default ServiceContext
