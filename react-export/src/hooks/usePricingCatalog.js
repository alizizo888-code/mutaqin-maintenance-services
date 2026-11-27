import { useCallback, useEffect, useState } from 'react'
import { bootstrap, pricingApi } from '../lib/phpApi'

export const DEFAULT_PRICING_DISPLAY = {
  id: 'global', vatEnabled: true, vatRate: 15, pricesIncludeVat: false,
  showCustomerPrices: true, showTechnicianPrices: true, showPriceRanges: true,
  showPartsCatalogToCustomer: false, showPartsCatalogToTechnician: true,
  showPriceDisclaimer: true, priceDisclaimer: 'الأسعار المعروضة تقريبية واسترشادية وليست ملزمة؛ تختلف حسب نوع الجهاز وحجمه وحالته وقطع الغيار وأسعار السوق. يحدد الفني السعر النهائي بعد المعاينة ولا تعتمد أي زيادة إلا بموافقتك.',
}
const fromSettings = (s = {}) => ({
  ...DEFAULT_PRICING_DISPLAY,
  vatEnabled: !!s.vat_enabled,
  vatRate: Number(s.vat_rate ?? 15),
  pricesIncludeVat: !!s.prices_include_vat,
  showCustomerPrices: !!s.show_customer_prices,
  showTechnicianPrices: !!s.show_technician_prices,
  showPriceRanges: !!s.show_price_ranges,
  showPartsCatalogToCustomer: !!s.show_parts_catalog_to_customer,
  showPartsCatalogToTechnician: !!s.show_technician_catalog,
  showPriceDisclaimer: s.show_price_disclaimer !== false,
  priceDisclaimer: s.price_disclaimer || DEFAULT_PRICING_DISPLAY.priceDisclaimer,
})
const fromItem = (x) => ({
  id: Number(x.id), code: x.item_code, name: x.item_name, category: x.category,
  serviceKey: x.service_key || '', itemType: x.item_type, unit: x.unit_name,
  basePrice: Number(x.base_price), vatRate: Number(x.vat_rate), vatExempt: !!x.vat_exempt,
  visibleToCustomer: !!x.visible_to_customer, visibleToTechnician: !!x.visible_to_technician,
  active: !!x.is_active, priceWithVat: Number(x.price_with_vat ?? 0),
})
const fromRange = (x) => ({
  id: `${x.service_key}:${x.issue_key}`, serviceKey: x.service_key, issueKey: x.issue_key,
  label: x.issue_label, min: Number(x.min_price), max: Number(x.max_price), vatRate: Number(x.vat_rate),
})

export function usePricingCatalog() {
  const [items, setItems] = useState([])
  const [ranges, setRanges] = useState([])
  const [display, setDisplay] = useState(DEFAULT_PRICING_DISPLAY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      await bootstrap()
      const [catalog, priceRanges] = await Promise.all([
        pricingApi('catalog'), pricingApi('ranges'),
      ])
      setItems((catalog.items || []).map(fromItem))
      setRanges((priceRanges.ranges || []).map(fromRange))
      setDisplay(fromSettings(catalog.settings))
    } catch (e) {
      setError(e.message || 'تعذر تحميل بيانات التسعير من الخادم.')
      setItems([]); setRanges([])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const saveDisplay = useCallback(async (patch) => {
    const next = { ...display, ...patch }
    await pricingApi('settings', { method: 'POST', body: {
      vat_enabled: next.vatEnabled, vat_rate: Number(next.vatRate),
      prices_include_vat: next.pricesIncludeVat,
      show_customer_prices: next.showCustomerPrices, show_price_ranges: next.showPriceRanges,
      show_parts_catalog_to_customer: next.showPartsCatalogToCustomer,
      show_technician_prices: next.showTechnicianPrices,
      show_technician_catalog: next.showPartsCatalogToTechnician,
      show_price_disclaimer: next.showPriceDisclaimer, price_disclaimer: next.priceDisclaimer,
    } })
    setDisplay(next)
    await refresh()
  }, [display, refresh])

  const saveItem = useCallback(async (item) => {
    const code = String(item.code || '').trim().toUpperCase()
    const name = String(item.name || '').trim()
    const basePrice = Number(item.basePrice)
    if (!code || !name || !String(item.category || '').trim() || !Number.isFinite(basePrice) || basePrice < 0) throw new Error('أدخل كوداً واسم قطعة وتصنيفاً وسعراً صحيحاً.')
    const body = {
      ...(Number(item.id) > 0 ? { id: Number(item.id) } : {}),
      item_code: code, item_name: name, category: item.category,
      service_key: item.serviceKey || null, item_type: item.itemType || 'spare_part',
      unit_name: item.unit || 'قطعة', base_price: basePrice,
      vat_rate: Number(item.vatRate ?? display.vatRate), vat_exempt: !!item.vatExempt,
      visible_to_customer: !!item.visibleToCustomer,
      visible_to_technician: item.visibleToTechnician !== false,
      is_active: item.active !== false,
    }
    const result = await pricingApi('save_item', { method: 'POST', body })
    await refresh()
    return { ...item, id: result.id || item.id, code, name, basePrice }
  }, [display.vatRate, refresh])

  const saveRange = useCallback(async (range) => {
    const min = Number(range.min), max = Number(range.max)
    if (!range.serviceKey || !range.issueKey || !range.label || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) throw new Error('راجع الخدمة والعطل والحد الأدنى والأقصى.')
    await pricingApi('save_range', { method: 'POST', body: {
      service_key: range.serviceKey, issue_key: range.issueKey,
      issue_label: range.label, min_price: min, max_price: max,
      vat_rate: Number(range.vatRate ?? display.vatRate),
    } })
    await refresh()
    return range
  }, [display.vatRate, refresh])

  return { items, ranges, display, loading, error, refresh, saveDisplay, saveItem, saveRange }
}
