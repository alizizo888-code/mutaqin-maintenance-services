import { useEffect, useState } from 'react'
import { CheckCircle2, ArrowLeft, Snowflake } from 'lucide-react'
import { SHOWCASE, BANNER_ORDER } from '../serviceShowcase'

// Home hero: the brand block stays fixed; the specialty photo, its icon and the
// service lines underneath rotate through every specialty.
export default function ServiceBanner({ onOpen }) {
  const slides = BANNER_ORDER.filter((id) => SHOWCASE[id])
  const [i, setI] = useState(0)
  const [failed, setFailed] = useState({})
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const t = setTimeout(() => setI((x) => (x + 1) % slides.length), 4500)
    return () => clearTimeout(t)
  }, [i, paused, slides.length])

  // Preload the next slide's photo so the switch is seamless
  useEffect(() => {
    const next = SHOWCASE[slides[(i + 1) % slides.length]]
    if (next?.images?.[0]) { const img = new Image(); img.src = next.images[0].url }
  }, [i, slides])

  const id = slides[i]
  const s = SHOWCASE[id]
  const photo = s.images[0]

  return (
    <div
      className="relative overflow-hidden rounded-3xl shadow-lg shadow-sky-200/60 fade-up h-60 md:h-72 bg-gradient-to-br from-sky-500 via-blue-600 to-blue-800"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      {!failed[id] ? (
        <img key={id} src={photo.url} alt={s.title} onError={() => setFailed((f) => ({ ...f, [id]: true }))} className="banner-in absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div key={id} className="banner-in absolute inset-0 flex items-center justify-center text-7xl opacity-30">{s.icon}</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-l from-blue-950/85 via-blue-900/50 to-blue-900/10" />

      <div className="relative h-full flex flex-col justify-between p-5 text-white">
        {/* Fixed brand */}
        <div>
          <span className="inline-block text-[10px] font-black tracking-wider bg-white/15 backdrop-blur border border-white/25 rounded-full px-2.5 py-0.5">مُتقن · MUTQAN</span>
          <div className="flex items-center gap-2 mt-1.5">
            <Snowflake size={24} className="text-sky-200" />
            <h1 className="font-display font-black text-3xl md:text-4xl tracking-wide drop-shadow">OXYGEN</h1>
          </div>
          <p className="font-display font-black text-sm md:text-base bg-blue-600/85 rounded-lg px-2 py-0.5 w-fit mt-1">الصيانة والمقاولات العامة</p>
        </div>

        {/* Rotating specialty */}
        <div key={id}>
          <div className="flex items-center gap-2 line-in">
            <span className="w-10 h-10 rounded-2xl bg-white text-2xl flex items-center justify-center shadow-lg">{s.icon}</span>
            <p className="font-display font-black text-xl md:text-2xl drop-shadow">{s.title}</p>
          </div>
          <div className="mt-2 flex flex-col gap-0.5">
            {s.lines.map((l, k) => (
              <p key={l} className="line-in flex items-center gap-1.5 text-[12px] md:text-sm font-bold drop-shadow" style={{ animationDelay: `${120 + k * 110}ms` }}>
                <CheckCircle2 size={13} className="text-emerald-300 shrink-0" /> {l}
              </p>
            ))}
          </div>
          <button onClick={() => onOpen(id)} className="line-in mt-2.5 flex items-center gap-1.5 bg-white text-blue-700 font-display font-black rounded-full px-4 py-1.5 text-xs shadow active:scale-95 transition-transform hover:bg-sky-50" style={{ animationDelay: '450ms' }}>
            اطلب الخدمة <ArrowLeft size={13} />
          </button>
        </div>
      </div>

      <div className="absolute bottom-2.5 left-3 flex gap-1 max-w-[45%] flex-wrap justify-end" dir="ltr">
        {slides.map((sid, k) => (
          <button key={sid} onClick={() => setI(k)} aria-label={SHOWCASE[sid].title} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-4 bg-white' : 'w-1.5 bg-white/45'}`} />
        ))}
      </div>
      {photo.by && !failed[id] && <p className="absolute top-2 left-3 text-[8px] text-white/60">Photo: {photo.by} / Unsplash</p>}
    </div>
  )
}
