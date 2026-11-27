import { useState } from 'react'
import { LockKeyhole, LogIn } from 'lucide-react'
import { phpAuth } from '../lib/phpApi'

export default function PhpStaffLogin({ onSignedIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const user = await phpAuth.login(username.trim(), password)
      if (!user || !['owner', 'operations', 'technician'].includes(user.role)) {
        await phpAuth.logout()
        throw new Error('هذا الحساب ليس ضمن فريق العمل المصرح له بالدخول.')
      }
      onSignedIn?.(user)
    } catch (e) { setError(e.message || 'تعذر تسجيل الدخول.') }
    finally { setBusy(false) }
  }
  return <div className="min-h-full flex items-center justify-center overflow-y-auto bg-[#f3f7f6] px-4 py-10" dir="rtl">
    <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><LockKeyhole size={26}/></div>
      <h1 className="text-center text-2xl font-black text-slate-900">دخول فريق مُتقِن</h1>
      <p className="mt-2 text-center text-sm text-slate-500">تسجيل دخول موحد وآمن مرتبط بحسابات النظام وقاعدة البيانات</p>
      <label className="mt-6 block text-sm font-bold text-slate-700">اسم المستخدم أو رقم الهاتف
        <input autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-600" />
      </label>
      <label className="mt-4 block text-sm font-bold text-slate-700">كلمة المرور
        <input autoComplete="current-password" required type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-600" />
      </label>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
      <button disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3.5 font-black text-white disabled:opacity-60">{busy?'جارِ التحقق…':<><LogIn size={17}/> تسجيل الدخول</>}</button>
      <p className="mt-4 text-center text-xs text-slate-400">تُدار الصلاحيات من حساب المستخدم المسجل في قاعدة بيانات مُتقِن.</p>
    </form>
  </div>
}
