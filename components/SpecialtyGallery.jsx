import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { showcaseFor } from '../serviceShowcase'
import { SPECIALTIES } from '../constants'

// Inner specialty header: its own photos rotate, and it switches as soon as the
// customer picks a different service.
export default function SpecialtyGallery({ specialtyId }) {
  const s = showcaseFor(specialtyId)
  const [i, setI] = useState(0)
  const [failed, setFailed] = useState({})

  useEffect(() => { setI(0) }, [specialtyId])
  useEffect(() => {
    if (!s || s.images.length < 2) return
    const t = setTimeout(() => setI((x) => (x + 1) % s.images.length), 3800)
    return () => clearTimeout(t)
  }, [i, s])

  if (!s) return null
  const photo = s.images[i % s.images.length]
  const key = `${specialtyId}-${i}`
  const spec = SPECIALTIES.find((x) => x.id === specialtyId)

  return (
    <div className="relative overflow-hidden rounded-3xl h-44 md:h-56 shadow-md bg-gradient-to-br from-sky-500 to-blue-700 fade-up">
      {!failed[key] ? (
        <img key={key} src={photo.url} alt={s.title} onError={() => setFailed((f) => ({ ...f, [key]: true }))} className="banner-in absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-30">{s.icon}</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-blue-950/85 via-blue-900/30 to-transparent" />
      <div key={specialtyId} className="absolute bottom-0 inset-x-0 p-4 text-white">
        <div className="flex items-center gap-2 line-in">
          <span className="w-9 h-9 rounded-xl bg-white text-xl flex items-center justify-center shadow">{s.icon}</span>
          <div>
            <p className="font-display font-black text-lg leading-tight drop-shadow">{s.title}</p>
            {spec?.desc && <p className="text-[10px] text-white/75">{spec.desc}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
          {s.lines.map((l, k) => (
            <span key={l} className="line-in flex items-center gap-1 text-[11px] font-bold" style={{ animationDelay: `${100 + k * 90}ms` }}>
              <CheckCircle2 size={12} className="text-emerald-300" /> {l}
            </span>
          ))}
        </div>
      </div>
      {s.images.length > 1 && (
        <div className="absolute top-3 right-3 flex gap-1">
          {s.images.map((_, k) => (
            <button key={k} onClick={() => setI(k)} aria-label={`صورة ${k + 1}`} className={`h-1.5 rounded-full transition-all ${k === i % s.images.length ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
          ))}
        </div>
      )}
      {photo.by && !failed[key] && <p className="absolute top-2.5 left-3 text-[8px] text-white/70">Photo: {photo.by} / Unsplash</p>}
    </div>
  )
}
