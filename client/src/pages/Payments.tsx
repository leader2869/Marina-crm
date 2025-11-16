import { useEffect, useState } from 'react'
import { paymentsService } from '../services/api'
import { Payment, UserRole } from '../types'
import { CreditCard } from 'lucide-react'
import { format } from 'date-fns'
import { LoadingAnimation } from '../components/LoadingAnimation'
import BackButton from '../components/BackButton'
import { useAuth } from '../contexts/AuthContext'

export default function Payments() {
  const { user } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  
  const isVesselOwner = user?.role === UserRole.VESSEL_OWNER

  useEffect(() => {
    loadPayments()
  }, [])

  const loadPayments = async () => {
    try {
      const response = await paymentsService.getAll({ limit: 100 })
      setPayments(response.data || [])
    } catch (error) {
      console.error('Ошибка загрузки платежей:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'refunded':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'Ожидает оплаты',
      paid: 'Оплачено',
      overdue: 'Просрочено',
      cancelled: 'Отменен',
      refunded: 'Возвращено',
    }
    return statusMap[status] || status
  }

  if (loading) {
    return <LoadingAnimation message="Загрузка платежей..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isVesselOwner ? 'Платежи за яхт клуб' : 'Платежи'}
          </h1>
          <p className="mt-2 text-gray-600">
            {isVesselOwner 
              ? 'Здесь отображаются все платежи за стоянку в яхт-клубе'
              : 'Управление платежами'
            }
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Сумма
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Срок оплаты
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Способ оплаты
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payments.map((payment) => (
              <tr key={payment.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">
                    {payment.amount.toLocaleString()} {payment.currency}
                  </div>
                  {payment.penalty > 0 && (
                    <div className="text-xs text-red-600">Пеня: {payment.penalty.toLocaleString()}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {format(new Date(payment.dueDate), 'dd.MM.yyyy')}
                  </div>
                  {payment.paidDate && (
                    <div className="text-xs text-gray-500">
                      Оплачено: {format(new Date(payment.paidDate), 'dd.MM.yyyy')}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{payment.method}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                      payment.status
                    )}`}
                  >
                    {getStatusText(payment.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payments.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Платежи не найдены</p>
        </div>
      )}
    </div>
  )
}

