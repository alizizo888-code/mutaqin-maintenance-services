import { useMemo, useCallback } from 'react'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { team } from '../lib/team'

export const DEFAULT_PRICING_DISPLAY = {
  id: 'global',
  vatEnabled: true,
  vatRate: 15,
  pricesIncludeVat: false,
  showCustomerPrices: true,
  showTechnicianPrices: true,
  showPriceRanges: true,
  showPartsCatalogToCustomer: false,
  showPartsCatalogToTechnician: true,
}

export function usePricingCatalog() {
  const { data: items, loading: itemsLoading } = useLiveShared('pricing_catalog', { limit: 500 })
  const { data: ranges, loading: rangesLoading } = useLiveShared('service_price_ranges', { limit: 500 })
  const { data: displayRows } = useLiveShared('pricing_display_settings', { limit: 5 })
  const display = useMemo(() => ({ ...DEFAULT_PRICING_DISPLAY, ...(displayRows || []).find((x) => x.id === 'global') }), [displayRows])

  const saveDisplay = useCallback(async (patch) => {
    const gid = await team.groupId()
    await db.upsertShared('pricing_display_settings', { ...display, ...patch, id: 'global', updatedAt: new Date().toISOString() }, 'global', { groupId: gid, writableBy: 'admins' })
  }, [display])

  const saveItem = useCallback(async (item) => {
    const gid = await team.groupId()
    const code = String(item.code || '').trim().toUpperCase()
    const name = String(item.name || '').trim()
    const basePrice = Number(item.basePrice)
    if (!code || !name || !Number.isFinite(basePrice) || basePrice < 0) throw new Error('أدخل كوداً واسم قطعة وسعراً صحيحاً.')
    const rate = display.vatEnabled && !item.vatExempt ? Number(item.vatRate ?? display.vatRate) : 0
    const row = { ...item, id: item.id || code, code, name, basePrice, vatRate: rate, vatExempt: !!item.vatExempt, active: item.active !== false, updatedAt: new Date().toISOString() }
    await db.upsertShared('pricing_catalog', row, row.id, { groupId: gid, writableBy: 'admins' })
    return row
  }, [display])

  const saveRange = useCallback(async (range) => {
    const gid = await team.groupId()
    const min = Number(range.min), max = Number(range.max)
    if (!range.serviceKey || !range.issueKey || !range.label || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) throw new Error('راجع الخدمة والعطل والحد الأدنى والأقصى.')
    const id = range.id || [range.serviceKey, range.issueKey].join(':')
    const row = { ...range, id, min, max, indicative: true, updatedAt: new Date().toISOString() }
    await db.upsertShared('service_price_ranges', row, id, { groupId: gid, writableBy: 'admins' })
    return row
  }, [])

  return { items: (items || []).filter((x) => x.active !== false), ranges: ranges || [], display, loading: itemsLoading || rangesLoading, saveDisplay, saveItem, saveRange }
}
