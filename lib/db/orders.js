import { supabaseServer } from '../supabase/server'
import { formatPrice } from '../currency'

class OrderValidationError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'OrderValidationError'
    this.statusCode = status
  }
}

const DELIVERY_FLOW = ['received', 'preparing', 'ready', 'enroute', 'completed']
const PICKUP_FLOW = ['received', 'preparing', 'ready', 'completed']

const CURRENCY_SCALE = 100

const roundCurrency = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.round(num * CURRENCY_SCALE) / CURRENCY_SCALE
}

const toCurrency = (value, fallback = 0) => roundCurrency(value ?? fallback)

const coerceQty = (value) => {
  const num = Number.parseInt(value, 10)
  if (!Number.isFinite(num) || num <= 0) return 1
  return num
}

const sanitizePhone = (value) => {
  if (!value) return null
  const digits = String(value).replace(/\D/g, '')
  return digits.length ? digits : null
}

const normalizeSelectionValue = (value) => {
  if (value == null) return []
  if (Array.isArray(value)) return value.filter((v) => v != null).map(String)
  return [value].filter((v) => v != null).map(String)
}

const compactObject = (obj) => {
  if (!obj || typeof obj !== 'object') return null
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value === undefined) return acc
    acc[key] = value
    return acc
  }, {})
}

const extractSelectionIdentifiers = (items) => {
  const itemIds = new Set()
  const groupIds = new Set()
  const optionIds = new Set()

  items.forEach((item) => {
    if (item?.itemId) itemIds.add(String(item.itemId))
    const selections = item?.selections && typeof item.selections === 'object' ? item.selections : {}
    Object.entries(selections).forEach(([groupId, value]) => {
      if (!groupId) return
      groupIds.add(String(groupId))
      normalizeSelectionValue(value).forEach((optionId) => optionIds.add(optionId))
    })
  })

  return {
    itemIds: Array.from(itemIds),
    groupIds: Array.from(groupIds),
    optionIds: Array.from(optionIds),
  }
}

const fetchMetadata = async (restaurantId, { itemIds, groupIds, optionIds }) => {
  const queries = []

  if (itemIds.length) {
    queries.push(
      supabaseServer
        .from('menu_items')
        .select('id, restaurant_id, name, description, base_price')
        .in('id', itemIds)
    )
  } else {
    queries.push(Promise.resolve({ data: [] }))
  }

  if (groupIds.length) {
    queries.push(
      supabaseServer
        .from('modifier_groups')
        .select('id, restaurant_id, menu_item_id, name')
        .in('id', groupIds)
    )
  } else {
    queries.push(Promise.resolve({ data: [] }))
  }

  if (optionIds.length) {
    queries.push(
      supabaseServer
        .from('modifier_options')
        .select('id, group_id, name, price_delta')
        .in('id', optionIds)
    )
  } else {
    queries.push(Promise.resolve({ data: [] }))
  }

  const [itemsRes, groupsRes, optionsRes] = await Promise.all(queries)

  if (itemsRes.error) throw itemsRes.error
  if (groupsRes.error) throw groupsRes.error
  if (optionsRes.error) throw optionsRes.error

  const menuItems = new Map()
  for (const row of itemsRes.data || []) {
    if (row.restaurant_id !== restaurantId) continue
    menuItems.set(row.id, row)
  }

  const groups = new Map()
  for (const row of groupsRes.data || []) {
    if (row.restaurant_id !== restaurantId) continue
    groups.set(row.id, row)
  }

  const options = new Map()
  for (const row of optionsRes.data || []) {
    if (groups.has(row.group_id)) options.set(row.id, row)
  }

  return { menuItems, groups, options }
}

