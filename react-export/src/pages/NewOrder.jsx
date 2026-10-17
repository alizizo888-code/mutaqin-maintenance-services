import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, MapPin, Sparkles, Loader2, Zap, Tag } from 'lucide-react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { team } from '../lib/team'
import { aiRun } from '../aiAdapter'
import { push } from '../lib/push'
import { maps } from '../lib/maps'
import { useLiveShared } from '../lib/useLive'
import MapView from '../components/MapView'
import RegisterModal from '../components/RegisterModal'
import { useSession } from '../hooks/useSession'
import { SPECIALTIES } from '../constants'
import { isRegistered } from '../registration'
import SpecialtyGallery from '../components/SpecialtyGallery'
import FloatingContact from '../components/FloatingContact'
import ServiceTreePicker from '../components/ServiceTreePicker'
import PermissionHelp from '../components/PermissionHelp'
import { permissionState } from '../hooks/useLocator'
import { branchesFor, selectionSummary } from '../serviceTree'

const inputCls = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15'

export default function NewOrder() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const warrantyOf = params.get('warrantyOf')
  const offerKey = params.get('offer')
  const productKey = params.get('product')

  const { session, setSession } = useSession()
  const platformUser = auth.getCurrentUser()

  const registered = isRegistered(session, platformUser)
  // A returning guest who already gave name + mobile is not asked again
  const knownGuest = session?.type === 'guest' && session?.phone ? session : null
  const [specialtyId, setSpecialtyId] = useState(params.get('specialty') || '')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState(params.get('priority') === 'urgent' ? 'urgent' : 'normal')
  const [promoCode, setPromoCode] = useState(params.get('promo') || '')
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState(null)
  const [locating, setLocating] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [serviceSel, setServiceSel] = useState(null)
  const [locDenied, setLocDenied] = useState(false)
  useEffect(() => { setServiceSel(null) }, [specialtyId])

  const { data: offers } = useLiveShared('offers', { limit: 50 })
  const { data: products } = useLiveShared('products', { limit: 50 })

  // Prefill from an offer / product tap
  useEffect(() => {
    if (offerKey && offers) {
      const o = offers.find((x) => (x.key || x.id) === offerKey)
      if (o) {
        setSpecialtyId(o.specialtyId || specialtyId)
        setDescription(`${o.title} — ضمن العرض الحالي (${o.price} ر.س)`)
      }
    }
    if (productKey && products) {
      const p = products.find((x) => (x.key || x.id) === productKey)
      if (p) {
        setSpecialtyId(p.specialtyId || specialtyId)
        setDescription(`توريد وتركيب: ${p.name}${p.price ? ` (${p.price} ر.س)` : ''}`)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerKey, productKey, offers, products])

  async function useMyLocation() {
    setLocating(true)
    setError('')
    try {
      const { lat, lng } = await maps.getCurrentLocation()
      setCoords({ lat, lng })
      setLocDenied(false)
      try {
        const { address: addr } = await maps.reverseGeocode(lat, lng)
        if (addr) setAddress(addr)
      } catch {}
    } catch (e) {
      const st = await permissionState('geolocation')
      const denied = st === 'denied' || /denied|permission/i.test(String(e?.message || ''))
      setLocDenied(denied)
      setError(denied ? 'صلاحية الموقع مقفولة — اضغط «تفعيل الأذونات»، أو حدد الموقع بالضغط على الخريطة.' : 'تعذر تحديد موقعك الآن — تأكد من تشغيل الموقع أو حدده على الخريطة.')
    } finally {
      setLocating(false)
    }
  }

  async function suggestSpecialty() {
    if (!description.trim()) return
    setAiLoading(true)
    try {
      const list = SPECIALTIES.map((s) => `${s.id}: ${s.label}`).join('، ')
      const { json } = await aiRun(
        `صنّف طلب الصيانة التالي واختر أنسب تخصص من هذه القائمة فقط (أعد id فقط): ${list}.\nنص الطلب: "${description}"\nأعد JSON بالشكل: {"specialtyId": "..."}`,
        { json: true },
        { feature: 'classify_service' }
      )
      if (json?.specialtyId && SPECIALTIES.some((s) => s.id === json.specialtyId)) {
        setSpecialtyId(json.specialtyId)
      }
    } catch {}
    setAiLoading(false)
  }

  function validate() {
    if (!specialtyId) return 'الرجاء اختيار نوع الخدمة'
    if (branchesFor(specialtyId).length && !serviceSel?.branchId && !description.trim()) return 'اختر الخدمة المطلوبة (غسيل، صيانة، تركيب…) أو صف المشكلة'
    if (!coords) return 'الرجاء تحديد موقع الخدمة'
    return ''
  }

  function submit() {
    const err = validate()
    if (err) return setError(err)
    setError('')
    // Name + mobile are asked only now, at the final button: register or continue as guest
    if (registered) return createOrder(session)
    if (knownGuest) return createOrder(knownGuest)
    setShowRegister(true)
  }

  async function createOrder(sess) {
    setSubmitting(true)
    setError('')
    try {
      const gid = await team.groupId()
      const payload = {
        clientId: platformUser?.id || null,
        clientName: (sess?.name || '').trim(),
        clientPhone: (sess?.phone || '').trim(),
        clientType: sess?.type || 'guest',
        specialtyId,
        serviceBranch: serviceSel?.branchId || null,
        serviceChoices: serviceSel?.choices || null,
        serviceDetails: selectionSummary(specialtyId, serviceSel) || null,
        description: description.trim(),
        priority,
        promoCode: promoCode.trim() || null,
        offerKey: offerKey || null,
        productKey: productKey || null,
        address,
        lat: coords.lat,
        lng: coords.lng,
        status: 'new',
        statusHistory: [{ status: 'new', at: new Date().toISOString(), by: 'client' }],
        isWarranty: !!warrantyOf,
        warrantyOf: warrantyOf || null,
      }
      const order = await db.insertShared('orders', payload, undefined, {
        groupId: gid,
        visibleTo: 'creator-and-admin',
      })
      try {
        await push.sendToRole(gid, 'operations', {
          title: warrantyOf ? 'طلب ضمان جديد' : 'طلب صيانة جديد',
          body: `${SPECIALTIES.find((s) => s.id === specialtyId)?.label || ''} — ${sess?.name || ''}`,
          url: '#/staff/operations',
          sound: 'bell',
        })
      } catch {}
      navigate(`/order/${order.id}`, { replace: true })
    } catch {
      setError('تعذر إرسال الطلب، حاول مرة أخرى')
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto pb-48 md:pb-16" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#f5f7f5]/90 backdrop-blur border-b border-black/5 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-2xl mx-auto w-full px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white border border-black/5 shadow-sm flex items-center justify-center active:scale-[0.95] transition-transform">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
          <div>
            <h1 className="font-display text-lg font-black text-slate-900">{warrantyOf ? 'طلب ضمان' : 'طلب صيانة جديد'}</h1>
            <p className="text-[11px] text-slate-500">اختر الخدمة وحدد الموقع — ونتولى الباقي</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto w-full px-4 pt-5 flex flex-col gap-5">
        {specialtyId && <SpecialtyGallery specialtyId={specialtyId} />}

        <Field label="نوع الخدمة">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {SPECIALTIES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSpecialtyId(s.id)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border text-xs font-bold transition-colors ${
                  specialtyId === s.id
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-white border-slate-200 text-slate-600 shadow-sm hover:border-primary/40'
                }`}
              >
                <span className="text-base">{s.icon}</span> {s.label}
              </button>
            ))}
          </div>
        </Field>

        {specialtyId && <ServiceTreePicker specialtyId={specialtyId} value={serviceSel} onChange={setServiceSel} />}

        <Field label={serviceSel?.branchId ? 'تفاصيل إضافية (اختياري)' : 'صف المشكلة'}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="مثال: المكيف لا يبرد ويصدر صوتًا غريبًا"
            className={`${inputCls} resize-none`}
          />
          <button
            onClick={suggestSpecialty}
            disabled={aiLoading || !description.trim()}
            className="mt-2 flex items-center gap-1.5 text-xs font-bold text-primary disabled:text-slate-400"
          >
            {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            اقترح التخصص بالذكاء الاصطناعي
          </button>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="الأولوية">
            <div className="flex gap-2">
              <button
                onClick={() => setPriority('normal')}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold border ${priority === 'normal' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-500 shadow-sm'}`}
              >
                عادي
              </button>
              <button
                onClick={() => setPriority('urgent')}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold border flex items-center justify-center gap-1 ${priority === 'urgent' ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-slate-200 text-slate-500 shadow-sm'}`}
              >
                <Zap size={13} /> عاجل
              </button>
            </div>
          </Field>
          <Field label="كود الخصم">
            <div className="relative">
              <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="OXYGEN30" dir="ltr" className={`${inputCls} text-right pl-9`} />
              <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </Field>
        </div>

        <Field label="موقع الخدمة">
          <button
            onClick={useMyLocation}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2 bg-primary/10 border border-primary/30 text-primary font-bold rounded-xl py-3 mb-2 text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {locating ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
            تحديد موقعي الحالي
          </button>
          {locDenied && <div className="mb-2"><PermissionHelp kind="location" onRetry={useMyLocation} /></div>}
          <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            <MapView
              center={coords ? [coords.lat, coords.lng] : [24.7136, 46.6753]}
              zoom={coords ? 15 : 11}
              markers={coords ? [{ lat: coords.lat, lng: coords.lng, label: '📍' }] : []}
              onMapClick={async ({ lat, lng }) => {
                setCoords({ lat, lng })
                try {
                  const { address: addr } = await maps.reverseGeocode(lat, lng)
                  if (addr) setAddress(addr)
                } catch {}
              }}
              className="h-52"
            />
          </div>
          {address && <p className="text-xs text-slate-500 mt-2">{address}</p>}
        </Field>

        {error && <p className="text-rose-600 text-sm font-bold text-center">{error}</p>}

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-primary text-white font-display font-black rounded-2xl py-4 disabled:opacity-50 active:scale-[0.98] transition-transform shadow-lg shadow-primary/20 hover:bg-primary/90"
        >
          {submitting ? 'جارِ الإرسال…' : 'إتمام الطلب'}
        </button>
        <p className="text-[11px] text-slate-400 text-center -mt-2 pb-4">
          {registered || knownGuest ? `يُرسل الطلب باسم ${(session?.name || '').trim() || 'حسابك'}` : 'بعد الضغط نطلب اسمك ورقم جوالك فقط — سجّل بضغطة أو أكمل كزائر'}
        </p>
      </div>

      <RegisterModal
        open={showRegister}
        onClose={() => setShowRegister(false)}
        onDone={(s) => {
          setSession(s)
          setShowRegister(false)
          createOrder(s)
        }}
        initial={{ name: session?.name || platformUser?.displayName || '', phone: session?.phone || '' }}
      />
      <FloatingContact bottomClass="bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))]" />
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}