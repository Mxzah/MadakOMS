const cadFormatter = new Intl.NumberFormat('en-CA', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatPrice(amount) {
  const num = Number(amount)
  const safe = Number.isFinite(num) ? num : 0
  return `CA$${cadFormatter.format(safe)}`
}

