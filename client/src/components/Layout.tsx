import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { UserRole } from '../types'
import { 
  LayoutDashboard, 
  Anchor, 
  Ship, 
  Calendar, 
  DollarSign, 
  CreditCard,
  Users,
  LogOut,
  Menu,
  X
} from 'lucide-react'
import { useState, useMemo } from 'react'

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Определяем доступные пункты меню в зависимости от роли
  const navigation = useMemo(() => {
    const allItems = [
      { name: 'Дашборд', href: '/dashboard', icon: LayoutDashboard, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLUB_OWNER, UserRole.VESSEL_OWNER] },
      { name: 'Пользователи', href: '/users', icon: Users, roles: [UserRole.SUPER_ADMIN] },
      { name: 'Яхт-клубы', href: '/clubs', icon: Anchor, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLUB_OWNER] },
      { name: 'Судна', href: '/vessels', icon: Ship, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VESSEL_OWNER] },
      { name: 'Бронирования', href: '/bookings', icon: Calendar, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLUB_OWNER, UserRole.VESSEL_OWNER] },
      { name: 'Финансы', href: '/finances', icon: DollarSign, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLUB_OWNER] },
      { name: 'Платежи', href: '/payments', icon: CreditCard, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLUB_OWNER, UserRole.VESSEL_OWNER] },
    ]

    if (!user) return []
    
    return allItems.filter(item => item.roles.includes(user.role))
  }, [user])

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4 border-b">
            <h1 className="text-xl font-bold text-primary-600">Marina CRM</h1>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-500">
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                    isActive(item.href)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex items-center h-16 px-4 border-b">
            <h1 className="text-xl font-bold text-primary-600">Marina CRM</h1>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                    isActive(item.href)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
          <div className="p-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
                <p className="text-xs text-primary-600 font-medium mt-1">
                  {user?.role === UserRole.CLUB_OWNER && 'Владелец клуба'}
                  {user?.role === UserRole.VESSEL_OWNER && 'Судовладелец'}
                  {user?.role === UserRole.ADMIN && 'Администратор'}
                  {user?.role === UserRole.SUPER_ADMIN && 'Супер-администратор'}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Выйти
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex h-16 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="px-4 text-gray-500 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex flex-1 items-center justify-between px-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {navigation.find((item) => isActive(item.href))?.name || 'Marina CRM'}
            </h2>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user?.firstName} {user?.lastName}
              </span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