const buildModifierRows = (rawItem, groups, options) => {
  const selections = rawItem?.selections && typeof rawItem.selections === 'object' ? rawItem.selections : {}
  const selectionLabels = rawItem?.selectionLabels && typeof rawItem.selectionLabels === 'object' ? rawItem.selectionLabels : {}

  const rows = []
  let total = 0

  Object.entries(selections).forEach(([groupId, value]) => {
    const group = groups.get(groupId)
    const ids = normalizeSelectionValue(value)
    const labels = Array.isArray(selectionLabels[groupId]) ? selectionLabels[groupId] : (selectionLabels[groupId] ? [selectionLabels[groupId]] : [])

    ids.forEach((optionId, index) => {
      const option = options.get(optionId)
      const priceDelta = option ? toCurrency(option.price_delta) : 0
      const modifierName = group?.name || labels[index] || labels[0] || 'Personnalisation'
      const optionName = option?.name || labels[index] || labels[0] || `Option ${index + 1}`

      rows.push({
        modifier_name: modifierName,
        option_name: optionName,
        price_delta: priceDelta,
      })

      total += priceDelta
    })
  })

  return { rows, total: toCurrency(total) }
}

const normalizeOrderItems = async (restaurantId, items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new OrderValidationError('Le panier est vide.')
  }

  const identifiers = extractSelectionIdentifiers(items)
  const metadata = await fetchMetadata(restaurantId, identifiers)

  const normalized = items.map((raw, index) => {
    const quantity = coerceQty(raw?.qty)
    const menuItem = raw?.itemId ? metadata.menuItems.get(String(raw.itemId)) : null

    if (raw?.itemId && !menuItem) {
      throw new OrderValidationError(`Article ${raw.itemId} introuvable pour ce restaurant.`)
    }

    const basePrice = menuItem ? toCurrency(menuItem.base_price) : toCurrency(raw?.unitPrice)
    const { rows: modifiers, total: modifiersTotal } = buildModifierRows(raw, metadata.groups, metadata.options)
    const unitPrice = toCurrency(basePrice + modifiersTotal)
    const totalPrice = toCurrency(unitPrice * quantity)

    const title = menuItem?.name || raw?.item?.title || raw?.item?.name || raw?.title || `Article ${index + 1}`
    const description = menuItem?.description || raw?.item?.description || null

    return {
      menu_item_id: menuItem?.id || null,
      name: title,
      description,
      unit_price: unitPrice,
      quantity,
      total_price: totalPrice,
      modifiers,
      rawSelections: raw?.selections || {},
    }
  })

  const subtotal = toCurrency(normalized.reduce((sum, item) => sum + item.total_price, 0))

  return { items: normalized, subtotal }
}

const ensureCustomerRecord = async (customer = {}) => {
  const email = customer.email ? String(customer.email).trim().toLowerCase() : null
  const phone = sanitizePhone(customer.phone)
  const firstName = customer.firstName ? String(customer.firstName).trim() : null

  if (!email && !phone && !firstName) return null

  // Look for existing customer by phone AND first_name combination
  let existing = null
  if (phone && firstName) {
    const { data, error } = await supabaseServer
      .from('customers')
      .select('id')
      .eq('phone', phone)
      .eq('first_name', firstName)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') throw error
    if (data?.id) existing = data
  }

  // If not found by phone+name, fallback to email or phone only (for backward compatibility)
  if (!existing?.id) {
    const filters = []
    if (email) filters.push(`email.eq.${email}`)
    if (phone && !firstName) filters.push(`phone.eq.${phone}`)

    if (filters.length) {
      const { data, error } = await supabaseServer
        .from('customers')
        .select('id')
        .or(filters.join(','))
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error
      if (data?.id) existing = data
    }
  }

  if (existing?.id) return existing.id

  const { data: inserted, error: insertError } = await supabaseServer
    .from('customers')
    .insert({ email, phone, first_name: firstName })
    .select('id')
    .single()

  if (insertError) throw insertError
  return inserted?.id || null
}

