const DAY_TO_INDEX = {
  sunday: 0,
  dimanche: 0,
  monday: 1,
  lundi: 1,
  tuesday: 2,
  mardi: 2,
  wednesday: 3,
  mercredi: 3,
  thursday: 4,
  jeudi: 4,
  friday: 5,
  vendredi: 5,
  saturday: 6,
  samedi: 6,
}

const TIME_DELIMITERS = /[-–—à]/ // hyphen, en dash, em dash, à

export function isRestaurantOpenNow(hoursJson, referenceDate = new Date()) {
  if (!hoursJson) return true
  const schedule = buildWeeklySchedule(hoursJson)
  if (!schedule || schedule.totalSegments === 0) return true

  const dayIndex = referenceDate.getDay() // 0 = Sunday
  const minutes = referenceDate.getHours() * 60 + referenceDate.getMinutes()
  const todaysSegments = schedule.byDay[dayIndex] || []

  if (todaysSegments.some((segment) => isMinuteInSegment(minutes, segment))) {
    return true
  }

  const prevIndex = (dayIndex + 6) % 7
  const prevSegments = schedule.byDay[prevIndex] || []
  return prevSegments.some(
    (segment) => segment.crossesMidnight && isMinuteInSegment(minutes, segment, true)
  )
}

function buildWeeklySchedule(hoursJson) {
  const parsed = parseJson(hoursJson)
  if (!parsed) return null

  const schedule = {
    byDay: {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    },
    totalSegments: 0,
  }

  const addSegments = (dayKey, value) => {
    const idx = dayKeyToIndex(dayKey)
    if (idx == null) return
    const segments = normalizeSegments(value)
    if (segments.length === 0) return
    schedule.byDay[idx].push(...segments)
    schedule.totalSegments += segments.length
  }

  if (Array.isArray(parsed)) {
    parsed.forEach((entry) => {
      if (!entry) return
      if (entry.day != null) {
        addSegments(entry.day, entry.value ?? entry.slots ?? entry)
      }
    })
  } else if (typeof parsed === 'object') {
    Object.entries(parsed).forEach(([dayKey, value]) => addSegments(dayKey, value))
  }

  return schedule
}

function parseJson(value) {
  if (value == null) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  if (typeof value === 'object') return value
  return null
}

function dayKeyToIndex(key) {
  if (!key) return null
  const normalized = String(key).trim().toLowerCase()
  if (!normalized) return null
  if (Object.prototype.hasOwnProperty.call(DAY_TO_INDEX, normalized)) {
    return DAY_TO_INDEX[normalized]
  }
  return null
}

function normalizeSegments(value) {
  if (!value) return []
  const source = Array.isArray(value) ? value : [value]
  const segments = []
  source.forEach((entry) => {
    if (!entry) return
    if (typeof entry === 'string') {
      const trimmed = entry.trim()
      if (!trimmed || /fermé/i.test(trimmed)) return
      const parts = trimmed.split(TIME_DELIMITERS).map((part) => part.trim()).filter(Boolean)
      if (parts.length >= 2) {
        const start = parseTime(parts[0])
        const end = parseTime(parts[1])
        if (start != null && end != null) segments.push(createSegment(start, end))
      }
      return
    }
    if (typeof entry === 'object') {
      const open = entry.open ?? entry.start ?? entry.from
      const close = entry.close ?? entry.end ?? entry.to
      if (open != null && close != null) {
        const start = parseTime(open)
        const end = parseTime(close)
        if (start != null && end != null) segments.push(createSegment(start, end))
        return
      }
      if (entry.label && typeof entry.label === 'string') {
        const parts = entry.label.split(TIME_DELIMITERS).map((part) => part.trim()).filter(Boolean)
        if (parts.length >= 2) {
          const start = parseTime(parts[0])
          const end = parseTime(parts[1])
          if (start != null && end != null) segments.push(createSegment(start, end))
        }
      }
    }
  })
  return segments
}

function createSegment(start, end) {
  const startMinutes = clampMinutes(start)
  const endMinutes = clampMinutes(end)
  const crossesMidnight = endMinutes <= startMinutes
  return {
    startMinutes,
    endMinutes,
    crossesMidnight,
  }
}

function clampMinutes(value) {
  const total = ((value % (24 * 60)) + (24 * 60)) % (24 * 60)
  return total
}

function parseTime(input) {
  if (input == null) return null
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null
    return Math.max(0, Math.min(24 * 60, Math.floor(input)))
  }
  const raw = String(input).trim().toLowerCase()
  if (!raw) return null

  const meridiem = /pm/.test(raw) || /p\.m/.test(raw) ? 'pm' : (/am/.test(raw) || /a\.m/.test(raw) ? 'am' : null)
  const digits = raw.match(/(\d{1,2})(?:[:h\s](\d{2}))?/)
  if (!digits) return null
  let hour = Number(digits[1])
  const minute = Number(digits[2] ?? '0')
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  if (meridiem === 'pm' && hour < 12) hour += 12
  if (meridiem === 'am' && hour === 12) hour = 0
  hour = Math.max(0, Math.min(23, hour))
  const safeMinute = Math.max(0, Math.min(59, minute))
  return hour * 60 + safeMinute
}

function isMinuteInSegment(minute, segment, carryOver = false) {
  if (!segment) return false
  if (!segment.crossesMidnight) {
    return minute >= segment.startMinutes && minute < segment.endMinutes
  }
  if (carryOver) {
    return minute < segment.endMinutes
  }
  return minute >= segment.startMinutes || minute < segment.endMinutes
}


