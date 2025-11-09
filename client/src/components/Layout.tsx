import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { UserRole } from '../types'
import { usersService, clubsService } from '../services/api'
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
  X,
  UserPlus,
  UserCheck,
  ShieldCheck,
  Receipt,
  FileText
} from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [newGuestsCount, setNewGuestsCount] = useState(0)
  const [pendingValidationCount, setPendingValidationCount] = useState(0)

  // Определяем доступные пункты меню в зависимости от роли
  const navigation = useMemo(() => {
    const allItems = [
      { name: 'Дашборд', href: '/dashboard', icon: LayoutDashboard, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLUB_OWNER, UserRole.VESSEL_OWNER, UserRole.PENDING_VALIDATION] },
      { name: 'Пользователи', href: '/users', icon: Users, roles: [UserRole.SUPER_ADMIN] },
      { name: 'Новые гости', href: '/new-guests', icon: UserCheck, roles: [UserRole.SUPER_ADMIN] },
      { name: 'Валидация', href: '/validation', icon: ShieldCheck, roles: [UserRole.SUPER_ADMIN] },
      { name: 'Яхт-клубы', href: '/clubs', icon: Anchor, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLUB_OWNER, UserRole.VESSEL_OWNER, UserRole.GUEST, UserRole.PENDING_VALIDATION] },
      { name: 'Судна', href: '/vessels', icon: Ship, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VESSEL_OWNER] },
      { name: 'Бронирования', href: '/bookings', icon: Calendar, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLUB_OWNER, UserRole.VESSEL_OWNER] },
      { name: 'Тарифы', href: '/tariffs', icon: Receipt, roles: [UserRole.CLUB_OWNER] },
      { name: 'Правила бронирования', href: '/booking-rules', icon: FileText, roles: [UserRole.CLUB_OWNER] },
      { name: 'Финансы', href: '/finances', icon: DollarSign, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLUB_OWNER] },
      { name: 'Платежи', href: '/payments', icon: CreditCard, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLUB_OWNER, UserRole.VESSEL_OWNER] },
      // Пункты регистрации для гостей
      { name: 'Зарегистрироваться как Владелец клуба', href: '/register?role=club_owner', icon: UserPlus, roles: [UserRole.GUEST] },
      { name: 'Зарегистрироваться как Судовладелец', href: '/register?role=vessel_owner', icon: UserPlus, roles: [UserRole.GUEST] },
    ]

    if (!user || !user.role) {
      console.log('No user or role:', { user, role: user?.role })
      return []
    }
    
    // Фильтруем пункты меню по роли пользователя
    const userRole = user.role as UserRole
    
    // Отладочная информация
    console.log('=== Menu Debug ===')
    console.log('User:', user)
    console.log('User role:', userRole, 'Type:', typeof userRole)
    console.log('CLUB_OWNER enum:', UserRole.CLUB_OWNER, 'Type:', typeof UserRole.CLUB_OWNER)
    console.log('Roles match:', userRole === UserRole.CLUB_OWNER, 'String match:', String(userRole) === String(UserRole.CLUB_OWNER))
    
    const filteredItems = allItems.filter(item => {
      // Проверяем, что роль пользователя есть в списке разрешенных ролей для этого пункта меню
      const hasAccess = item.roles.some(role => {
        // Сравниваем как enum, так и строковые значения
        return role === userRole || String(role) === String(userRole)
      })
      if (userRole === UserRole.CLUB_OWNER || String(userRole) === 'club_owner') {
        console.log(`Item "${item.name}": roles=${JSON.stringify(item.roles)}, hasAccess=${hasAccess}`)
      }
      return hasAccess
    })
    
    console.log('Filtered items count:', filteredItems.length, 'Items:', filteredItems.map(i => i.name))
    console.log('=== End Debug ===')
    
    return filteredItems
  }, [user])

  const isActive = (path: string) => location.pathname === path

  // Загружаем счетчик новых гостей для суперадминистратора
  useEffect(() => {
    const loadNewGuestsCount = async () => {
      if (user?.role === UserRole.SUPER_ADMIN) {
        try {
          // Получаем timestamp последнего просмотра из localStorage
          const lastViewed = localStorage.getItem('guests_last_viewed')
          const afterDate = lastViewed ? new Date(lastViewed).toISOString() : null

          if (afterDate) {
            const response = await usersService.getGuests({ 
              countOnly: 'true',
              afterDate 
            })
            const data = response.data || response
            setNewGuestsCount(data?.count || 0)
          } else {
            // Если никогда не просматривали, показываем общее количество
            const response = await usersService.getGuests({ 
              countOnly: 'true'
            })
            const data = response.data || response
            setNewGuestsCount(data?.count || 0)
          }
        } catch (error) {
          console.error('Ошибка загрузки счетчика новых гостей:', error)
        }
      }
    }

    loadNewGuestsCount()
    
    // Обновляем счетчик каждые 30 секунд
    const interval = setInterval(loadNewGuestsCount, 30000)

    return () => clearInterval(interval)
  }, [user, location.pathname])

  // Обновляем счетчик при посещении страницы новых гостей
  useEffect(() => {
    if (location.pathname === '/new-guests' && user?.role === UserRole.SUPER_ADMIN) {
      // Сохраняем текущее время как время последнего просмотра
      localStorage.setItem('guests_last_viewed', new Date().toISOString())
      setNewGuestsCount(0)
    }
  }, [location.pathname, user])

  // Загружаем счетчик ожидающих валидацию для суперадминистратора
  useEffect(() => {
    const loadPendingValidationCount = async () => {
      if (user?.role === UserRole.SUPER_ADMIN) {
        try {
          // Получаем всех пользователей с ролью PENDING_VALIDATION
          const usersResponse = await usersService.getAll({ limit: 1000 })
          const allUsers = usersResponse.data || usersResponse || []
          const pendingUsers = (Array.isArray(allUsers) ? allUsers : []).filter((user: any) => 
            user.role === UserRole.PENDING_VALIDATION
          )
          
          // Получаем все клубы, отправленные на валидацию, но еще не валидированные (исключая отклоненные)
          const clubsResponse = await clubsService.getAll({ limit: 1000, showHidden: 'true' })
          const allClubs = clubsResponse.data || []
          const pendingClubs = (Array.isArray(allClubs) ? allClubs : []).filter((club: any) => 
            club.isSubmittedForValidation === true && club.isValidated === false && !club.rejectionComment
          )
          
          setPendingValidationCount(pendingUsers.length + pendingClubs.length)
        } catch (error) {
          console.error('Ошибка загрузки счетчика ожидающих валидацию:', error)
        }
      }
    }

    loadPendingValidationCount()
    
    // Обновляем счетчик каждые 30 секунд
    const interval = setInterval(loadPendingValidationCount, 30000)

    return () => clearInterval(interval)
  }, [user, location.pathname])

  // Обновляем счетчик при посещении страницы валидации
  useEffect(() => {
    if (location.pathname === '/validation' && user?.role === UserRole.SUPER_ADMIN) {
      setPendingValidationCount(0)
    }
  }, [location.pathname, user])

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
            {navigation.length > 0 ? (
              navigation.map((item) => {
                const Icon = item.icon
                const isNewGuests = item.href === '/new-guests'
                const isValidation = item.href === '/validation'
                // Для владельца клуба меняем название "Яхт-клубы" на "Мои яхт-клубы"
                const displayName = item.href === '/clubs' && user?.role === UserRole.CLUB_OWNER 
                  ? 'Мои яхт-клубы' 
                  : item.name
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center justify-between px-4 py-2 text-sm font-medium rounded-lg ${
                      isActive(item.href)
                        ? 'bg-primary-50 text-primary-700'
                        : isValidation && pendingValidationCount > 0
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center">
                      <Icon className="mr-3 h-5 w-5" />
                      {displayName}
                    </div>
                    {isNewGuests && newGuestsCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-white bg-red-500 rounded-full">
                        {newGuestsCount}
                      </span>
                    )}
                    {isValidation && pendingValidationCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-white bg-red-500 rounded-full">
                        {pendingValidationCount}
                      </span>
                    )}
                  </Link>
                )
              })
            ) : (
              <div className="px-4 py-2 text-sm text-gray-500">
                Нет доступных пунктов меню
              </div>
            )}
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
            {navigation.length > 0 ? (
              navigation.map((item) => {
                const Icon = item.icon
                const isNewGuests = item.href === '/new-guests'
                const isValidation = item.href === '/validation'
                // Для владельца клуба меняем название "Яхт-клубы" на "Мои яхт-клубы"
                const displayName = item.href === '/clubs' && user?.role === UserRole.CLUB_OWNER 
                  ? 'Мои яхт-клубы' 
                  : item.name
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center justify-between px-4 py-2 text-sm font-medium rounded-lg ${
                      isActive(item.href)
                        ? 'bg-primary-50 text-primary-700'
                        : isValidation && pendingValidationCount > 0
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center">
                      <Icon className="mr-3 h-5 w-5" />
                      {displayName}
                    </div>
                    {isNewGuests && newGuestsCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-white bg-red-500 rounded-full">
                        {newGuestsCount}
                      </span>
                    )}
                    {isValidation && pendingValidationCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-white bg-red-500 rounded-full">
                        {pendingValidationCount}
                      </span>
                    )}
                  </Link>
                )
              })
            ) : (
              <div className="px-4 py-2 text-sm text-gray-500">
                Нет доступных пунктов меню
              </div>
            )}
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
                  {user?.role === UserRole.PENDING_VALIDATION && 'Ожидает валидации'}
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
              {(() => {
                const activeItem = navigation.find((item) => isActive(item.href))
                if (activeItem) {
                  // Для владельца клуба меняем название "Яхт-клубы" на "Мои яхт-клубы"
                  return activeItem.href === '/clubs' && user?.role === UserRole.CLUB_OWNER 
                    ? 'Мои яхт-клубы' 
                    : activeItem.name
                }
                return 'Marina CRM'
              })()}
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