const resolvePaymentRecord = (payment = {}, fulfillment, total) => {
  if (!payment || typeof payment !== 'object') return null
  if (payment.mode === 'card_now') {
    return { method: 'card_online', status: 'authorized', amount: total }
  }
  if (payment.mode === 'cod' || payment.mode === 'pay_in_store') {
    const method = payment.method === 'card' ? 'card_terminal' : (fulfillment === 'pickup' ? 'card_terminal' : 'cash')
    return { method, status: 'pending', amount: total }
  }
  return null
}

const normalizeDeliveryData = (delivery) => {
  if (!delivery || typeof delivery !== 'object') return null
  const lat = delivery.lat != null ? Number(delivery.lat) : null
  const lng = delivery.lng != null ? Number(delivery.lng) : null

  return compactObject({
    address: delivery.address || null,
    apartmentSuite: delivery.apartmentSuite || null,
    dropOption: delivery.dropOption || null,
    instructions: delivery.instructions || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    withinArea: typeof delivery.withinArea === 'boolean' ? delivery.withinArea : null,
    deliveryMode: delivery.deliveryMode || null,
    schedule: delivery.schedule || null,
  })
}

const resolveScheduledAt = (delivery) => {
  const start = delivery?.schedule?.start
  if (!start) return null
  const date = new Date(start)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export async function createOrder(slug, payload) {
  if (!slug || typeof slug !== 'string') {
    throw new OrderValidationError('Slug invalide.')
  }
  if (!payload || typeof payload !== 'object') {
    throw new OrderValidationError('Requête invalide.')
  }

  const { data: restaurant, error: restaurantError } = await supabaseServer
    .from('restaurants')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle()

  if (restaurantError) throw restaurantError
  if (!restaurant) throw new OrderValidationError('Restaurant introuvable.', 404)

  // Fetch restaurant settings to check minimum order amount
  const { data: settings, error: settingsError } = await supabaseServer
    .from('restaurant_settings')
    .select('min_order_amount_pickup, min_order_amount_delivery')
    .eq('restaurant_id', restaurant.id)
    .maybeSingle()

  if (settingsError) throw settingsError

  const fulfillment = payload.service === 'delivery' ? 'delivery' : 'pickup'
  const { items, subtotal } = await normalizeOrderItems(restaurant.id, payload.items)

  // Validate minimum order amount based on service type
  const minOrderAmount = fulfillment === 'delivery' 
    ? (settings?.min_order_amount_delivery ?? null)
    : (settings?.min_order_amount_pickup ?? null)
  
  if (minOrderAmount != null && Number.isFinite(Number(minOrderAmount)) && subtotal < Number(minOrderAmount)) {
    const serviceLabel = fulfillment === 'delivery' ? 'livraison' : 'cueillette'
    throw new OrderValidationError(
      `Le montant minimum pour la ${serviceLabel} est de ${formatPrice(Number(minOrderAmount))}. Votre commande est de ${formatPrice(subtotal)}.`
    )
  }

  const amounts = payload.amounts && typeof payload.amounts === 'object' ? payload.amounts : {}
  const deliveryFee = fulfillment === 'delivery' ? toCurrency(amounts.deliveryFee) : 0
  const taxes = toCurrency(amounts.taxes)
  const tipAmount = toCurrency(amounts.tip)
  const total = toCurrency(subtotal + deliveryFee + taxes + tipAmount)

  const customerId = await ensureCustomerRecord(payload.customer || {})
  const rawPhone = payload.customer?.phone ? String(payload.customer.phone).trim() : null
  const deliveryData = fulfillment === 'delivery' ? normalizeDeliveryData(payload.delivery) : null
  const scheduledAt = fulfillment === 'delivery' ? resolveScheduledAt(deliveryData || payload.delivery) : null
  
  // Extract drop_option for dedicated column (only for delivery orders)
  const dropOption = fulfillment === 'delivery' 
    ? (deliveryData?.dropOption || payload.delivery?.dropOption || null)
    : null
  // Validate drop_option value
  const validDropOption = dropOption === 'hand' || dropOption === 'door' ? dropOption : null
  
  // Extract apartment_suite for dedicated column (only for delivery orders)
  const apartmentSuite = fulfillment === 'delivery'
    ? (deliveryData?.apartmentSuite || payload.delivery?.apartmentSuite || null)
    : null
  // Normalize apartment_suite (trim whitespace, null if empty)
  const validApartmentSuite = apartmentSuite && typeof apartmentSuite === 'string' 
    ? apartmentSuite.trim() || null 
    : null

  const orderInsert = {
    restaurant_id: restaurant.id,
    customer_id: customerId,
    fulfillment,
    status: 'received',
    subtotal,
    delivery_fee: deliveryFee,
    tip_amount: tipAmount,
    taxes,
    total,
    notes: payload.notes || payload.delivery?.instructions || null,
    delivery_address: deliveryData,
    drop_option: validDropOption,
    apartment_suite: validApartmentSuite,
    delivery_name: fulfillment === 'delivery' ? (payload.customer?.firstName || null) : null,
    pickup_name: fulfillment === 'pickup' ? (payload.customer?.firstName || null) : null,
    pickup_phone: fulfillment === 'pickup' ? rawPhone : null,
    scheduled_at: scheduledAt,
    source_channel: 'web',
  }

  const { data: orderRow, error: orderError } = await supabaseServer
    .from('orders')
    .insert(orderInsert)
    .select('id, status, placed_at, order_number')
    .single()

  if (orderError) throw orderError

  const orderItemsPayload = items.map((item) => ({
    order_id: orderRow.id,
    menu_item_id: item.menu_item_id,
    name: item.name,
    description: item.description,
    unit_price: item.unit_price,
    quantity: item.quantity,
    total_price: item.total_price,
  }))

  const { data: insertedItems, error: itemsError } = await supabaseServer
    .from('order_items')
    .insert(orderItemsPayload)
    .select('id')

  if (itemsError) throw itemsError

  const modifierRows = []
  ;(insertedItems || []).forEach((record, index) => {
    const line = items[index]
    line.modifiers.forEach((modifier) => {
      modifierRows.push({ order_item_id: record.id, ...modifier })
    })
  })

  if (modifierRows.length) {
    const { error: modifiersError } = await supabaseServer
      .from('order_item_modifiers')
      .insert(modifierRows)
    if (modifiersError) throw modifiersError
  }

  const paymentRecord = resolvePaymentRecord(payload.payment, fulfillment, total)
  if (paymentRecord) {
    const { error: paymentError } = await supabaseServer
      .from('payments')
      .insert({
        order_id: orderRow.id,
        method: paymentRecord.method,
        status: paymentRecord.status,
        amount: paymentRecord.amount,
      })
    if (paymentError) throw paymentError
  }

  return {
    id: orderRow.id,
    status: orderRow.status,
    orderNumber: orderRow.order_number || null,
    subtotal,
    deliveryFee,
    tipAmount,
    taxes,
    total,
    fulfillment,
    placedAt: orderRow.placed_at,
  }
}

export async function fetchOrderForTracking(orderId) {
  if (!orderId || typeof orderId !== 'string') {
    throw new OrderValidationError('Identifiant de commande requis.', 400)
  }

  const { data: orderRow, error: orderError } = await supabaseServer
    .from('orders')
    .select(`
      id,
      order_number,
      restaurant_id,
      fulfillment,
      status,
      failure_reason,
      driver_id,
      scheduled_at,
      placed_at,
      completed_at,
      cancelled_at,
      cancellation_reason,
      subtotal,
      delivery_fee,
      tip_amount,
      taxes,
      total,
      notes,
      delivery_address,
      drop_option,
      apartment_suite,
      delivery_name,
      pickup_name,
      pickup_phone,
      source_channel,
      customer_id,
      restaurant:restaurants ( id, name, slug ),
      customer:customers ( id, phone )
    `)
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) throw orderError
  if (!orderRow) return null

  const [itemsRes, eventsRes, paymentsRes, driverLocRes, restaurantSettingsRes] = await Promise.all([
    supabaseServer
      .from('order_items')
      .select('id, name, description, unit_price, quantity, total_price, order_item_modifiers (id, modifier_name, option_name, price_delta)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
    supabaseServer
      .from('order_events')
      .select('id, actor_type, actor_id, event_type, payload, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
    supabaseServer
      .from('payments')
      .select('id, method, status, amount, processor, processor_id, last4, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
    orderRow.driver_id
      ? supabaseServer
          .from('driver_locations')
          .select('lat, lng, updated_at')
          .eq('staff_id', orderRow.driver_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseServer
      .from('restaurant_settings')
      .select('lat, lng')
      .eq('restaurant_id', orderRow.restaurant_id)
      .maybeSingle(),
  ])

  if (itemsRes.error) throw itemsRes.error
  if (eventsRes.error) throw eventsRes.error
  if (paymentsRes.error) throw paymentsRes.error
  if (driverLocRes.error && driverLocRes.error.code !== 'PGRST116') throw driverLocRes.error
  if (restaurantSettingsRes.error && restaurantSettingsRes.error.code !== 'PGRST116') throw restaurantSettingsRes.error

  const items = (itemsRes.data || []).map(({ order_item_modifiers, ...rest }) => ({
    ...rest,
    modifiers: order_item_modifiers || [],
  }))

  const driverLocation =
    driverLocRes.data && driverLocRes.data.lat != null && driverLocRes.data.lng != null
      ? {
          lat: Number(driverLocRes.data.lat),
          lng: Number(driverLocRes.data.lng),
          updated_at: driverLocRes.data.updated_at,
        }
      : null
  const restaurantLocation =
    restaurantSettingsRes.data && restaurantSettingsRes.data.lat != null && restaurantSettingsRes.data.lng != null
      ? {
          lat: Number(restaurantSettingsRes.data.lat),
          lng: Number(restaurantSettingsRes.data.lng),
        }
      : null

  return {
    ...orderRow,
    driverLocation,
    restaurantLocation,
    items,
    events: eventsRes.data || [],
    payments: paymentsRes.data || [],
  }
}

const resolveNextStatus = (fulfillment, status) => {
  const flow = fulfillment === 'pickup' ? PICKUP_FLOW : DELIVERY_FLOW
  const idx = flow.indexOf(status)
  if (idx === -1 || idx >= flow.length - 1) return null
  return flow[idx + 1]
}

export async function advanceOrderStatus(orderId) {
  if (!orderId || typeof orderId !== 'string') {
    throw new OrderValidationError('Identifiant de commande requis.', 400)
  }

  const { data: order, error: orderError } = await supabaseServer
    .from('orders')
    .select('id, fulfillment, status, completed_at')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) throw orderError
  if (!order) throw new OrderValidationError('Commande introuvable.', 404)
  if (order.status === 'cancelled') {
    throw new OrderValidationError('Impossible de simuler une commande annulée.', 422)
  }

  const nextStatus = resolveNextStatus(order.fulfillment, order.status)
  if (!nextStatus) {
    throw new OrderValidationError('Aucun statut suivant à simuler.', 422)
  }

  const timestamps = {}
  if (nextStatus === 'completed') {
    timestamps.completed_at = new Date().toISOString()
  }

  const { error: updateError } = await supabaseServer
    .from('orders')
    .update({ status: nextStatus, ...timestamps })
    .eq('id', orderId)

  if (updateError) throw updateError

  const { error: eventError } = await supabaseServer
    .from('order_events')
    .insert({
      order_id: orderId,
      actor_type: 'system',
      event_type: 'status_changed',
      payload: { status: nextStatus },
    })

  if (eventError) throw eventError

  return nextStatus
}

export { OrderValidationError }
