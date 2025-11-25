import { useEffect, useState } from 'react'
import { CheckCircle, User, Calendar, DollarSign, MapPin, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { agentOrdersService } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { AgentOrder } from '../../types'
import { format } from 'date-fns'
import { LoadingAnimation } from '../../components/LoadingAnimation'

export default function CompletedOrders() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<AgentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadOrders()
  }, [user])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const response = await agentOrdersService.getAll({ status: 'completed', limit: 100 })
      // API возвращает объект с пагинацией: { data: [...], total: number, page: number, limit: number }
      const ordersData = Array.isArray(response) ? response : (response.data || response || [])
      setOrders(ordersData)
    } catch (err: any) {
      console.error('Ошибка загрузки завершенных заказов:', err)
      setError(err.error || err.message || 'Ошибка загрузки завершенных заказов')
    } finally {
      setLoading(false)
    }
  }

  const isOrderCreator = (order: AgentOrder) => {
    return order.createdById === user?.id
  }

  if (loading) {
    return <LoadingAnimation message="Загрузка завершенных заказов..." />
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <CheckCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Завершенные заказы</h2>
          <p className="text-gray-600">Нет завершенных заказов</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {orders.map((order) => (
          <div key={order.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{order.title}</h3>
                <p className="text-gray-600 mb-4">{order.description}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2 text-primary-600" />
                    <span>{format(new Date(order.startDate), 'dd.MM.yyyy')} - {format(new Date(order.endDate), 'dd.MM.yyyy')}</span>
                  </div>
                  {order.startTime && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-2 text-primary-600" />
                      <span>Время начала: {order.startTime}</span>
                    </div>
                  )}
                  {order.hoursCount && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-2 text-primary-600" />
                      <span>Количество часов: {order.hoursCount} ч.</span>
                    </div>
                  )}
                  <div className="flex items-center text-sm text-gray-600">
                    <User className="h-4 w-4 mr-2 text-primary-600" />
                    <span>{order.passengerCount} пассажиров</span>
                  </div>
                  {order.budget && (
                    <div className="flex items-center text-sm text-gray-600">
                      <DollarSign className="h-4 w-4 mr-2 text-primary-600" />
                      <span>{order.budget.toLocaleString()} ₽</span>
                    </div>
                  )}
                  {order.route && (
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mr-2 text-primary-600" />
                      <span>{order.route}</span>
                    </div>
                  )}
                </div>

                {order.additionalRequirements && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-1">Дополнительные требования:</p>
                    <p className="text-sm text-gray-600">{order.additionalRequirements}</p>
                  </div>
                )}

                {order.selectedVessel && (
                  <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm font-medium text-green-800 mb-1">Выбранный катер:</p>
                    <p className="text-sm text-green-700">{order.selectedVessel.name}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                  Завершен
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                  Исполнитель
                </span>
              </div>
              {isOrderCreator(order) && order.responses && order.responses.length > 0 && (
                <button
                  onClick={() => navigate(`/agent/orders/${order.id}/responses`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Просмотреть отклики ({order.responses.length})
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
