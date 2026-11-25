import { useMemo, useState } from 'react'
import { Plus, Send, CheckCircle2, XCircle, Package } from 'lucide-react'
import { db } from '../lib/db'
import { usePricingCatalog } from '../hooks/usePricingCatalog'

export default function RequestQuotePanel({ order, canEdit = false, customer = false }) {
  const { items, ranges, display } = usePricingCatalog()
  const [catalogId, setCatalogId] = useState('')
  const [qty, setQty] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const quote = order?.priceQuote
  const serviceItems = useMemo(() => display.showPartsCatalogToTechnician ? items.filter((x) => !x.serviceKey || x.serviceKey === order?.specialtyId) : [], [items, order?.specialtyId, display.showPartsCatalogToTechnician])
  const serviceRanges = ranges.filter((x) => x.serviceKey === order?.specialtyId)
  const [draft, setDraft] = useState([])
  const addCatalog = () => {
    const item = serviceItems.find((x) => String(x.id) === String(catalogId))
    if (!item) return
    const price = Number(unitPrice === '' ? item.basePrice : unitPrice)
    if (!Number.isFinite(price) || price < 0) return setError('أدخل سعر القطعة بشكل صحيح.')
    setDraft((v) => [...v, { itemId: item.id, code: item.code, name: item.name, qty: Math.max(1, Number(qty) || 1), unitPrice: price, custom: false }])
    setCatalogId(''); setQty('1'); setUnitPrice(''); setError('')
  }
  const addCustom = () => {
    const price = Number(customPrice)
    if (!customName.trim() || !Number.isFinite(price) || price < 0) return setError('أدخل وصف البند وسعره بشكل صحيح.')
    setDraft((v) => [...v, { itemId: null, code: null, name: customName.trim(), qty: 1, unitPrice: price, custom: true }])
    setCustomName(''); setCustomPrice(''); setError('')
  }
  const calc = (lines) => {
    const subtotal = lines.reduce((s, x) => s + x.qty * x.unitPrice, 0)
    const vat = display.vatEnabled ? lines.reduce((s, x) => s + x.qty * x.unitPrice * Number(x.vatRate ?? display.vatRate) / 100, 0) : 0
    return { subtotal: Number(subtotal.toFixed(2)), vat: Number(vat.toFixed(2)), total: Number((subtotal + vat).toFixed(2)) }
  }
  async function sendQuote() {
    if (!draft.length) return setError('أضف بنداً واحداً على الأقل قبل إرسال التسعيرة.')
    setBusy(true); setError('')
    try {
      const lines = draft.map((x) => {
        const item = items.find((i) => String(i.id) === String(x.itemId))
        const rate = display.vatEnabled && !item?.vatExempt ? Number(item?.vatRate ?? display.vatRate) : 0
        const net = x.qty * x.unitPrice, tax = net * rate / 100
        return { ...x, vatRate: rate, subtotal: Number(net.toFixed(2)), vat: Number(tax.toFixed(2)), total: Number((net + tax).toFixed(2)) }
      })
      const sums = calc(lines)
      const next = { version: Number(quote?.version || 0) + 1, status: 'pending_customer', lines, ...sums, note: note.trim(), createdAt: new Date().toISOString(), createdBy: 'staff' }
      await db.updateShared('orders', order.id, { priceQuote: next, priceQuoteStatus: 'pending_customer' })
      setDraft([]); setNote('')
    } catch (e) { setError(e.message || 'تعذر إرسال التسعيرة.') }
    finally { setBusy(false) }
  }
  async function decide(status) {
    setBusy(true); setError('')
    try {
      const next = { ...quote, status, decidedAt: new Date().toISOString() }
      await db.updateShared('orders', order.id, { priceQuote: next, priceQuoteStatus: status, ...(status === 'approved' ? { price: quote.total, approvedQuoteVersion: quote.version } : {}) })
    } catch (e) { setError(e.message || 'تعذر تسجيل القرار.') }
    finally { setBusy(false) }
  }
  const money = (v) => Number(v || 0).toFixed(2) + ' ر.س'
  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white">
    <h2 className="font-black flex items-center gap-2"><Package size={17}/> التسعير وقطع الغيار</h2>
    {display.showTechnicianPrices && display.showPriceRanges && serviceRanges.length > 0 && <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
      <p className="text-xs font-bold text-amber-200">نطاقات استرشادية — ليست سعراً نهائياً</p>
      <p className="text-[10px] text-slate-400 mt-1">تتغير حسب نوع الجهاز وحجمه والحالة والسوق. المعاينة وتحديد السعر النهائي من الفني.</p>
      {serviceRanges.map(r=><p key={r.id} className="flex justify-between gap-2 text-xs mt-2"><span>{r.label}</span><b>{r.min}–{r.max} ر.س</b></p>)}
    </div>}
    {quote && <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="flex justify-between items-center gap-2"><b className="text-sm">التسعيرة رقم {quote.version}</b><span className="text-[10px] rounded-full bg-amber-500/15 text-amber-200 px-2 py-1">{quote.status==='pending_customer'?'بانتظار موافقة العميل':quote.status==='approved'?'معتمدة':'مرفوضة'}</span></div>
      {(quote.lines||[]).map((line,i)=><div key={i} className="flex justify-between gap-2 text-xs border-b border-white/5 py-2"><span>{line.name} × {line.qty}</span><b>{money(line.total)}</b></div>)}
      <div className="text-xs text-slate-300 mt-2 space-y-1"><p className="flex justify-between"><span>قبل الضريبة</span><b>{money(quote.subtotal)}</b></p><p className="flex justify-between"><span>القيمة المضافة</span><b>{money(quote.vat)}</b></p><p className="flex justify-between text-sm text-white"><span>الإجمالي</span><b>{money(quote.total)}</b></p></div>
      {quote.note && <p className="text-xs text-slate-400 mt-2">{quote.note}</p>}
      {customer && quote.status==='pending_customer' && <div className="grid grid-cols-2 gap-2 mt-3">
        <button disabled={busy} onClick={()=>decide('approved')} className="rounded-xl bg-emerald-600 py-2.5 text-xs font-black"><CheckCircle2 size={14} className="inline"/> موافق على السعر</button>
        <button disabled={busy} onClick={()=>decide('rejected')} className="rounded-xl bg-rose-600 py-2.5 text-xs font-black"><XCircle size={14} className="inline"/> رفض التسعيرة</button>
      </div>}
    </div>}
    {canEdit && <div className="mt-4 flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px_100px_auto] gap-2">
        <select value={catalogId} onChange={e=>setCatalogId(e.target.value)} className="min-w-0 rounded-xl bg-white text-slate-900 px-2 py-2 text-xs"><option value="">اختر قطعة مسجلة…</option>{serviceItems.map(x=><option key={x.id} value={x.id}>{x.code} — {x.name} ({x.basePrice} ر.س قبل الضريبة)</option>)}</select>
        <input value={qty} onChange={e=>setQty(e.target.value)} type="number" min="1" className="rounded-xl bg-white text-slate-900 px-2 py-2 text-xs" placeholder="الكمية"/>
        <input value={unitPrice} onChange={e=>setUnitPrice(e.target.value)} type="number" min="0" step="0.01" className="rounded-xl bg-white text-slate-900 px-2 py-2 text-xs" placeholder="سعر بديل"/>
        <button onClick={addCatalog} className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-white"><Plus size={14}/></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2">
        <input value={customName} onChange={e=>setCustomName(e.target.value)} className="rounded-xl bg-white text-slate-900 px-3 py-2 text-xs" placeholder="قطعة أو بند غير موجود — اكتب الوصف"/>
        <input value={customPrice} onChange={e=>setCustomPrice(e.target.value)} type="number" min="0" step="0.01" className="rounded-xl bg-white text-slate-900 px-3 py-2 text-xs" placeholder="السعر قبل الضريبة"/>
        <button onClick={addCustom} className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold"><Plus size={14} className="inline"/> إضافة بند حر</button>
      </div>
      {draft.map((x,i)=><div key={i} className="flex justify-between text-xs bg-white/5 rounded-lg p-2"><span>{x.name} × {x.qty}</span><b>{money(x.qty*x.unitPrice)}</b></div>)}
      <textarea value={note} onChange={e=>setNote(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white" rows="2" placeholder="ملاحظة للعميل بعد المعاينة (اختياري)"/>
      <button disabled={busy || !draft.length} onClick={sendQuote} className="w-full rounded-xl bg-primary py-3 text-sm font-black text-white disabled:opacity-50"><Send size={15} className="inline"/> إرسال السعر النهائي للعميل للموافقة</button>
    </div>}
    {error && <p className="mt-2 text-xs font-bold text-rose-300">{error}</p>}
    {busy && <p className="mt-2 text-[10px] text-slate-400">جارِ الحفظ…</p>}
  </section>
}
