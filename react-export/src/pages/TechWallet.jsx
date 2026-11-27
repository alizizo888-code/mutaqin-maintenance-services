import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Camera, Receipt, Fuel, Utensils, Package, Wallet, Plus } from 'lucide-react'
import { financeApi, financeUpload } from '../lib/phpApi'
import { usePricingCatalog } from '../hooks/usePricingCatalog'
import { useTeamRole } from '../hooks/useTeamRole'
import { SummaryGrid, money, EXPENSE_LABELS, MEAL_LABELS, STATUS_LABELS, STATUS_CLS, LEDGER_LABELS, Img, field } from '../components/FinanceBits'

const blank = { expense_type: 'spare_part', meal_kind: 'lunch', catalog_item_id: '', item_name: '', quantity: '1', purchase_price: '', sale_price: '', request_id: '', paid_from: 'cash_on_hand', note: '' }

/** «مشترياتي ومصروفاتي» — the technician's own financial account (owner/operations can open any technician with ?technician_id=). */
export default function TechWallet() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { role, loading: roleLoading } = useTeamRole()
  const techId = params.get('technician_id') || ''
  const { items } = usePricingCatalog()
  const [data, setData] = useState(null)
  const [form, setForm] = useState(blank)
  const [invoice, setInvoice] = useState(null)
  const [part, setPart] = useState(null)
  const [tab, setTab] = useState('add')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [suggest, setSuggest] = useState({ item_name: '', base_price: '', purchase_price: '' })

  const load = useCallback(async () => {
    try { setData(await financeApi('me', { params: { technician_id: techId } })); setErr('') }
    catch (e) { setErr(e.message) }
  }, [techId])
  useEffect(() => { if (!roleLoading && role) load() }, [roleLoading, role, load])

  const profile = data?.profile
  const rules = data?.rules || {}
  const types = useMemo(() => Object.keys(EXPENSE_LABELS).filter((t) => t === 'spare_part' ? rules.parts_deductible : rules.expenses_deductible), [rules])
  useEffect(() => { if (types.length && !types.includes(form.expense_type)) setForm((f) => ({ ...f, expense_type: types[0] })) }, [types])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const parts = items.filter((x) => x.itemType === 'spare_part' || x.category?.includes('قطع'))

  async function submit(e) {
    e.preventDefault(); setErr(''); setMsg('')
    if (!invoice) return setErr('صوّر الفاتورة أولاً.')
    if (form.expense_type === 'spare_part' && !part) return setErr('صوّر القطعة المشتراة.')
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v !== '' && v != null) fd.append(k, v) })
    if (techId) fd.append('technician_id', techId)
    fd.append('invoice_image', invoice); if (part) fd.append('part_image', part)
    setBusy(true)
    try { const r = await financeUpload('submit_expense', fd); setMsg(r.message); setForm(blank); setInvoice(null); setPart(null); await load() }
    catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  async function sendSuggestion(e) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true)
    try { const r = await financeApi('suggest_item', { method: 'POST', body: suggest }); setMsg(r.message); setSuggest({ item_name: '', base_price: '', purchase_price: '' }) }
    catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }

  if (roleLoading) return <Shell title="حسابي المالي" back={() => navigate('/staff')}><p className="text-slate-400 text-sm">جارِ التحقق…</p></Shell>
  if (!role) return <Shell title="حسابي المالي" back={() => navigate('/staff')}><p className="text-slate-400 text-sm">سجّل الدخول كفني أو إدارة.</p></Shell>

  return <Shell title={data?.technician ? `الحساب المالي — ${data.technician.full_name}` : 'حسابي المالي'} back={() => navigate(techId ? '/staff/tech-finance' : '/staff')}>
    {profile && <p className="text-xs text-slate-300">
      نظام المحاسبة: <b className="text-white">{profile.pay_model === 'monthly' ? 'شهري — الشركة تتحمل قطع الغيار والمصروفات المعتمدة' : `نسبة — قطع الغيار على حسابك، ونسبة الشركة من النقد ${Number(profile.company_share_cash)}%`}</b>
      {!!Number(profile.is_frozen) && <span className="text-rose-300 font-bold"> · الحساب مجمّد</span>}
    </p>}
    <SummaryGrid summary={data?.summary} payModel={profile?.pay_model} />

    <div className="flex gap-2 overflow-x-auto">
      {[['add', 'رفع فاتورة'], ['expenses', 'مشترياتي ومصروفاتي'], ['cash', 'النقدية'], ['ledger', 'كشف الحساب'], ['suggest', 'اقتراح صنف']].map(([k, l]) =>
        <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold border ${tab === k ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 text-slate-300'}`}>{l}</button>)}
    </div>
    {msg && <p className="text-xs font-bold text-emerald-300">{msg}</p>}
    {err && <p className="text-xs font-bold text-rose-300">{err}</p>}

    {tab === 'add' && (types.length === 0
      ? <Card><p className="text-sm text-slate-300">نظامك بالنسبة: قطع الغيار والمصروفات على حسابك ولا تُخصم من العهدة. يمكن للمالك منحك استثناءً من لوحة التحكم.</p></Card>
      : <Card><form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          {types.map((t) => { const I = { spare_part: Package, fuel: Fuel, meal: Utensils, other: Receipt }[t]; return <button type="button" key={t} onClick={() => setForm((f) => ({ ...f, expense_type: t }))} className={`rounded-xl py-3 text-xs font-bold flex flex-col items-center gap-1 border ${form.expense_type === t ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 text-slate-200'}`}><I size={18} />{EXPENSE_LABELS[t]}</button> })}
        </div>
        {form.expense_type === 'meal' && <select className={field} value={form.meal_kind} onChange={set('meal_kind')}>{Object.entries(MEAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
        {form.expense_type === 'spare_part' && <>
          <select className={field} value={form.catalog_item_id} onChange={(e) => { const it = parts.find((x) => String(x.id) === e.target.value); setForm((f) => ({ ...f, catalog_item_id: e.target.value, item_name: it?.name || f.item_name, sale_price: it ? String(it.basePrice) : f.sale_price })) }}>
            <option value="">قطعة من جدول الأسعار (اختياري)…</option>
            {parts.map((x) => <option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}
          </select>
          <input className={field} value={form.item_name} onChange={set('item_name')} placeholder="اسم القطعة كما في الفاتورة (أو قطعة غير موجودة بالجدول)" />
        </>}
        {form.expense_type === 'other' && <input className={field} value={form.item_name} onChange={set('item_name')} placeholder="وصف المصروف" />}
        <div className="grid grid-cols-3 gap-2">
          {form.expense_type === 'spare_part' && <input className={field} type="number" min="1" step="1" value={form.quantity} onChange={set('quantity')} placeholder="الكمية" />}
          <input required className={field} type="number" min="0.01" step="0.01" value={form.purchase_price} onChange={set('purchase_price')} placeholder={form.expense_type === 'spare_part' ? 'سعر الشراء للقطعة' : 'قيمة الفاتورة'} />
          {form.expense_type === 'spare_part' && <input className={field} type="number" min="0" step="0.01" value={form.sale_price} onChange={set('sale_price')} placeholder="سعر البيع للعميل" />}
        </div>
        <input className={field} inputMode="numeric" value={form.request_id} onChange={set('request_id')} placeholder="رقم الطلب المرتبط (إن وجد)" />
        <select className={field} value={form.paid_from} onChange={set('paid_from')}>
          <option value="cash_on_hand">دفعتها من النقدية المحصلة معي</option>
          <option value="own_pocket">دفعتها من جيبي (تُسجّل مستحقاً لي)</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <PhotoInput label="صورة الفاتورة *" file={invoice} onChange={setInvoice} />
          {form.expense_type === 'spare_part' && <PhotoInput label="صورة القطعة *" file={part} onChange={setPart} />}
        </div>
        <textarea className={field} rows="2" value={form.note} onChange={set('note')} placeholder="ملاحظة (اختياري)" />
        <button disabled={busy} className="rounded-xl bg-primary py-3 text-sm font-black text-black disabled:opacity-50">{busy ? 'جارِ الرفع…' : 'رفع الفاتورة للمراجعة'}</button>
        <p className="text-[10px] text-slate-400">لا تُخصم أي فاتورة من عهدتك قبل اعتمادها من المالك أو العمليات. نفس صورة الفاتورة لا تُقبل مرتين.</p>
      </form></Card>)}

    {tab === 'expenses' && <div className="flex flex-col gap-2">
      {(data?.expenses || []).length === 0 && <p className="text-sm text-slate-500 text-center py-6">لا توجد فواتير بعد.</p>}
      {(data?.expenses || []).map((x) => <Card key={x.id}>
        <div className="flex justify-between gap-2 items-start">
          <div>
            <p className="text-sm font-bold text-white">{EXPENSE_LABELS[x.expense_type]}{x.meal_kind ? ` — ${MEAL_LABELS[x.meal_kind]}` : ''}{x.item_name ? ` — ${x.item_name}` : ''}</p>
            <p className="text-xs text-slate-400">{x.created_at}{x.request_id ? ` · طلب #${x.request_id}` : ''} · {x.paid_from === 'own_pocket' ? 'من جيب الفني' : 'من النقدية'}</p>
            <p className="text-xs text-slate-300 mt-1">شراء: <b>{money(x.purchase_price * x.quantity)}</b>{x.sale_price ? <> · بيع للعميل: <b>{money(x.sale_price * x.quantity)}</b></> : null}</p>
            {x.review_note && <p className="text-xs text-amber-200 mt-1">ملاحظة الإدارة: {x.review_note}</p>}
          </div>
          <span className={`text-[10px] rounded-full px-2 py-1 ${STATUS_CLS[x.status]}`}>{STATUS_LABELS[x.status]}</span>
        </div>
        <div className="flex gap-2 mt-2"><Img src={x.invoice_image_path} label="الفاتورة" /><Img src={x.part_image_path} label="القطعة" /></div>
      </Card>)}
    </div>}

    {tab === 'cash' && <div className="flex flex-col gap-2">
      {(data?.cash || []).length === 0 && <p className="text-sm text-slate-500 text-center py-6">لا توجد طلبات نقدية.</p>}
      {(data?.cash || []).map((c) => <Card key={c.id}><div className="flex justify-between text-sm">
        <span className="text-white">طلب #{c.request_id} {c.service_name ? `— ${c.service_name}` : ''}</span>
        <span className={c.status === 'received' ? 'text-emerald-300 font-bold' : 'text-amber-200'}>{c.status === 'received' ? `مستلم ${money(c.received_amount)}` : `متوقع ${money(c.expected_amount)}`}</span>
      </div>{c.status === 'expected' && <button onClick={() => navigate(`/staff/order/${c.request_id}`)} className="mt-2 text-xs text-primary font-bold">افتح الطلب لتأكيد الاستلام ←</button>}</Card>)}
    </div>}

    {tab === 'ledger' && <Card>
      {(data?.ledger || []).length === 0 && <p className="text-sm text-slate-500 text-center py-4">لا توجد حركات معتمدة بعد.</p>}
      {(data?.ledger || []).map((l) => <div key={l.id} className="flex justify-between gap-2 py-2 border-b border-white/5 text-xs">
        <div><p className="text-white">{l.description}</p><p className="text-slate-500">{LEDGER_LABELS[l.entry_type]} · {l.created_at} · نظام {l.pay_model_snapshot === 'monthly' ? 'شهري' : 'نسبة'}</p></div>
        <b className={Number(l.amount) >= 0 ? 'text-amber-200' : 'text-emerald-300'} dir="ltr">{Number(l.amount) >= 0 ? '+' : '−'}{money(Math.abs(l.amount))}</b>
      </div>)}
      <p className="text-[10px] text-slate-500 mt-2">+ مبلغ على الفني للشركة · − مبلغ لصالح الفني</p>
    </Card>}

    {tab === 'suggest' && <Card><form onSubmit={sendSuggestion} className="flex flex-col gap-2">
      <p className="text-xs text-slate-300">اشتريت قطعة غير موجودة في جدول الأسعار أو اسمها مختلف؟ اقترحها، وتظهر للجميع بعد اعتماد الإدارة. السعر العام لا يتغير إلا بالاعتماد.</p>
      <input required className={field} value={suggest.item_name} onChange={(e) => setSuggest((s) => ({ ...s, item_name: e.target.value }))} placeholder="اسم القطعة / البند" />
      <div className="grid grid-cols-2 gap-2">
        <input className={field} type="number" min="0" step="0.01" value={suggest.purchase_price} onChange={(e) => setSuggest((s) => ({ ...s, purchase_price: e.target.value }))} placeholder="سعر الشراء" />
        <input required className={field} type="number" min="0" step="0.01" value={suggest.base_price} onChange={(e) => setSuggest((s) => ({ ...s, base_price: e.target.value }))} placeholder="سعر البيع المقترح قبل الضريبة" />
      </div>
      <button disabled={busy} className="rounded-xl border border-white/20 py-2.5 text-sm font-bold text-white"><Plus size={14} className="inline" /> إرسال الاقتراح</button>
    </form></Card>}
  </Shell>
}

function PhotoInput({ label, file, onChange }) {
  return <label className="rounded-xl border border-dashed border-white/20 bg-white/5 p-3 text-center cursor-pointer">
    <Camera size={18} className="mx-auto text-slate-300" />
    <span className="block text-xs text-slate-200 mt-1">{file ? `✓ ${file.name}` : label}</span>
    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onChange(e.target.files?.[0] || null)} />
  </label>
}
export function Card({ children }) { return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white">{children}</section> }
export function Shell({ title, back, children }) {
  return <div className="h-full overflow-y-auto pb-24 bg-[#090c14]" dir="rtl">
    <header className="sticky top-0 z-20 bg-[#090c14]/90 backdrop-blur border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
        <button onClick={back} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"><ChevronRight size={18} className="text-slate-300" /></button>
        <h1 className="font-display text-lg font-black text-white flex items-center gap-2"><Wallet size={18} /> {title}</h1>
      </div>
    </header>
    <main className="max-w-3xl mx-auto px-4 pt-5 flex flex-col gap-4">{children}</main>
  </div>
}
