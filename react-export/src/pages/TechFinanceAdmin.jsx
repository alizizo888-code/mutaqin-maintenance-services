import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, Settings2, Scale, Eye } from 'lucide-react'
import { financeApi } from '../lib/phpApi'
import { useTeamRole } from '../hooks/useTeamRole'
import { Shell, Card } from './TechWallet'
import { money, EXPENSE_LABELS, MEAL_LABELS, Img, field } from '../components/FinanceBits'

const TOGGLES = [
  ['can_buy_parts', 'شراء قطع غيار تُخصم من العهدة'],
  ['can_add_expenses', 'إضافة مصروفات (بنزين / وجبات / أخرى)'],
  ['can_edit_prices', 'تعديل سعر الطلب بعد المعاينة'],
  ['can_edit_orders', 'تعديل الطلب'],
  ['can_suggest_catalog', 'اقتراح أصناف وأسعار جديدة'],
  ['is_frozen', 'تجميد الحساب المالي'],
]

/** Owner / operations: every technician's account, invoice review, pay-model control and settlement. */
export default function TechFinanceAdmin() {
  const navigate = useNavigate()
  const { role, isOwner, loading } = useTeamRole()
  const manager = isOwner || role === 'operations'
  const [techs, setTechs] = useState([])
  const [queue, setQueue] = useState({ expenses: [], suggestions: [] })
  const [tab, setTab] = useState('review')
  const [open, setOpen] = useState(null)
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try {
      const [t, q] = await Promise.all([financeApi('technicians'), financeApi('review_queue')])
      setTechs(t.technicians || []); setQueue({ expenses: q.expenses || [], suggestions: q.suggestions || [] }); setErr('')
    } catch (e) { setErr(e.message) }
  }, [])
  useEffect(() => { if (manager) load() }, [manager, load])
  const run = async (fn) => { setErr(''); setMsg(''); try { const r = await fn(); setMsg(r?.message || 'تم.'); await load() } catch (e) { setErr(e.message); throw e } }

  if (loading) return <Shell title="حسابات الفنيين" back={() => navigate('/staff')}><p className="text-slate-400 text-sm">جارِ التحقق…</p></Shell>
  if (!manager) return <Shell title="حسابات الفنيين" back={() => navigate('/staff')}><p className="text-slate-400 text-sm">هذه الصفحة للمالك ومشرف العمليات فقط.</p></Shell>

  return <Shell title="حسابات الفنيين والتحصيل" back={() => navigate('/staff')}>
    <div className="flex gap-2 overflow-x-auto">
      {[['review', `مراجعة الفواتير (${queue.expenses.length})`], ['techs', 'الفنيون والأرصدة'], ['suggest', `أصناف مقترحة (${queue.suggestions.length})`]].map(([k, l]) =>
        <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold border ${tab === k ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 text-slate-300'}`}>{l}</button>)}
    </div>
    {msg && <p className="text-xs font-bold text-emerald-300">{msg}</p>}
    {err && <p className="text-xs font-bold text-rose-300">{err}</p>}

    {tab === 'review' && <div className="flex flex-col gap-2">
      {queue.expenses.length === 0 && <p className="text-sm text-slate-500 text-center py-6">لا توجد فواتير بانتظار المراجعة.</p>}
      {queue.expenses.map((x) => <ReviewCard key={x.id} x={x} onDecide={(decision, extra) => run(() => financeApi('review_expense', { method: 'POST', body: { expense_id: x.id, decision, ...extra } }))} />)}
    </div>}

    {tab === 'techs' && <div className="flex flex-col gap-2">
      {techs.map((t) => <Card key={t.id}>
        <div className="flex justify-between gap-2 items-center">
          <div>
            <p className="font-bold">{t.full_name} <span className="text-[10px] rounded-full bg-white/10 px-2 py-0.5">{t.pay_model === 'monthly' ? 'شهري' : 'نسبة'}</span>{!!Number(t.is_frozen) && <span className="text-[10px] text-rose-300"> مجمّد</span>}</p>
            <p className="text-xs text-slate-400">مستوى الصلاحيات {t.permission_level} · فواتير معلقة {t.summary.pending_review_count} · نقد متوقع {money(t.summary.expected_cash_amount)}</p>
          </div>
          <div className="text-left">
            <p className={`font-black ${t.summary.balance > 0 ? 'text-primary' : t.summary.balance < 0 ? 'text-emerald-300' : 'text-slate-300'}`}>{money(Math.abs(t.summary.balance))}</p>
            <p className="text-[10px] text-slate-400">{t.summary.balance > 0 ? 'مطلوب توريده' : t.summary.balance < 0 ? 'مستحق له' : 'متوازن'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => navigate(`/staff/my-wallet?technician_id=${t.id}`)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold"><Eye size={12} className="inline" /> فتح حسابه</button>
          <button onClick={() => setOpen(open === `p${t.id}` ? null : `p${t.id}`)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold"><Settings2 size={12} className="inline" /> النظام والصلاحيات</button>
          <button onClick={() => setOpen(open === `s${t.id}` ? null : `s${t.id}`)} className="rounded-full bg-primary/80 text-black px-3 py-1.5 text-xs font-bold"><Scale size={12} className="inline" /> تسوية / تعديل رصيد</button>
        </div>
        {open === `p${t.id}` && <ProfileEditor techId={t.id} isOwner={isOwner} run={run} />}
        {open === `s${t.id}` && <SettleBox t={t} isOwner={isOwner} run={run} />}
      </Card>)}
    </div>}

    {tab === 'suggest' && <div className="flex flex-col gap-2">
      {queue.suggestions.length === 0 && <p className="text-sm text-slate-500 text-center py-6">لا توجد اقتراحات.</p>}
      {queue.suggestions.map((s) => <SuggestionCard key={s.id} s={s} run={run} />)}
    </div>}
  </Shell>
}

function ReviewCard({ x, onDecide }) {
  const total = Number(x.purchase_price) * Number(x.quantity)
  const [amount, setAmount] = useState(String(total)); const [note, setNote] = useState('')
  return <Card>
    <div className="flex justify-between gap-2">
      <div>
        <p className="font-bold text-sm">{x.technician_name} — {EXPENSE_LABELS[x.expense_type]}{x.meal_kind ? ` (${MEAL_LABELS[x.meal_kind]})` : ''}{x.item_name ? `: ${x.item_name}` : ''}</p>
        <p className="text-xs text-slate-400">{x.created_at}{x.request_id ? ` · طلب #${x.request_id}` : ''} · نظام {x.pay_model_snapshot === 'monthly' ? 'شهري' : 'نسبة'} · {x.paid_from === 'own_pocket' ? 'من جيبه' : 'من النقدية'}</p>
        <p className="text-xs mt-1">الشراء <b>{money(total)}</b>{x.sale_price ? <> · البيع للعميل <b>{money(x.sale_price * x.quantity)}</b> · الهامش <b>{money((x.sale_price - x.purchase_price) * x.quantity)}</b></> : null}</p>
        {x.note && <p className="text-xs text-slate-300 mt-1">{x.note}</p>}
      </div>
    </div>
    <div className="flex gap-2 mt-2"><Img src={x.invoice_image_path} label="الفاتورة" /><Img src={x.part_image_path} label="القطعة" /></div>
    <div className="grid grid-cols-[110px_1fr] gap-2 mt-3">
      <input className={field} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} title="المبلغ المعتمد" />
      <input className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة للفني (اختياري)" />
    </div>
    <div className="grid grid-cols-3 gap-2 mt-2">
      <button onClick={() => onDecide('approved', { approved_amount: Number(amount), review_note: note })} className="rounded-xl bg-emerald-600 py-2 text-xs font-black"><CheckCircle2 size={13} className="inline" /> اعتماد وخصم</button>
      <button onClick={() => onDecide('under_review', { review_note: note })} className="rounded-xl bg-amber-600 py-2 text-xs font-black">تحت المراجعة</button>
      <button onClick={() => onDecide('rejected', { review_note: note })} className="rounded-xl bg-rose-600 py-2 text-xs font-black"><XCircle size={13} className="inline" /> رفض</button>
    </div>
  </Card>
}

function ProfileEditor({ techId, isOwner, run }) {
  const [p, setP] = useState(null); const [eff, setEff] = useState(''); const [history, setHistory] = useState([])
  useEffect(() => {
    financeApi('me', { params: { technician_id: techId } }).then((d) => setP(d.profile)).catch(() => {})
    financeApi('profile_history', { params: { technician_id: techId } }).then((d) => setHistory(d.history || [])).catch(() => {})
  }, [techId])
  if (!p) return <p className="text-xs text-slate-400 mt-3">جارِ التحميل…</p>
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }))
  const switchModel = (m) => setP((x) => ({ ...x, pay_model: m, can_buy_parts: m === 'monthly' ? 1 : 0, can_add_expenses: m === 'monthly' ? 1 : 0 }))
  return <div className="mt-3 rounded-xl bg-black/20 p-3 flex flex-col gap-2">
    {!isOwner && <p className="text-[11px] text-amber-200">تغيير النظام والصلاحيات للمالك فقط؛ يمكنك الاطلاع.</p>}
    <div className="grid grid-cols-2 gap-2">
      {[['monthly', 'شهري'], ['commission', 'نسبة']].map(([k, l]) => <button key={k} disabled={!isOwner} onClick={() => switchModel(k)} className={`rounded-xl py-2 text-xs font-bold border ${p.pay_model === k ? 'bg-primary text-black border-primary' : 'border-white/15'}`}>{l}</button>)}
    </div>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <label>نسبة الشركة من النقد %<input disabled={!isOwner} className={field} type="number" value={p.company_share_cash} onChange={(e) => set('company_share_cash', e.target.value)} /></label>
      <label>نسبة الشركة من التحويل %<input disabled={!isOwner} className={field} type="number" value={p.company_share_transfer} onChange={(e) => set('company_share_transfer', e.target.value)} /></label>
      <label>الراتب الشهري<input disabled={!isOwner} className={field} type="number" value={p.monthly_salary ?? ''} onChange={(e) => set('monthly_salary', e.target.value)} /></label>
      <label>حد العهدة النقدية (0 = بلا حد)<input disabled={!isOwner} className={field} type="number" value={p.custody_limit} onChange={(e) => set('custody_limit', e.target.value)} /></label>
      <label>مستوى الصلاحيات (1–10)<input disabled={!isOwner} className={field} type="number" min="1" max="10" value={p.permission_level} onChange={(e) => set('permission_level', e.target.value)} /></label>
      <label>يسري اعتباراً من<input disabled={!isOwner} className={field} type="datetime-local" value={eff} onChange={(e) => setEff(e.target.value)} /></label>
    </div>
    {TOGGLES.map(([k, l]) => <label key={k} className="flex justify-between items-center text-xs"><span>{l}</span><input disabled={!isOwner} type="checkbox" checked={!!Number(p[k])} onChange={(e) => set(k, e.target.checked ? 1 : 0)} /></label>)}
    {isOwner && <button onClick={() => run(() => financeApi('save_profile', { method: 'POST', body: { technician_id: techId, ...p, effective_from: eff ? eff.replace('T', ' ') : '' } }))} className="rounded-xl bg-primary py-2.5 text-xs font-black text-black">حفظ — لا يغيّر الحسابات السابقة</button>}
    {history.length > 0 && <details className="text-[11px] text-slate-400"><summary>سجل التغييرات ({history.length})</summary>
      {history.map((h) => { const o = JSON.parse(h.old_json || '{}'), n = JSON.parse(h.new_json || '{}'); const diff = Object.keys(n).filter((k) => String(o[k]) !== String(n[k])); return <p key={h.id} className="mt-1">{h.created_at} — {h.changed_by_name || 'المالك'} — يسري {h.effective_from}: {diff.map((k) => `${k}: ${o[k] ?? '—'} ← ${n[k]}`).join(' · ') || 'بدون تغيير'}</p> })}
    </details>}
  </div>
}

