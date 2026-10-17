import { HashRouter, Routes, Route } from 'react-router-dom'
import ClientShell from './components/ClientShell'
import Home from './pages/client/Home'
import Services from './pages/client/Services'
import Offers from './pages/client/Offers'
import Store from './pages/client/Store'
import MyOrders from './pages/client/MyOrders'
import Account from './pages/client/Account'
import Calculator from './pages/client/Calculator'
import More from './pages/client/More'
import AiChat from './pages/client/AiChat'
import Notifications from './pages/Notifications'
import NotifySettings from './pages/NotifySettings'
import NewOrder from './pages/NewOrder'
import ClientOrderDetail from './pages/ClientOrderDetail'
import StaffGate from './pages/StaffGate'
import OrderDetailStaff from './pages/OrderDetailStaff'
import OperationsRoom from './pages/OperationsRoom'
import TechRadar from './pages/TechRadar'
import HandoffDetail from './pages/HandoffDetail'
import AiSettings from './pages/AiSettings'
import PricingRules from './pages/PricingRules'
import AiCommandCenter from './pages/AiCommandCenter'
import PaymentMethods from './pages/PaymentMethods'
import AiOwnerControl from './pages/AiOwnerControl'
import Privacy from './pages/Privacy'
import Contact from './pages/client/Contact'
import MyWarranties from './pages/client/MyWarranties'
import WhatsappCenter from './pages/WhatsappCenter'
import Warranties from './pages/Warranties'
import TechJoin from './pages/TechJoin'
import TechRequests from './pages/TechRequests'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* واجهة الزائر = واجهة العميل: يستقبل الزوار مباشرة على الرئيسية */}
        <Route path="/" element={<ClientShell />}>
          <Route index element={<Home />} />
          <Route path="services" element={<Services />} />
          <Route path="offers" element={<Offers />} />
          <Route path="store" element={<Store />} />
          <Route path="orders" element={<MyOrders />} />
          <Route path="account" element={<Account />} />
          <Route path="calculator" element={<Calculator />} />
          <Route path="more" element={<More />} />
        </Route>

        {/* تدفق الطلب وتفاصيله — شاشات مركّزة بدون شريط تبويب */}
        <Route path="/ai" element={<AiChat />} />
        <Route path="/new" element={<NewOrder />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/staff/notify-settings" element={<NotifySettings />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/warranty" element={<MyWarranties />} />
        <Route path="/order/:id" element={<ClientOrderDetail />} />
        <Route path="/join-tech" element={<TechJoin />} />

        {/* فريق العمل */}
        <Route path="/staff" element={<StaffGate />} />
        <Route path="/staff/order/:id" element={<OrderDetailStaff />} />
        <Route path="/staff/operations" element={<OperationsRoom />} />
        <Route path="/staff/radar" element={<TechRadar />} />
        <Route path="/staff/handoff/:id" element={<HandoffDetail />} />
        <Route path="/staff/ai-settings" element={<AiSettings />} />
        <Route path="/staff/pricing" element={<PricingRules />} />
        <Route path="/staff/ai-command" element={<AiCommandCenter />} />
        <Route path="/staff/payment-methods" element={<PaymentMethods />} />
        <Route path="/staff/ai-owner" element={<AiOwnerControl />} />
        <Route path="/staff/whatsapp" element={<WhatsappCenter />} />
        <Route path="/staff/warranties" element={<Warranties />} />
        <Route path="/staff/tech-requests" element={<TechRequests />} />
      </Routes>
    </HashRouter>
  )
}