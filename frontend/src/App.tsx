import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { HOME_BY_ROLE, useAuth } from './auth'
import Layout from './components/Layout'
import { Loading } from './components/ui'
import type { Role } from './types'
import Activity from './pages/Activity'
import Analytics from './pages/Analytics'
import Appointments from './pages/Appointments'
import ChangePassword from './pages/ChangePassword'
import Consultation from './pages/Consultation'
import DoctorDashboard from './pages/DoctorDashboard'
import DoctorDetail from './pages/DoctorDetail'
import Doctors from './pages/Doctors'
import FrontDeskDashboard from './pages/FrontDeskDashboard'
import Login from './pages/Login'
import NewAppointment from './pages/NewAppointment'
import OwnerDashboard from './pages/OwnerDashboard'
import PatientProfile from './pages/PatientProfile'
import Patients from './pages/Patients'
import Payments from './pages/Payments'
import RegisterPatient from './pages/RegisterPatient'
import Staff from './pages/Staff'
import Users from './pages/Users'

function Guard({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.must_change_password && location.pathname !== '/change-password') return <Navigate to="/change-password" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role]} replace />
  return <>{children}</>
}

function Home() {
  const { user } = useAuth()
  return <Navigate to={user ? HOME_BY_ROLE[user.role] : '/login'} replace />
}

export default function App() {
  const { loading } = useAuth()
  if (loading) return <Loading />
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<Guard><ChangePassword /></Guard>} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route index element={<Home />} />
        {/* Owner */}
        <Route path="/owner" element={<Guard roles={['owner']}><OwnerDashboard /></Guard>} />
        <Route path="/doctors" element={<Guard roles={['owner']}><Doctors /></Guard>} />
        <Route path="/doctors/:id" element={<Guard roles={['owner']}><DoctorDetail /></Guard>} />
        <Route path="/staff" element={<Guard roles={['owner']}><Staff /></Guard>} />
        <Route path="/users" element={<Guard roles={['owner']}><Users /></Guard>} />
        <Route path="/analytics" element={<Guard roles={['owner']}><Analytics /></Guard>} />
        <Route path="/activity" element={<Guard roles={['owner']}><Activity /></Guard>} />
        {/* Doctor */}
        <Route path="/doctor" element={<Guard roles={['doctor']}><DoctorDashboard /></Guard>} />
        <Route path="/consult/:id" element={<Guard roles={['doctor', 'owner']}><Consultation /></Guard>} />
        {/* Front desk */}
        <Route path="/desk" element={<Guard roles={['front_desk']}><FrontDeskDashboard /></Guard>} />
        <Route path="/register" element={<Guard roles={['front_desk', 'owner']}><RegisterPatient /></Guard>} />
        <Route path="/appointments/new" element={<Guard roles={['front_desk', 'owner']}><NewAppointment /></Guard>} />
        <Route path="/payments" element={<Guard roles={['front_desk', 'owner']}><Payments /></Guard>} />
        {/* Shared (role-aware) */}
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/:id" element={<PatientProfile />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