function SettleBox({ t, isOwner, run }) {
  const b = Number(t.summary.balance)
  const [amount, setAmount] = useState(String(Math.abs(b) || '')); const [method, setMethod] = useState('cash'); const [note, setNote] = useState('')
  const [adj, setAdj] = useState(''); const [adjNote, setAdjNote] = useState('')
  const settle = async (ignore = false) => {
    try { await run(() => financeApi('settle', { method: 'POST', body: { technician_id: t.id, amount: Number(amount), direction: b < 0 ? 'company_to_tech' : 'tech_to_company', method, note, ignore_pending: ignore } })) }
    catch (e) { if (e.payload?.code === 'PENDING_EXPENSES' && window.confirm?.('توجد فواتير غير مراجعة. هل تريد التسوية الآن مع بقائها معلّقة؟')) settle(true) }
  }
  return <div className="mt-3 rounded-xl bg-black/20 p-3 flex flex-col gap-2 text-xs">
    <p>{b > 0 ? `على الفني توريد ${money(b)}` : b < 0 ? `للفني مستحق ${money(-b)}` : 'الحساب متوازن'}</p>
    <div className="grid grid-cols-2 gap-2">
      <input className={field} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="المبلغ المستلم/المدفوع فعلياً" />
      <select className={field} value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">نقداً</option><option value="bank_transfer">تحويل بنكي</option><option value="wallet">محفظة</option></select>
    </div>
    <input className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة / رقم الإيصال" />
    <button onClick={() => settle(false)} className="rounded-xl bg-primary py-2.5 font-black text-black">{b < 0 ? 'تسجيل صرف المستحق للفني' : 'تسجيل استلام التوريد'}</button>
    {isOwner && <>
      <p className="mt-2 text-slate-400">تعديل الرصيد (موجب = على الفني، سالب = لصالحه)</p>
      <div className="grid grid-cols-[110px_1fr] gap-2">
        <input className={field} type="number" step="0.01" value={adj} onChange={(e) => setAdj(e.target.value)} placeholder="±المبلغ" />
        <input className={field} value={adjNote} onChange={(e) => setAdjNote(e.target.value)} placeholder="السبب (إلزامي)" />
      </div>
      <button onClick={() => run(() => financeApi('adjust', { method: 'POST', body: { technician_id: t.id, amount: Number(adj), note: adjNote } }))} className="rounded-xl border border-white/20 py-2 font-bold">تسجيل التعديل</button>
    </>}
  </div>
}

function SuggestionCard({ s, run }) {
  const [code, setCode] = useState(''); const [price, setPrice] = useState(String(s.base_price))
  return <Card>
    <p className="font-bold text-sm">{s.item_name}</p>
    <p className="text-xs text-slate-400">اقترحه {s.suggested_by_name || 'فني'} · شراء {s.purchase_price ? money(s.purchase_price) : '—'} · بيع مقترح {money(s.base_price)}</p>
    <div className="grid grid-cols-2 gap-2 mt-2">
      <input className={field} dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="الكود النهائي AC-XXX-001" />
      <input className={field} type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="سعر البيع المعتمد" />
    </div>
    <div className="grid grid-cols-2 gap-2 mt-2">
      <button onClick={() => run(() => financeApi('review_suggestion', { method: 'POST', body: { id: s.id, decision: 'approved', item_code: code, base_price: Number(price) } }))} className="rounded-xl bg-emerald-600 py-2 text-xs font-black">اعتماد وإضافة للجدول</button>
      <button onClick={() => run(() => financeApi('review_suggestion', { method: 'POST', body: { id: s.id, decision: 'rejected' } }))} className="rounded-xl bg-rose-600 py-2 text-xs font-black">رفض</button>
    </div>
  </Card>
}
