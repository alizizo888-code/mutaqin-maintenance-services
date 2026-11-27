import { useEffect, useState } from 'react'
import { Banknote, Receipt } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { financeApi } from '../lib/phpApi'
import { money, EXPENSE_LABELS, STATUS_LABELS } from './FinanceBits'

/** On the staff order screen: customer chose cash → expected; technician confirms what he actually received. */
export default function OrderCashPanel({ order }) {
  const navigate = useNavigate()
  const requestId = /^\d+$/.test(String(order?.id ?? '')) ? Number(order.id) : 0
  const [data, setData] = useState(null)
  const [amount, setAmount] = useState('')
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const load = async () => {
    if (!requestId) return
    try { const d = await financeApi('request_cash', { params: { request_id: requestId } }); setData(d); setAmount(String(d.collection?.expected_amount ?? d.request?.quoted_total ?? '')) }
    catch (e) { setErr(e.message) }
  }
  useEffect(() => { load() }, [requestId])
  if (!requestId) return null
  const act = async (action, body) => {
    setBusy(true); setErr(''); setMsg('')
    try { const r = await financeApi(action, { method: 'POST', body: { request_id: requestId, ...body } }); setMsg(r.message); await load() }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const c = data?.collection
  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white">
    <h2 className="font-black flex items-center gap-2"><Banknote size={17} /> التحصيل النقدي</h2>
    {data?.request?.quoted_total && <p className="text-xs text-slate-400 mt-1">إجمالي التسعيرة المعتمدة: <b className="text-white">{money(data.request.quoted_total)}</b></p>}
    {!c && <button disabled={busy} onClick={() => act('mark_cash_expected', { expected_amount: Number(amount) || undefined })} className="mt-3 w-full rounded-xl border border-white/20 py-2.5 text-xs font-bold">العميل اختار الدفع نقداً</button>}
    {c && c.status === 'received' && <p className="mt-3 text-sm text-emerald-300 font-bold">تم استلام {money(c.received_amount)} نقداً ({c.confirmed_at}) — مسجّل في عهدة الفني.</p>}
    {(!c || c.status === 'expected') && <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
      <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" className="rounded-xl bg-white text-slate-900 px-3 py-2 text-sm" placeholder="المبلغ المستلم فعلياً" />
      <button disabled={busy || amount === ''} onClick={() => act('confirm_cash', { received_amount: Number(amount) })} className="rounded-xl bg-primary px-4 text-xs font-black text-black disabled:opacity-50">تأكيد الاستلام</button>
    </div>}
    {c?.status === 'expected' && <p className="text-[10px] text-amber-200 mt-1">مبلغ متوقع {money(c.expected_amount)} — لا يُحتسب في العهدة قبل تأكيد الاستلام.</p>}
    {(data?.expenses || []).length > 0 && <div className="mt-3 border-t border-white/10 pt-2">
      {data.expenses.map((x) => <p key={x.id} className="flex justify-between text-xs py-1"><span>{EXPENSE_LABELS[x.expense_type]}{x.item_name ? ` — ${x.item_name}` : ''} · {STATUS_LABELS[x.status]}</span><b>{money(x.purchase_price * x.quantity)}</b></p>)}
    </div>}
    <button onClick={() => navigate('/staff/my-wallet')} className="mt-3 text-xs text-primary font-bold flex items-center gap-1"><Receipt size={13} /> رفع فاتورة قطعة غيار / بنزين / وجبة لهذا الطلب</button>
    {msg && <p className="text-xs text-emerald-300 mt-2">{msg}</p>}
    {err && <p className="text-xs text-rose-300 mt-2">{err}</p>}
  </section>
}
