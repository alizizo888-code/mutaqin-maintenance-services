import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useTeamRole } from '../hooks/useTeamRole'
import PhpStaffLogin from '../components/PhpStaffLogin'
import { TEAM_ROLES } from '../constants'
import StaffDashboard from './StaffDashboard'
import OperationsRoom from './OperationsRoom'
import TechRadar from './TechRadar'

export default function StaffGate() {
  const navigate = useNavigate()
  const { loading, signedIn, role, refresh } = useTeamRole()
  if (loading) return <div className="h-full flex items-center justify-center bg-[#f3f7f6] text-slate-500 text-sm" dir="rtl">جارِ التحقق من جلسة مُتقِن…</div>
  if (!signedIn) return <div className="h-full relative" dir="rtl">
    <button onClick={() => navigate('/')} aria-label="العودة للرئيسية" className="absolute top-4 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow"><ChevronRight size={18}/></button>
    <PhpStaffLogin onSignedIn={() => refresh()} />
  </div>
  if (role === 'operations') return <OperationsRoom />
  if (role === 'technician') return <TechRadar />
  return <StaffDashboard roles={TEAM_ROLES} />
}
