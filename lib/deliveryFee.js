// Utility function to calculate delivery distance using Haversine formula
function haversineDistanceKm(a, b) {
  if (!a || !b || typeof a.lat !== 'number' || typeof a.lng !== 'number' || typeof b.lat !== 'number' || typeof b.lng !== 'number') {
    return null
  }
  const toRad = (value) => (value * Math.PI) / 180
  const R = 6371 // Earth radius in km
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const sinDlat = Math.sin(dLat / 2)
  const sinDlng = Math.sin(dLng / 2)
  const aVal = sinDlat * sinDlat + sinDlng * sinDlng * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal))
  return R * c
}

// Check if current time is within peak hours
function isInPeakHours(peakHours, currentTime = new Date()) {
  if (!Array.isArray(peakHours) || peakHours.length === 0) return false
  
  const currentHour = currentTime.getHours()
  const currentMinute = currentTime.getMinutes()
  const currentMinutes = currentHour * 60 + currentMinute

  return peakHours.some((peak) => {
    if (!peak.start || !peak.end) return false
    const [startHour, startMin] = peak.start.split(':').map(Number)
    const [endHour, endMin] = peak.end.split(':').map(Number)
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    // Handle peak hours that span midnight
    if (endMinutes < startMinutes) {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes
    }
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes
  })
}

// Check if current date is a weekend
function isWeekend(currentDate = new Date()) {
  const day = currentDate.getDay()
  return day === 0 || day === 6 // Sunday or Saturday
}

// Check if current date is a holiday (basic implementation - can be extended)
function isHoliday(currentDate = new Date()) {
  // This is a basic implementation. You may want to add a list of holidays
  // or use a library for more accurate holiday detection
  const month = currentDate.getMonth()
  const date = currentDate.getDate()
  
  // Example: New Year's Day, Canada Day, Christmas, etc.
  // You can extend this with a proper holiday list
  return false
}

/**
 * Calculate delivery fee based on rules
 * @param {Object} rules - Delivery fee rules from restaurant_settings
 * @param {Object} params - Calculation parameters
 * @param {number} params.subtotal - Order subtotal
 * @param {Object} params.restaurantLocation - {lat, lng} of restaurant
 * @param {Object} params.deliveryLocation - {lat, lng} of delivery address
 * @param {Date} params.currentTime - Current date/time (defaults to now)
 * @returns {{fee: number, breakdown: Array<{label: string, amount: number}>}} Calculated delivery fee and breakdown
 */
export function calculateDeliveryFee(rules, params = {}) {
  const { subtotal = 0, restaurantLocation, deliveryLocation, currentTime = new Date() } = params
  const breakdown = []

  // If no rules, return default fee or 0
  if (!rules || typeof rules !== 'object') {
    return { fee: 0, breakdown: [] }
  }

  // Check for free delivery above threshold
  if (rules.freeDeliveryAbove != null && Number.isFinite(Number(rules.freeDeliveryAbove))) {
    if (subtotal >= Number(rules.freeDeliveryAbove)) {
      breakdown.push({ label: 'Livraison gratuite', amount: 0 })
      return { fee: 0, breakdown }
    }
  }

  let fee = 0
  let distance = null

  // Calculate base fee
  if (rules.type === 'flat') {
    // Flat fee
    if (rules.baseFee != null && Number.isFinite(Number(rules.baseFee))) {
      const baseFee = Number(rules.baseFee)
      fee = baseFee
      breakdown.push({ label: 'Frais de base', amount: baseFee })
    }
  } else if (rules.type === 'distance_based') {
    // Distance-based fee
    if (restaurantLocation && deliveryLocation) {
      distance = haversineDistanceKm(restaurantLocation, deliveryLocation)
    }

    if (distance != null && Number.isFinite(distance)) {
      // Check max distance
      if (rules.maxDistanceKm != null && Number.isFinite(Number(rules.maxDistanceKm))) {
        if (distance > Number(rules.maxDistanceKm)) {
          // Distance exceeds maximum - you might want to return null or throw an error
          // For now, we'll calculate anyway
        }
      }

      // Base fee
      if (rules.baseFee != null && Number.isFinite(Number(rules.baseFee))) {
        const baseFee = Number(rules.baseFee)
        fee = baseFee
        breakdown.push({ label: 'Frais de base', amount: baseFee })
      }

      // Per km fee
      if (rules.perKmFee != null && Number.isFinite(Number(rules.perKmFee))) {
        const perKmFee = distance * Number(rules.perKmFee)
        fee += perKmFee
        breakdown.push({ 
          label: `Frais par km (${Math.round(distance * 10) / 10} km)`, 
          amount: Math.round(perKmFee * 100) / 100 
        })
      }
    } else {
      // If distance cannot be calculated, fall back to base fee
      if (rules.baseFee != null && Number.isFinite(Number(rules.baseFee))) {
        const baseFee = Number(rules.baseFee)
        fee = baseFee
        breakdown.push({ label: 'Frais de base', amount: baseFee })
      }
    }
  } else {
    // Default: use baseFee if available
    if (rules.baseFee != null && Number.isFinite(Number(rules.baseFee))) {
      const baseFee = Number(rules.baseFee)
      fee = baseFee
      breakdown.push({ label: 'Frais de base', amount: baseFee })
    }
  }

  // Apply peak hours surcharge
  if (rules.peakHours && isInPeakHours(rules.peakHours, currentTime)) {
    const peakSurcharge = rules.peakHours
      .filter((peak) => isInPeakHours([peak], currentTime))
      .reduce((max, peak) => {
        const surcharge = peak.additionalFee != null && Number.isFinite(Number(peak.additionalFee)) 
          ? Number(peak.additionalFee) 
          : 0
        return Math.max(max, surcharge)
      }, 0)
    if (peakSurcharge > 0) {
      fee += peakSurcharge
      breakdown.push({ label: 'Surcharge heures de pointe', amount: peakSurcharge })
    }
  }

  // Apply weekend surcharge
  if (isWeekend(currentTime) && rules.weekendFee != null && Number.isFinite(Number(rules.weekendFee))) {
    const weekendFee = Number(rules.weekendFee)
    fee += weekendFee
    breakdown.push({ label: 'Surcharge week-end', amount: weekendFee })
  }

  // Apply holiday surcharge
  if (isHoliday(currentTime) && rules.holidayFee != null && Number.isFinite(Number(rules.holidayFee))) {
    const holidayFee = Number(rules.holidayFee)
    fee += holidayFee
    breakdown.push({ label: 'Surcharge jour férié', amount: holidayFee })
  }

  // Apply minimum order surcharge
  if (rules.minimumOrderSurcharge) {
    const { threshold, surcharge } = rules.minimumOrderSurcharge
    if (threshold != null && surcharge != null && Number.isFinite(Number(threshold)) && Number.isFinite(Number(surcharge))) {
      if (subtotal < Number(threshold)) {
        fee += Number(surcharge)
        breakdown.push({ label: 'Surcharge commande minimale', amount: Number(surcharge) })
      }
    }
  }

  // Round to 2 decimal places
  const finalFee = Math.round(fee * 100) / 100
  return { fee: finalFee, breakdown }
}

