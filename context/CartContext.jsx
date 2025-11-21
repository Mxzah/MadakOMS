import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

const CartContext = createContext(null)
const STORAGE_KEY = 'madakoms:cart:v1'

function deriveGroupLabelsFromItem(item) {
  if (!item || typeof item !== 'object') return {}
  const groups = Array.isArray(item.modifiers) ? item.modifiers : []
  return groups.reduce((acc, group) => {
    if (!group || typeof group !== 'object' || !group.id) return acc
    const label = group.title || group.name || group.label
    if (label) acc[group.id] = label
    return acc
  }, {})
}

export function CartProvider({ children }) {
  const [lines, setLines] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isGlobalLoading, setIsGlobalLoading] = useState(false)

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const sanitized = parsed
        .filter((l) => l && typeof l === 'object')
        .map((l) => {
          const qty = Math.max(1, Number(l.qty) || 1)
          const unitPrice = Number(l.unitPrice) || 0
          const selections = (l.selections && typeof l.selections === 'object') ? l.selections : {}
          const selectionLabels = (l.selectionLabels && typeof l.selectionLabels === 'object') ? l.selectionLabels : undefined
          const itemId = l.itemId
          const item = l.item
          const existingGroupLabels = (l.groupLabels && typeof l.groupLabels === 'object' && Object.keys(l.groupLabels).length > 0) ? l.groupLabels : null
          const groupLabels = existingGroupLabels || deriveGroupLabelsFromItem(item) || {}
          const key = l.key || JSON.stringify({ itemId, selections, unitPrice })
          const total = qty * unitPrice
          return { key, itemId, qty, unitPrice, total, selections, selectionLabels, groupLabels, item }
        })
      setLines(sanitized)
    } catch {
      // ignore corrupted storage
    }
  }, [])

  // Persist to localStorage on change
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const toStore = lines.map(({ key, itemId, qty, unitPrice, selections, selectionLabels, groupLabels, item }) => ({ key, itemId, qty, unitPrice, selections, selectionLabels, groupLabels, item }))
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
    } catch {
      // storage quota or other error — ignore silently
    }
  }, [lines])

  const addItem = ({ itemId, qty = 1, unitPrice = 0, total, selections = {}, selectionLabels, groupLabels = {}, item }) => {
    setLines((prev) => {
      const key = JSON.stringify({ itemId, selections, unitPrice })
      const idx = prev.findIndex((l) => l.key === key)
      const normalizedGroupLabels = (groupLabels && Object.keys(groupLabels).length > 0)
        ? groupLabels
        : deriveGroupLabelsFromItem(item)
      if (idx >= 0) {
        const copy = [...prev]
        const existing = copy[idx]
        const newQty = existing.qty + qty
        copy[idx] = {
          ...existing,
          qty: newQty,
          total: newQty * unitPrice,
          groupLabels: { ...(normalizedGroupLabels || {}), ...(existing.groupLabels || {}) },
        }
        return copy
      }
      return [...prev, {
        key,
        itemId,
        qty,
        unitPrice,
        total: total ?? qty * unitPrice,
        selections,
        selectionLabels,
        groupLabels: normalizedGroupLabels || {},
        item,
      }]
    })
  }

  const clear = () => setLines([])
  const removeAt = (index) => setLines((prev) => prev.filter((_, i) => i !== index))

  const updateAt = (index, { itemId, qty, unitPrice, selections = {}, selectionLabels, groupLabels = {}, item }) => {
    setLines((prev) => {
      if (index < 0 || index >= prev.length) return prev
      const newQty = Math.max(1, Number(qty) || 1)
      const newUnit = Number(unitPrice) || 0
      const key = JSON.stringify({ itemId, selections, unitPrice: newUnit })
      const normalizedGroupLabels = (groupLabels && Object.keys(groupLabels).length > 0)
        ? groupLabels
        : deriveGroupLabelsFromItem(item)
      const updated = {
        key,
        itemId,
        qty: newQty,
        unitPrice: newUnit,
        total: newQty * newUnit,
        selections,
        selectionLabels,
        groupLabels: normalizedGroupLabels || {},
        item,
      }

      const copy = [...prev]
      copy[index] = updated

      // merge with any other identical line
      const dupIndex = copy.findIndex((l, i) => i !== index && l.key === key)
      if (dupIndex >= 0) {
        const mergedQty = copy[dupIndex].qty + updated.qty
        const merged = {
          ...updated,
          qty: mergedQty,
          total: mergedQty * updated.unitPrice,
          groupLabels: { ...(copy[dupIndex].groupLabels || {}), ...(updated.groupLabels || {}) },
        }
        const smaller = copy.filter((_, i) => i !== index && i !== dupIndex)
        return [...smaller, merged]
      }
      return copy
    })
  }

  const subtotal = useMemo(() => lines.reduce((s, l) => s + (Number(l.total) || 0), 0), [lines])
  const count = useMemo(() => lines.reduce((s, l) => s + (Number(l.qty) || 0), 0), [lines])

  const openCart = () => setIsOpen(true)
  const closeCart = () => setIsOpen(false)
  const toggleCart = () => setIsOpen((v) => !v)

  const value = {
    lines,
    addItem,
    clear,
    removeAt,
    updateAt,
    subtotal,
    count,
    isOpen,
    openCart,
    closeCart,
    toggleCart,
    isGlobalLoading,
    showGlobalLoading: () => setIsGlobalLoading(true),
    hideGlobalLoading: () => setIsGlobalLoading(false),
  }
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

export default CartContext
