import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Bell, MapPin, Search, SlidersHorizontal, ChevronRight, ChevronLeft, ShieldCheck, Phone, Headphones, MessageCircle, Loader2, ArrowLeft, Snowflake, Menu, User, CheckCircle2, Sparkles } from 'lucide-react'
import { useLiveShared } from '../../lib/useLive'
import { maps } from '../../lib/maps'
import { share } from '../../lib/share'
import { PROMO_CODE, ACTIVE_STATUSES, STATUS_META, specialtyLabel, BUSINESS_PHONE, BUSINESS_WHATSAPP } from '../../constants'
import ServiceBanner from '../../components/ServiceBanner'
import AiLogo from '../../components/AiLogo'
import PermissionHelp from '../../components/PermissionHelp'
import { permissionState } from '../../hooks/useLocator'
import { auth } from '../../lib/auth'

const TILES = [
  { id: 'ac', label: 'صيانة وتكييف', icon: '❄️', grad: 'from-sky-200 to-blue-400' },
  { id: 'plumbing', label: 'سباكة', icon: '🚿', grad: 'from-cyan-200 to-sky-400' },
  { id: 'electric', label: 'كهرباء', icon: '⚡', grad: 'from-amber-200 to-yellow-400' },
  { id: 'cleaning', label: 'نظافة وديكور', icon: '🛋️', grad: 'from-rose-200 to-pink-400' },
  { id: 'appliances', label: 'أجهزة منزلية', icon: '🧺', grad: 'from-violet-200 to-purple-400' },
  { id: 'paint', label: 'دهانات وديكور', icon: '🖌️', grad: 'from-orange-200 to-amber-400' },
  { id: 'fridge', label: 'غرف التبريد والتجميد', icon: '🧊', grad: 'from-sky-200 to-cyan-400' },
  { id: 'tanks', label: 'خزانات مياه', icon: '🚰', grad: 'from-emerald-200 to-teal-400' },
]

const AI_CHIPS = ['كم سعر غسل 3 مكيفات؟', 'أريد فني سباكة', 'عندي مشكلة في التبريد']

