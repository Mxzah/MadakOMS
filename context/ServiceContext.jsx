import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/router'

const ServiceContext = createContext(null)

export function ServiceProvider({ children, defaultService = 'pickup' }) {
  const router = useRouter()
  const [service, setService] = useState(defaultService)

  // Initialize from URL if provided
  useEffect(() => {
    if (!router || !router.isReady) return
    const q = router.query?.service
    if (q === 'delivery' || q === 'pickup') {
      setService(q)
    }
  }, [router?.isReady])

  // Keep URL in sync when service changes
  useEffect(() => {
    if (!router || !router.isReady) return
    const current = router.query?.service
    if (current === service) return
    const newQuery = { ...router.query, service }
    // replace shallow so we don't trigger a full navigation
    router.replace({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true })
  }, [service, router?.isReady])

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
