import {
  Activity, BarChart3, Bell, CalendarClock, CalendarPlus, ClipboardList, IndianRupee, LayoutDashboard, LogOut,
  Menu, Plus, ShieldCheck, Stethoscope, UserPlus, Users, UsersRound, AlertTriangle, Info,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import type { Notification, Role } from '../types'
import { useFetch } from '../utils'
import { Avatar } from './ui'

type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean } | { section: string }

const NAV: Record<Role, NavItem[]> = {
  owner: [
    { to: '/owner', label: 'Command Center', icon: <LayoutDashboard />, end: true },
    { to: '/appointments', label: 'Appointments', icon: <CalendarClock /> },
    { to: '/patients', label: 'Patients', icon: <UsersRound /> },
    { section: 'Team' },
    { to: '/doctors', label: 'Doctors', icon: <Stethoscope /> },
    { to: '/staff', label: 'Staff', icon: <Users /> },
    { to: '/users', label: 'User & Access', icon: <ShieldCheck /> },
    { section: 'Insights' },
    { to: '/analytics', label: 'Analytics', icon: <BarChart3 /> },
    { to: '/activity', label: 'Activity Log', icon: <Activity /> },
    { to: '/payments', label: 'Collections', icon: <IndianRupee /> },
  ],
  doctor: [
    { to: '/doctor', label: 'My Dashboard', icon: <LayoutDashboard />, end: true },
    { to: '/appointments', label: 'Appointments', icon: <CalendarClock /> },
    { to: '/patients', label: 'My Patients', icon: <UsersRound /> },
  ],
  front_desk: [
    { to: '/desk', label: 'Dashboard', icon: <LayoutDashboard />, end: true },
    { to: '/register', label: 'Register Patient', icon: <UserPlus /> },
    { to: '/appointments/new', label: 'New Appointment', icon: <CalendarPlus /> },
    { to: '/appointments', label: "Today's Queue", icon: <ClipboardList />, end: true },
    { to: '/patients', label: 'Patients', icon: <UsersRound /> },
    { to: '/payments', label: 'Payments', icon: <IndianRupee /> },
  ],
}

const ROLE_LABEL: Record<Role, string> = { owner: 'Owner / Admin', doctor: 'Doctor', front_desk: 'Front Desk' }

export default function Layout() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setMenuOpen(false), [location.pathname])
  if (!user) return null

  return (
    <div className="shell">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Plus size={20} strokeWidth={3} />
          </div>
          <div>
            <div className="brand-name">Sowaka Care</div>
            <div className="brand-sub">Hospital CRM</div>
          </div>
        </div>
        <nav className="nav">
          {NAV[user.role].map((item, i) =>
            'section' in item ? (
              <div key={i} className="nav-section">{item.section}</div>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {item.icon}
                {item.label}
              </NavLink>
            ),
          )}
        </nav>
        <div className="sidebar-foot">
          <Avatar name={user.name} doc={user.role === 'doctor'} />
          <div className="who">
            <div>{user.name}</div>
            <div>{user.designation || ROLE_LABEL[user.role]}</div>
          </div>
          <button className="btn ghost icon" onClick={logout} title="Log out" aria-label="Log out">
            <LogOut />
          </button>
        </div>
      </aside>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="btn ghost icon menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu />
          </button>
          <span className="badge plain b-brand">{ROLE_LABEL[user.role]}</span>
          <div className="spacer" />
          <span className="small muted" style={{ whiteSpace: 'nowrap' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <Notifications />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Notifications() {
  const { data } = useFetch<Notification[]>('/api/notifications', 60000)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const items = data ?? []
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="btn ghost icon" onClick={() => setOpen((o) => !o)} aria-label="Notifications" style={{ position: 'relative' }}>
        <Bell />
        {items.length > 0 && <span className="bell-count">{items.length}</span>}
      </button>
      {open && (
        <div className="pop">
          <div className="card-head">
            <h3>Notifications</h3>
          </div>
          {items.length === 0 && <div className="empty">You're all caught up</div>}
          {items.map((n, i) => (
            <div key={i} className="pop-item" onClick={() => { setOpen(false); navigate(n.link) }}>
              {n.level === 'warning'
                ? <AlertTriangle size={16} color="var(--amber)" style={{ flexShrink: 0, marginTop: 2 }} />
                : <Info size={16} color="var(--blue)" style={{ flexShrink: 0, marginTop: 2 }} />}
              <span>{n.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