export default function Home() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState({ label: 'حدد موقعك', loading: false })
  const [locDenied, setLocDenied] = useState(false)
  const { data: myNotifs } = useLiveShared('notifications', { order: '-at', limit: 50 })
  const me = auth.getCurrentUser()?.id
  const unreadCount = (myNotifs || []).filter((n) => n.audience !== 'ops' && n.userId === me && !n.read).length
  const [slide, setSlide] = useState(0)
  const [guaranteeOpen, setGuaranteeOpen] = useState(false)
  const [toast, setToast] = useState('')

  const { data: orders } = useLiveShared('orders', { order: '-createdAt', limit: 50 })
  const { data: offers } = useLiveShared('offers', { limit: 6 })

  const activeOrders = useMemo(() => (orders || []).filter((o) => ACTIVE_STATUSES.includes(o.status)), [orders])
  const activeOrder = activeOrders[0] || null

  // Location is requested only when the customer taps the location pill — never on open.
  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % 3), 5500)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function locate() {
    setLoc((l) => ({ ...l, loading: true }))
    try {
      const { lat, lng } = await maps.getCurrentLocation()
      const { address } = await maps.reverseGeocode(lat, lng)
      setLocDenied(false)
      if (address) setLoc({ label: address.split('،').slice(0, 2).join('، '), loading: false })
      else setLoc({ label: 'موقعي الحالي', loading: false })
    } catch (e) {
      const st = await permissionState('geolocation')
      const denied = st === 'denied' || /denied|permission/i.test(String(e?.message || ''))
      setLocDenied(denied)
      setLoc({ label: denied ? 'الموقع مقفول' : 'تعذر التحديد — اضغط للمحاولة', loading: false })
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  function callDirect() {
    if (BUSINESS_PHONE) window.location.href = `tel:${BUSINESS_PHONE}`
    else showToast('رقم الاتصال المباشر لم يُفعّل بعد — اطلب فنيك الآن وسيصلك')
  }

  function contactWhatsapp() {
    // All WhatsApp numbers are managed from the WhatsApp center — route to the public contact page
    if (BUSINESS_WHATSAPP) share.whatsapp(BUSINESS_WHATSAPP, 'السلام عليكم، أرغب بخدمة صيانة من OXYGEN.')
    else navigate('/contact')
  }

  const query = q.trim()
  const tiles = useMemo(() => {
    if (!query) return TILES
    return TILES.filter((t) => t.label.includes(query))
  }, [query])

  const previewOffers = useMemo(() => {
    const list = offers || []
    if (!query) return list.slice(0, 4)
    return list.filter((o) => (o.title || '').includes(query) || (o.sub || '').includes(query))
  }, [offers, query])

  const SLIDES = [
    {
      badge: 'خصم يصل',
      title: '30%',
      sub: 'على جميع خدمات التكييف — غسيل، صيانة، تركيب',
      cta: 'احجز الآن',
      go: () => navigate(`/new?promo=${PROMO_CODE}`),
    },
    {
      badge: 'ضمان',
      title: 'ضمان معتمد',
      sub: 'ضمان الفنيين الذهبي 30 يومًا على كل خدمة',
      cta: 'تفاصيل الضمان',
      go: () => setGuaranteeOpen(true),
    },
    {
      badge: 'طوارئ',
      title: 'طوارئ 24 ساعة',
      sub: 'استجابة عاجلة للأعطال الحرجة في أي وقت',
      cta: 'طلب طارئ',
      go: () => navigate('/new?priority=urgent'),
    },
  ]

  return (
    <div className="h-full overflow-y-auto pb-32 md:pb-10 relative" dir="rtl">
      {/* decorative snow */}
      <span className="snowflake pointer-events-none fixed top-24 right-8 text-sky-300/50 text-sm z-0 select-none">❄</span>
      <span className="snowflake pointer-events-none fixed top-16 left-12 text-sky-300/40 text-xs z-0 select-none" style={{ animationDelay: '1.6s' }}>❄</span>
      <span className="snowflake pointer-events-none fixed top-40 left-1/3 text-sky-300/30 text-[10px] z-0 select-none" style={{ animationDelay: '3.2s' }}>❄</span>

      <header className="sticky top-0 z-20 bg-[#eaf3fc]/85 backdrop-blur-xl pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-3xl mx-auto w-full px-4 py-2.5 flex items-center gap-2">
          <button onClick={() => navigate('/account')} className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-300/50 active:scale-95 transition-transform shrink-0">
            <User size={18} />
          </button>
          <button onClick={locate} className="flex-1 min-w-0 flex items-center justify-center gap-1.5 bg-white/90 border border-sky-100 rounded-full px-3 py-2.5 text-[11px] font-bold text-slate-700 shadow-sm active:scale-[0.98] transition-transform">
            {loc.loading ? <Loader2 size={13} className="animate-spin text-primary" /> : <MapPin size={13} className="text-primary" />}
            <span className="truncate">{loc.label}</span>
          </button>
          <button onClick={() => navigate('/notifications')} aria-label="الإشعارات" className="relative w-10 h-10 rounded-full bg-white/90 border border-sky-100 shadow-sm flex items-center justify-center active:scale-95 transition-transform shrink-0">
            <Bell size={17} className="text-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -left-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button onClick={() => navigate('/more')} className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-300/50 active:scale-95 transition-transform shrink-0">
            <Menu size={18} />
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full px-4 pt-3 flex flex-col gap-4 relative z-10">
        {locDenied && <PermissionHelp kind="location" onRetry={locate} />}

        {/* Hero — fixed brand, rotating specialty photo + services */}
        <ServiceBanner onOpen={(id) => navigate(`/new?specialty=${id}`)} />

        {/* Search */}
        <div className="relative fade-up" style={{ animationDelay: '60ms' }}>
          <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن: صيانة، مكيف، سباكة، كهربائي، قفل ذكي…"
            className="w-full bg-white border border-sky-100 shadow-sm rounded-full pr-10 pl-12 py-3 text-sm text-slate-800 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          <button onClick={() => navigate('/services')} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center active:scale-95 transition-transform">
            <SlidersHorizontal size={15} className="text-primary" />
          </button>
        </div>

        {/* Promo carousel */}
        <div className="relative overflow-hidden rounded-3xl shadow-md fade-up" style={{ animationDelay: '120ms' }}>
          <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${slide * 100}%)` }} dir="ltr">
            {SLIDES.map((s, i) => (
              <div key={i} dir="rtl" className="w-full shrink-0 relative bg-gradient-to-l from-blue-700 via-sky-600 to-sky-500 p-5 text-white min-h-[150px]">
                <span className="pointer-events-none absolute -top-6 -left-6 w-28 h-28 rounded-full bg-white/10" />
                <span className="pointer-events-none absolute top-3 left-4 text-2xl opacity-30">❄</span>
                <span className="inline-block text-[10px] font-bold bg-amber-400 text-amber-950 rounded-full px-2 py-0.5 mb-2">{s.badge}</span>
                <h2 className="font-display font-black text-2xl md:text-3xl leading-tight drop-shadow">{s.title}</h2>
                <p className="text-[11px] text-white/85 mt-1 leading-relaxed">{s.sub}</p>
                <button onClick={s.go} className="mt-3 flex items-center gap-1.5 bg-white text-blue-700 font-display font-black rounded-full px-4 py-2 text-xs shadow active:scale-95 transition-transform hover:bg-sky-50">
                  {s.cta}
                  <ArrowLeft size={14} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setSlide((s) => (s + 2) % 3)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/25 backdrop-blur flex items-center justify-center active:scale-90 transition-transform">
            <ChevronRight size={16} className="text-white" />
          </button>
          <button onClick={() => setSlide((s) => (s + 1) % 3)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/25 backdrop-blur flex items-center justify-center active:scale-90 transition-transform">
            <ChevronLeft size={16} className="text-white" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => setSlide(i)} className={`h-1.5 rounded-full transition-all ${slide === i ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />
            ))}
          </div>
        </div>

        {/* Services grid */}
        <section className="fade-up" style={{ animationDelay: '180ms' }}>
          <div className="grid grid-cols-4 gap-2.5">
            {tiles.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/new?specialty=${t.id}`)}
                className="flex flex-col items-center gap-1.5 bg-white rounded-2xl p-2 shadow-sm border border-sky-50 active:scale-95 transition-transform hover:shadow-md"
              >
                <span className={`w-full h-14 rounded-xl bg-gradient-to-br ${t.grad} flex items-center justify-center text-2xl shadow-inner`}>{t.icon}</span>
                <span className="text-[10px] font-bold text-slate-700 text-center leading-tight">{t.label}</span>
              </button>
            ))}
          </div>
          {!query && (
            <Link to="/services" className="flex items-center justify-center gap-1 text-[11px] font-bold text-primary mt-2">
              عرض كل الخدمات
              <ChevronLeft size={13} />
            </Link>
          )}
          {query && tiles.length === 0 && <p className="text-xs text-slate-400 text-center py-3">لا توجد خدمات مطابقة لبحثك</p>}
        </section>

        {/* Contact action cards */}
        <section className="grid grid-cols-3 gap-2.5 fade-up" style={{ animationDelay: '240ms' }}>
          <button onClick={callDirect} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white p-3 flex flex-col items-center gap-2 shadow-md shadow-rose-200 active:scale-95 transition-transform">
            <span className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
              <Phone size={20} />
            </span>
            <span className="font-display font-black text-xs">اتصال مباشر</span>
            <span className="text-[9px] text-white/80 -mt-1">تحدث مع خدمة العملاء</span>
          </button>
          <button onClick={() => navigate('/new')} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white p-3 flex flex-col items-center gap-2 shadow-md shadow-sky-200 active:scale-95 transition-transform">
            <span className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
              <Headphones size={20} />
            </span>
            <span className="font-display font-black text-xs">اطلب فني الآن</span>
            <span className="text-[9px] text-white/80 -mt-1">خدمة سريعة 24 ساعة</span>
          </button>
          <button onClick={contactWhatsapp} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white p-3 flex flex-col items-center gap-2 shadow-md shadow-emerald-200 active:scale-95 transition-transform">
            <span className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
              <MessageCircle size={20} />
            </span>
            <span className="font-display font-black text-xs">تواصل واتساب</span>
            <span className="text-[9px] text-white/80 -mt-1">رد سريع وفوري</span>
          </button>
        </section>

        {/* Live order tracking */}
        {activeOrder && (
          <button onClick={() => navigate(`/order/${activeOrder.id}`)} className="w-full text-right bg-white/90 backdrop-blur border border-sky-100 rounded-2xl p-3.5 shadow-sm active:scale-[0.99] transition-transform fade-up">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
              <p className="text-[11px] font-bold text-primary">طلب صيانة حالي في الطريق</p>
              <span className="mr-auto text-[10px] text-slate-400 font-bold">#{String(activeOrder.id).slice(-4)}</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-base">
                {activeOrder.specialtyIcon || '🔧'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900 truncate">الفني: {activeOrder.technicianName || 'جارِ الإسناد'}</p>
                <p className="text-[11px] text-slate-500 truncate">{specialtyLabel(activeOrder.specialtyId)} • {(STATUS_META[activeOrder.status] || {}).label}</p>
              </div>
              <ChevronLeft size={16} className="text-slate-300" />
            </div>
          </button>
        )}

        {/* Offers strip */}
        <section className="fade-up" style={{ animationDelay: '300ms' }}>
          <div className="flex items-end justify-between mb-2.5">
            <h2 className="font-display font-black text-slate-900 text-lg">عروض الموسم الشتوي والبرودة 🔥</h2>
            <Link to="/offers" className="flex items-center gap-0.5 text-[11px] font-bold text-primary shrink-0">
              عرض الكل
              <ChevronLeft size={13} />
            </Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 snap-x">
            {(previewOffers || []).map((o) => (
              <OfferMini key={o.id} offer={o} onOrder={() => navigate(`/new?offer=${o.key || o.id}`)} />
            ))}
            {previewOffers.length === 0 && (
              <div className="w-full bg-white/80 border border-sky-100 rounded-2xl p-4 text-center text-xs text-slate-400">لا توجد عروض حاليًا — ترقبنا</div>
            )}
          </div>
        </section>

        {/* AI assistant */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-100 via-blue-50 to-white border border-sky-100 p-4 fade-up" style={{ animationDelay: '360ms' }}>
          <span className="pointer-events-none absolute top-2 left-6 text-sky-300/50 text-lg select-none">❄</span>
          <div className="flex items-center gap-3">
            <AiLogo size={72} className="float-soft drop-shadow-md" />
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-2xl rounded-tr-sm border border-sky-100 shadow-sm p-3">
                <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
                  مرحباً 👋 <span className="font-display font-black text-primary">MUTQAN AI</span>
                  <br />
                  مساعدك الذكي للصيانة — اسألني عن الأسعار، الخدمات، أو اطلب فني الآن.
                </p>
              </div>
              <button onClick={() => navigate('/ai')} className="mt-2 w-full flex items-center justify-center gap-1.5 bg-gradient-to-l from-sky-500 to-blue-600 text-white font-display font-black rounded-full py-2.5 text-xs shadow-md shadow-sky-200 active:scale-95 transition-transform">
                <Sparkles size={14} />
                تحدث الآن مع المساعد
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5">
            {AI_CHIPS.map((c) => (
              <button key={c} onClick={() => navigate(`/ai?q=${encodeURIComponent(c)}`)} className="shrink-0 bg-white/90 border border-sky-100 rounded-full px-3 py-1.5 text-[10px] font-bold text-sky-700 active:scale-95 transition-transform">
                {c}
              </button>
            ))}
          </div>
        </section>

        <p className="text-center text-[10px] text-slate-400 pb-2">OXYGEN — الصيانة والمقاولات العامة • راحة بيتك مسؤوليتنا</p>
      </div>

      {/* Guarantee sheet */}
      {guaranteeOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={() => setGuaranteeOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} className="text-amber-700" />
              </div>
              <div>
                <p className="font-display font-black text-slate-900">ضمان الفنيين الذهبي</p>
                <p className="text-[11px] text-slate-500">30 يومًا على كل خدمة</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed bg-amber-50 border border-amber-100 rounded-2xl p-3">
              إذا تكرّر نفس العطل خلال 30 يومًا من إغلاق الطلب: إعادة زيارة مجانية، أو استرداد كامل المبلغ في حال عدم الرضا. يُفتح مسار الضمان مباشرة من صفحة الطلب المكتمل.
            </p>
            <button onClick={() => setGuaranteeOpen(false)} className="w-full mt-4 bg-primary text-white font-display font-black rounded-2xl py-3 text-sm active:scale-[0.98] transition-transform">
              تمام
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-32 md:bottom-10 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 text-white text-xs font-bold rounded-full px-4 py-2 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function OfferMini({ offer, onOrder }) {
  const [imgState, setImgState] = useState('loading')
  return (
    <div className="w-60 shrink-0 snap-start bg-white rounded-2xl border border-sky-50 shadow-sm p-2.5 flex gap-2.5">
      <div className="flex-1 min-w-0 flex flex-col">
        <span className="w-fit text-[9px] font-bold text-white bg-rose-500 rounded-full px-2 py-0.5 mb-1">{offer.badge || offer.tag || 'عرض'}</span>
        <h3 className="font-display font-black text-slate-900 text-[12px] leading-snug line-clamp-1">{offer.title}</h3>
        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{offer.sub}</p>
        <div className="mt-auto flex items-center justify-between gap-1 pt-1.5">
          <div className="flex items-baseline gap-1">
            <span className="font-display font-black text-primary text-base">{offer.price}</span>
            {offer.oldPrice && <span className="text-[10px] text-slate-400 line-through">{offer.oldPrice}</span>}
          </div>
          <button onClick={onOrder} className="bg-primary text-white text-[10px] font-bold rounded-full px-3 py-1.5 active:scale-95 transition-transform">
            اطلب الآن
          </button>
        </div>
      </div>
      <div className="w-20 h-20 rounded-xl overflow-hidden relative bg-sky-50 shrink-0">
        {imgState !== 'error' && (
          <img src={offer.image} alt={offer.title} onLoad={() => setImgState('ok')} onError={() => setImgState('error')} className={`w-full h-full object-cover transition-opacity ${imgState === 'ok' ? 'opacity-100' : 'opacity-0'}`} />
        )}
        {imgState === 'loading' && <div className="absolute inset-0 animate-pulse bg-sky-100" />}
        {imgState === 'error' && <div className="absolute inset-0 bg-gradient-to-br from-sky-200 to-blue-300 flex items-center justify-center text-xl">❄</div>}
      </div>
    </div>
  )
}