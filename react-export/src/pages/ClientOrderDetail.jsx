import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, MapPin, Wrench, ShieldCheck, XCircle, CreditCard, Loader2 } from 'lucide-react'
import { payments } from '../lib/payments'
import { startOrderPayment, verifyOrderPayment, recordCheckoutReturn, paymentMethods, orderAmount, paymentErrorText, ONLINE_STATUS } from '../payment'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import MapView from '../components/MapView'
import StatusBadge from '../components/StatusBadge'
import StatusTimeline from '../components/StatusTimeline'
import RatingStars from '../components/RatingStars'
import { SPECIALTIES } from '../constants'
import { useWarrantyPolicy } from '../hooks/useWarranty'
import { orderWarranty, warrantyText } from '../warranty'

export default function ClientOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: orders, loading } = useLiveShared('orders', { limit: 200 })
  const order = useMemo(() => orders.find((o) => o.id === id), [orders, id])
  const [busy, setBusy] = useState(false)
  const [ratingVal, setRatingVal] = useState(5)
  const [comment, setComment] = useState('')
  const [methods, setMethods] = useState(null)
  const [paying, setPaying] = useState(false)
  const [payMsg, setPayMsg] = useState('')
  const { policy: warrantyPolicy } = useWarrantyPolicy()

  useEffect(() => { paymentMethods().then(setMethods) }, [])
  // Payment truth = the provider's verified record. Re-check on return and on every live payment poke.
  useEffect(() => {
    if (!order) return
    recordCheckoutReturn(order).then((st) => {
      if (st === 'success') setPayMsg('جارِ انتظار تأكيد مزود الدفع…')
      if (st === 'canceled') setPayMsg('لم يكتمل الدفع.')
    })
    verifyOrderPayment(order).then((ok) => ok && setPayMsg(''))
    const sub = payments.onPayment(() => verifyOrderPayment(order).then((ok) => ok && setPayMsg('')))
    return () => sub.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id])

  async function pay() {
    setPaying(true)
    setPayMsg('')
    try { await startOrderPayment(order) } catch (e) { setPayMsg(paymentErrorText(e)) } finally { setPaying(false) }
  }

  if (loading) return <Centered>جارِ التحميل…</Centered>
  if (!order) return <Centered>لم يتم العثور على الطلب</Centered>

  const spec = SPECIALTIES.find((s) => s.id === order.specialtyId) || { icon: '🔧', label: order.specialtyId }
  const canCancel = ['new', 'assigned', 'accepted'].includes(order.status)
  const showTechMap = ['en_route', 'nearby'].includes(order.status) && order.technicianLocation

  async function cancelOrder() {
    if (!confirm('هل تريد إلغاء هذا الطلب؟')) return
    setBusy(true)
    try {
      await db.updateShared('orders', order.id, {
        status: 'cancelled',
        statusHistory: [...(order.statusHistory || []), { status: 'cancelled', at: new Date().toISOString(), by: 'client' }],
      })
    } finally {
      setBusy(false)
    }
  }

  async function submitRating() {
    setBusy(true)
    try {
      await db.updateShared('orders', order.id, {
        rating: ratingVal,
        ratingComment: comment,
        ratedAt: new Date().toISOString(),
        status: 'closed',
        statusHistory: [...(order.statusHistory || []), { status: 'closed', at: new Date().toISOString(), by: 'client', note: 'تقييم العميل' }],
      })
    } finally {
      setBusy(false)
    }
  }

  const warranty = orderWarranty(order, warrantyPolicy)
  const withinWarranty = ['completed', 'closed'].includes(order.status) && !order.isWarranty && warranty.known && warranty.active

  return (
    <div className="h-full overflow-y-auto pb-28" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#f5f7f5]/90 backdrop-blur border-b border-black/5 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-2xl mx-auto w-full px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white border border-black/5 shadow-sm flex items-center justify-center active:scale-[0.95] transition-transform">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-black text-slate-900 truncate">{spec.icon} {spec.label}</h1>
          </div>
          <div className="mr-auto"><StatusBadge status={order.status} /></div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto w-full px-4 pt-5 flex flex-col gap-5">
        {order.description && (
          <Card>
            <p className="text-sm text-slate-700 leading-relaxed">{order.description}</p>
          </Card>
        )}

        {showTechMap && (
          <Card>
            <p className="text-xs font-bold text-secondary mb-2 flex items-center gap-1.5"><Wrench size={13} /> موقع الفني الآن</p>
            <div className="rounded-xl overflow-hidden border border-black/5">
              <MapView
                center={[order.technicianLocation.lat, order.technicianLocation.lng]}
                zoom={14}
                markers={[
                  { lat: order.technicianLocation.lat, lng: order.technicianLocation.lng, label: '🔧', popup: order.technicianName },
                  { lat: order.lat, lng: order.lng, label: '📍', popup: 'موقعك' },
                ]}
                className="h-48"
              />
            </div>
          </Card>
        )}

        {order.technicianName && (
          <Card>
            <p className="text-xs font-bold text-slate-500 mb-1">الفني المسند</p>
            <p className="text-slate-900 font-bold">{order.technicianName}</p>
          </Card>
        )}

        <Card>
          <p className="text-xs font-bold text-slate-500 mb-3">حالة الطلب</p>
          <StatusTimeline status={order.status} />
        </Card>

        {order.address && (
          <Card>
            <p className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><MapPin size={12} /> الموقع</p>
            <p className="text-sm text-slate-700">{order.address}</p>
          </Card>
        )}

        {(order.status === 'completed' || order.status === 'closed') && (
          <Card>
            <p className="text-xs font-bold text-slate-500 mb-2">الفاتورة</p>
            {order.report && <p className="text-sm text-slate-700 mb-2">{order.report}</p>}
            {order.spareParts && <p className="text-xs text-slate-500 mb-2">قطع الغيار: {order.spareParts}</p>}
            <div className="flex items-center justify-between border-t border-black/5 pt-2 mt-2">
              <span className="text-slate-500 text-sm">الإجمالي</span>
              <span className="font-display font-black text-primary text-lg">{order.price ? `${order.price} ر.س` : '—'}</span>
            </div>
          </Card>
        )}

        {order.status !== 'cancelled' && orderAmount(order) > 0 && (
          <Card>
            <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1"><CreditCard size={12} /> الدفع</p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">المبلغ</span>
              <span className="font-display font-black text-slate-900">{orderAmount(order)} ر.س</span>
            </div>
            {order.paymentStatus === 'paid' ? (
              <p className="text-emerald-600 text-sm font-bold">✓ {order.paymentMethod === 'online' ? 'مدفوع إلكترونيًا — مؤكَّد من مزود الدفع' : 'تم تسجيل الدفع'}</p>
            ) : (
              <>
                {order.onlinePayment?.status && ONLINE_STATUS[order.onlinePayment.status] && (
                  <p className={`text-[11px] font-bold mb-2 ${order.onlinePayment.status === 'failed' ? 'text-rose-500' : 'text-amber-600'}`}>{ONLINE_STATUS[order.onlinePayment.status].label}</p>
                )}
                {methods?.online ? (
                  <button onClick={pay} disabled={paying} className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-sky-500 to-blue-600 text-white font-bold rounded-2xl py-3 disabled:opacity-60 active:scale-[0.98] transition-transform">
                    {paying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />} ادفع الآن إلكترونيًا
                  </button>
                ) : null}
                {methods?.details?.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    <p className="text-[11px] font-bold text-slate-500">{methods.online ? 'أو ادفع بإحدى الطرق التالية:' : 'طرق الدفع المتاحة:'}</p>
                    {methods.details.map((d) => (
                      <p key={d} className="text-[11px] text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5 leading-relaxed">• {d}</p>
                    ))}
                  </div>
                )}
                {payMsg && <p className="text-[11px] font-bold text-slate-600 mt-2 text-center">{payMsg}</p>}
              </>
            )}
          </Card>
        )}

        {order.status === 'completed' && !order.rating && (
          <Card>
            <p className="text-xs font-bold text-slate-500 mb-3">قيّم الخدمة</p>
            <RatingStars value={ratingVal} onChange={setRatingVal} size={26} />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="أضف تعليقًا (اختياري)"
              rows={2}
              className="w-full mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <button onClick={submitRating} disabled={busy} className="w-full mt-3 bg-primary text-white font-display font-black rounded-2xl py-3.5 disabled:opacity-50 active:scale-[0.98] transition-transform">
              إرسال التقييم وإغلاق الطلب
            </button>
          </Card>
        )}

        {order.rating && (
          <Card>
            <p className="text-xs font-bold text-slate-500 mb-2">تقييمك</p>
            <RatingStars value={order.rating} readOnly size={20} />
            {order.ratingComment && <p className="text-sm text-slate-500 mt-2">{order.ratingComment}</p>}
          </Card>
        )}

        {warranty.known && !order.isWarranty && (
          <Card>
            <p className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><ShieldCheck size={12} /> الضمان</p>
            <p className={`text-sm font-bold ${warranty.active ? 'text-emerald-600' : 'text-slate-500'}`}>{warrantyText(warranty)}</p>
          </Card>
        )}

        {withinWarranty && (
          <button
            onClick={() => navigate(`/warranty?order=${order.id}`)}
            className="w-full flex items-center justify-center gap-2 bg-secondary/10 border border-secondary/30 text-secondary font-bold rounded-2xl py-3.5 active:scale-[0.98] transition-transform"
          >
            <ShieldCheck size={16} /> فتح ملف ضمان لهذه الخدمة
          </button>
        )}

        {canCancel && (
          <button onClick={cancelOrder} disabled={busy} className="w-full flex items-center justify-center gap-2 text-rose-500 font-bold py-3">
            <XCircle size={16} /> إلغاء الطلب
          </button>
        )}
      </div>
    </div>
  )
}

function Card({ children }) {
  return <div className="bg-white border border-black/5 rounded-2xl p-4 shadow-sm">{children}</div>
}

function Centered({ children }) {
  return <div className="h-full flex items-center justify-center text-slate-500 text-sm" dir="rtl">{children}</div>
}