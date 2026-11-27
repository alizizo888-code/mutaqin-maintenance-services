// Shared pieces for the technician finance screens (wallet, admin, order cash panel).
export const money = (v) => `${Number(v || 0).toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ر.س`

export const EXPENSE_LABELS = { spare_part: 'قطعة غيار', fuel: 'بنزين', meal: 'وجبة', other: 'مصروف آخر' }
export const MEAL_LABELS = { breakfast: 'فطور', lunch: 'غداء', dinner: 'عشاء' }
export const STATUS_LABELS = { new: 'جديد', under_review: 'تحت المراجعة', approved: 'معتمد', rejected: 'مرفوض' }
export const STATUS_CLS = {
  new: 'bg-sky-500/15 text-sky-200', under_review: 'bg-amber-500/15 text-amber-200',
  approved: 'bg-emerald-500/15 text-emerald-200', rejected: 'bg-rose-500/15 text-rose-200',
}
export const LEDGER_LABELS = {
  cash_received: 'نقد مستلم', technician_share: 'نصيب الفني', part_purchase: 'قطع غيار',
  expense: 'مصروف', adjustment: 'تعديل المالك', settlement: 'تسوية',
}

export function Stat({ label, value, tone = 'text-white', hint }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
    <p className="text-[11px] text-slate-400">{label}</p>
    <p className={`text-lg font-black mt-1 ${tone}`}>{value}</p>
    {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
  </div>
}

export function SummaryGrid({ summary, payModel }) {
  if (!summary) return null
  const b = Number(summary.balance || 0)
  return <>
    <div className={`rounded-2xl p-4 border ${b > 0 ? 'bg-primary/15 border-primary/30' : b < 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
      <p className="text-xs text-slate-300">{b > 0 ? 'صافي النقدية المطلوب توريدها للشركة' : b < 0 ? 'مستحق للفني على الشركة' : 'الحساب متوازن'}</p>
      <p className="text-3xl font-black text-white mt-1">{money(Math.abs(b))}</p>
      <p className="text-[10px] text-slate-400 mt-1">يُحسب من الحركات المعتمدة فقط. الفواتير قيد المراجعة والنقد المتوقع لا يدخلان في الرصيد.</p>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="النقدية المحصلة" value={money(summary.cash_received)} />
      {payModel === 'commission' && <Stat label="نصيب الفني من النقد" value={money(summary.technician_share)} tone="text-emerald-300" />}
      <Stat label="قطع الغيار المعتمدة" value={money(summary.parts)} tone="text-amber-200" />
      <Stat label="المصروفات المعتمدة" value={money(summary.expenses)} tone="text-amber-200" />
      <Stat label="تعديلات المالك" value={money(summary.adjustments)} />
      <Stat label="ما تم توريده/صرفه" value={money(summary.settlements)} />
      <Stat label="فواتير بانتظار المراجعة" value={money(summary.pending_review_amount)} hint={`${summary.pending_review_count} فاتورة`} tone="text-sky-200" />
      <Stat label="نقد متوقع لم يُؤكَّد" value={money(summary.expected_cash_amount)} hint={`${summary.expected_cash_count} طلب`} tone="text-slate-300" />
    </div>
  </>
}

export function Img({ src, label }) {
  if (!src) return null
  return <a href={src} target="_blank" rel="noreferrer" className="block">
    <img src={src} alt={label} className="w-20 h-20 object-cover rounded-xl border border-white/10" loading="lazy" />
    <span className="text-[10px] text-slate-400">{label}</span>
  </a>
}

export const field = 'w-full rounded-xl bg-white text-slate-900 px-3 py-2.5 text-sm outline-none'
