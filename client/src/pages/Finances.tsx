import { Link } from 'react-router-dom'
import { CreditCard, Wallet, TrendingUp, TrendingDown, BarChart, DollarSign } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { UserRole } from '../types'
import { useState, useEffect } from 'react'
import { vesselOwnerCashesService } from '../services/api'
import { LoadingAnimation } from '../components/LoadingAnimation'
import BackButton from '../components/BackButton'

export default function Finances() {
  const { user } = useAuth()
  const [totalIncome, setTotalIncome] = useState<number>(0)
  const [totalExpense, setTotalExpense] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.role === UserRole.VESSEL_OWNER) {
      loadFinancialData()
    } else {
      setLoading(false)
    }
  }, [user])

  const loadFinancialData = async () => {
    try {
      setLoading(true)
      const [incomeRes, expenseRes] = await Promise.all([
        vesselOwnerCashesService.getTotalIncome(),
        vesselOwnerCashesService.getTotalExpense(),
      ])
      setTotalIncome(Number((incomeRes as any)?.totalIncome || 0))
      setTotalExpense(Number((expenseRes as any)?.totalExpense || 0))
    } catch (error) {
      console.error('Ошибка загрузки финансовых данных:', error)
    } finally {
      setLoading(false)
    }
  }

  const financeModules = [
    {
      name: 'Платежи',
      href: '/payments',
      icon: CreditCard,
      description: 'Управление платежами и оплатами',
      color: 'bg-blue-500',
      availableFor: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLUB_OWNER],
    },
    {
      name: 'Платежи за яхт клуб',
      href: '/payments',
      icon: CreditCard,
      description: 'Здесь отображаются все платежи за стоянку в яхт-клубе',
      color: 'bg-blue-500',
      availableFor: [UserRole.VESSEL_OWNER],
    },
    {
      name: 'Касса',
      href: '/cash',
      icon: Wallet,
      description: 'Управление кассами и транзакциями',
      color: 'bg-purple-500',
      availableFor: [UserRole.VESSEL_OWNER],
    },
    {
      name: 'Приходы',
      href: '/incomes',
      icon: TrendingUp,
      description: 'Просмотр приходов',
      color: 'bg-green-500',
      availableFor: [UserRole.VESSEL_OWNER],
      value: totalIncome,
      showValue: true,
    },
    {
      name: 'Расходы',
      href: '/expenses',
      icon: TrendingDown,
      description: 'Управление расходами',
      color: 'bg-red-500',
      availableFor: [UserRole.VESSEL_OWNER],
      value: totalExpense,
      showValue: true,
    },
    {
      name: 'Аналитика',
      href: '/analytics',
      icon: BarChart,
      description: 'Финансовая аналитика и отчеты',
      color: 'bg-indigo-500',
      availableFor: [UserRole.VESSEL_OWNER],
    },
  ]

  const availableModules = financeModules.filter((module) =>
    user?.role ? module.availableFor.includes(user.role) : false
  )

  if (loading) {
    return <LoadingAnimation message="Загрузка финансовых данных..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <DollarSign className="h-8 w-8 text-primary-600 mr-3" />
            Финансы
          </h1>
          <p className="mt-2 text-gray-600">Управление финансовыми операциями</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {availableModules.map((module) => {
          const Icon = module.icon
          return (
            <Link
              key={module.name}
              to={module.href}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${module.color} p-3 rounded-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="text-sm text-gray-500 group-hover:text-primary-600 transition-colors">
                  Перейти →
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{module.name}</h3>
              <p className="text-gray-600 text-sm mb-4">{module.description}</p>
              {module.showValue && module.value !== undefined && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-2xl font-bold text-gray-900">
                    {Number(module.value).toLocaleString('ru-RU', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    ₽
                  </p>
                </div>
              )}
            </Link>
          )
        })}
      </div>

      {availableModules.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Нет доступных финансовых модулей для вашей роли</p>
        </div>
      )}
    </div>
  )
}
