import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Save, Plus, Package, Percent, Eye, EyeOff } from 'lucide-react'
import { useTeamRole } from '../hooks/useTeamRole'
import { usePricingCatalog } from '../hooks/usePricingCatalog'
import { SPECIALTIES } from '../constants'

const blankItem = { code: '', name: '', category: 'قطع غيار', serviceKey: 'ac', unit: 'قطعة', basePrice: '', vatExempt: false, visibleToCustomer: false, visibleToTechnician: true }
const blankRange = { serviceKey: 'ac', issueKey: '', label: '', min: '', max: '' }
const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary'

export default function PricingCatalog() {
  const navigate = useNavigate()
  const { role, isOwner, loading: roleLoading } = useTeamRole()
  const { items, ranges, display, saveDisplay, saveItem, saveRange } = usePricingCatalog()
  const [settings, setSettings] = useState(null)
  const [item, setItem] = useState(blankItem)
  const [range, setRange] = useState(blankRange)
  const [notice, setNotice] = useState('')
  const [editingItem, setEditingItem] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const allowed = isOwner || role === 'operations'
  const d = settings || display
  const update = (setter, key) => (e) => setter((v) => ({ ...(v || display), [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function saveSettings() {
    setBusy(true); setError(''); setNotice('')
    try { await saveDisplay(settings || display); setSettings(null); setNotice('تم حفظ إعدادات ظهور الأسعار والضريبة.') }
    catch (e) { setError(e.message || 'تعذر حفظ الإعدادات.') }
    finally { setBusy(false) }
  }
  async function addItem(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await saveItem(item); setItem(blankItem); setEditingItem(false); setNotice('تم حفظ القطعة في جدول الأسعار.') }
    catch (e) { setError(e.message || 'تعذر حفظ القطعة.') }
    finally { setBusy(false) }
  }
  async function addRange(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await saveRange(range); setRange(blankRange); setNotice('تم حفظ نطاق السعر التقريبي.') }
    catch (e) { setError(e.message || 'تعذر حفظ نطاق السعر.') }
    finally { setBusy(false) }
  }
  if (roleLoading) return <Centered>جارِ التحقق من الصلاحيات…</Centered>
  if (!allowed) return <Centered>هذه الصفحة للمالك ومشرف العمليات فقط.</Centered>
  const vat = d.vatEnabled ? Number(d.vatRate || 0) : 0

  return <div className="h-full overflow-y-auto pb-24 bg-[#f5f7f5]" dir="rtl">
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-black/5">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/staff/pricing')} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><ChevronRight size={18}/></button>
        <div><p className="text-[10px] font-bold tracking-widest text-primary">MUTQAN PRICE BOOK</p><h1 className="font-black text-slate-900">جدول أسعار الخدمات وقطع الغيار</h1></div>
      </div>
    </header>
    <main className="max-w-4xl mx-auto px-4 py-5 flex flex-col gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-black text-slate-900 flex items-center gap-2"><Eye size={17}/> إعدادات العرض والضريبة</h2>
        <p className="text-xs text-slate-500 mt-1">يمكن إخفاء الأسعار عن العميل مع استمرار استخدامها داخلياً للفني والعمليات.</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700"><span>تفعيل القيمة المضافة</span><input type="checkbox" checked={!!d.vatEnabled} onChange={update(setSettings,'vatEnabled')}/></label>
          <label className="text-sm text-slate-700">نسبة الضريبة %<input className={input+' mt-1'} type="number" min="0" max="100" value={d.vatRate ?? 15} onChange={update(setSettings,'vatRate')}/></label>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700"><span>الأسعار المدخلة شاملة الضريبة</span><input type="checkbox" checked={!!d.pricesIncludeVat} onChange={update(setSettings,'pricesIncludeVat')}/></label>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700"><span>إظهار نطاقات الأسعار للعميل</span><input type="checkbox" checked={!!d.showCustomerPrices} onChange={update(setSettings,'showCustomerPrices')}/></label>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700"><span>إظهار الأسعار للفني</span><input type="checkbox" checked={!!d.showTechnicianPrices} onChange={update(setSettings,'showTechnicianPrices')}/></label>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700"><span>إظهار نطاق من وإلى</span><input type="checkbox" checked={!!d.showPriceRanges} onChange={update(setSettings,'showPriceRanges')}/></label>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700"><span>كتالوج القطع للعميل</span><input type="checkbox" checked={!!d.showPartsCatalogToCustomer} onChange={update(setSettings,'showPartsCatalogToCustomer')}/></label>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700"><span>كتالوج القطع للفني</span><input type="checkbox" checked={!!d.showPartsCatalogToTechnician} onChange={update(setSettings,'showPartsCatalogToTechnician')}/></label>
        </div>
        <p className="text-[11px] text-slate-500 mt-3">مثال: سعر القطعة قبل الضريبة 100 ريال، الضريبة {vat}%، الإجمالي {(100 + 100*vat/100).toFixed(2)} ريال.</p>
        <button onClick={saveSettings} disabled={busy} className="mt-4 w-full rounded-xl bg-primary py-3 font-black text-white disabled:opacity-50">{busy?'جارِ الحفظ…':'حفظ إعدادات التسعير'}</button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-black text-slate-900 flex items-center gap-2"><Package size={17}/> {editingItem ? 'تعديل قطعة أو بند' : 'إضافة قطعة أو بند جديد'}</h2>
        <form onSubmit={addItem} className="grid sm:grid-cols-2 gap-3 mt-4">
          <Field label="كود القطعة"><input required className={input} value={item.code} onChange={update(setItem,'code')} placeholder="AC-CAP-001" dir="ltr"/></Field>
          <Field label="اسم القطعة / البند"><input required className={input} value={item.name} onChange={update(setItem,'name')}/></Field>
          <Field label="التصنيف"><input required className={input} value={item.category} onChange={update(setItem,'category')}/></Field>
          <Field label="الخدمة"><select className={input} value={item.serviceKey} onChange={update(setItem,'serviceKey')}>{SPECIALTIES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
          <Field label="سعر القطعة قبل الضريبة (ر.س)"><input required type="number" min="0" step="0.01" className={input} value={item.basePrice} onChange={update(setItem,'basePrice')}/></Field>
          <Field label="الوحدة"><input className={input} value={item.unit} onChange={update(setItem,'unit')}/></Field>
          <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={!!item.vatExempt} onChange={update(setItem,'vatExempt')}/> معفى من الضريبة</label>
          <button disabled={busy} className="rounded-xl bg-slate-900 text-white py-2.5 font-bold disabled:opacity-50">{editingItem ? 'حفظ التعديل' : <><Plus size={15} className="inline"/> إضافة إلى الجدول</>}</button>
        </form>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-right text-xs min-w-[520px]"><thead><tr className="border-b text-slate-500"><th className="p-2">الكود</th><th className="p-2">القطعة</th><th className="p-2">قبل الضريبة</th><th className="p-2">الضريبة</th><th className="p-2">الإجمالي</th><th className="p-2">إجراء</th></tr></thead><tbody>
          {items.map(x=>{const tax=display.vatEnabled&&!x.vatExempt?Number(x.basePrice)*Number(x.vatRate??display.vatRate)/100:0;return <tr key={x.id} className="border-b border-slate-100"><td className="p-2 font-mono">{x.code}</td><td className="p-2 font-bold">{x.name}</td><td className="p-2">{Number(x.basePrice).toFixed(2)}</td><td className="p-2">{tax.toFixed(2)}</td><td className="p-2 font-black">{(Number(x.basePrice)+tax).toFixed(2)} ر.س</td><td className="p-2"><button type="button" onClick={()=>{setItem({...x,code:x.code||x.id,basePrice:String(x.basePrice)});setEditingItem(true)}} className="text-primary font-bold">تعديل</button></td></tr>})}
          {!items.length&&<tr><td colSpan="6" className="p-4 text-center text-slate-400">لا توجد قطع مسجلة بعد.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-black text-slate-900 flex items-center gap-2"><Percent size={17}/> نطاقات أسعار الأعطال والخدمات</h2>
        <p className="text-xs text-slate-500 mt-1">الأسعار استرشادية وتتغير حسب نوع الجهاز وحجمه وحالته وتكلفة السوق وقطع الغيار. السعر النهائي بعد المعاينة وموافقة العميل.</p>
        <form onSubmit={addRange} className="grid sm:grid-cols-2 gap-3 mt-4">
          <Field label="الخدمة"><select className={input} value={range.serviceKey} onChange={update(setRange,'serviceKey')}>{SPECIALTIES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
          <Field label="كود العطل"><input required className={input} value={range.issueKey} onChange={update(setRange,'issueKey')} placeholder="refrigerant-charge" dir="ltr"/></Field>
          <Field label="اسم العطل / الخدمة"><input required className={input} value={range.label} onChange={update(setRange,'label')} placeholder="شحن فريون"/></Field>
          <Field label="الحد الأدنى (ر.س)"><input required type="number" min="0" step="0.01" className={input} value={range.min} onChange={update(setRange,'min')}/></Field>
          <Field label="الحد الأقصى (ر.س)"><input required type="number" min="0" step="0.01" className={input} value={range.max} onChange={update(setRange,'max')}/></Field>
          <button disabled={busy} className="rounded-xl bg-primary text-white py-2.5 font-bold disabled:opacity-50">حفظ النطاق التقريبي</button>
        </form>
        <div className="mt-4 grid sm:grid-cols-2 gap-2">{ranges.map(r=><div key={r.id} className="rounded-xl bg-slate-50 border border-slate-100 p-3"><p className="text-xs font-bold text-slate-800">{r.label}</p><p className="text-[11px] text-slate-500">{SPECIALTIES.find(s=>s.id===r.serviceKey)?.label||r.serviceKey}</p><p className="font-black text-primary mt-1">{r.min} – {r.max} ر.س <span className="text-[10px] font-normal text-slate-400">تقريبي</span></p><button type="button" onClick={()=>setRange({...r,min:String(r.min),max:String(r.max)})} className="mt-2 text-xs font-bold text-primary">تعديل النطاق</button></div>)}</div>
      </section>
      {error&&<p className="text-sm font-bold text-rose-600">{error}</p>}{notice&&<p className="text-sm font-bold text-emerald-700">{notice}</p>}
    </main>
  </div>
}
function Field({label,children}){return <label className="block text-xs font-bold text-slate-500">{label}{children}</label>}
function Centered({children}){return <div className="h-full flex items-center justify-center bg-[#f5f7f5] text-slate-500 text-sm" dir="rtl">{children}</div>}
