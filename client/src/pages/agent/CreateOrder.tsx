import { useEffect, useState } from 'react'
import { FilePlus, User, Calendar, DollarSign, MapPin, X, XCircle, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { agentOrdersService, vesselsService } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { AgentOrder, Vessel } from '../../types'
import { format } from 'date-fns'
import { LoadingAnimation } from '../../components/LoadingAnimation'

export default function CreateOrder() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<AgentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showResponseModal, setShowResponseModal] = useState<number | null>(null)
  const [userVessels, setUserVessels] = useState<Vessel[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [responding, setResponding] = useState(false)
  const [cancelling, setCancelling] = useState<number | null>(null)
  const [error, setError] = useState('')

  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    hoursCount: '',
    passengerCount: '',
    budgetFrom: '',
    budgetTo: '',
    route: '',
    additionalRequirements: '',
  })

  const [responseForm, setResponseForm] = useState({
    vesselId: '',
    message: '',
    proposedPrice: '',
  })

  useEffect(() => {
    loadOrders()
    if (user) {
      loadUserVessels()
    }
  }, [user])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const response = await agentOrdersService.getAll({ status: 'active', limit: 100 })
      // API возвращает объект с пагинацией: { data: [...], total: number, page: number, limit: number }
      const ordersData = Array.isArray(response) ? response : (response.data || response || [])
      setOrders(ordersData)
    } catch (err: any) {
      console.error('Ошибка загрузки заказов:', err)
      setError(err.error || err.message || 'Ошибка загрузки заказов')
    } finally {
      setLoading(false)
    }
  }

  const loadUserVessels = async () => {
    try {
      const response = await vesselsService.getAll({ limit: 100 })
      const allVessels = response.data || []
      // Фильтруем только катера пользователя (если не суперадмин)
      const vessels = user?.role === 'super_admin' 
        ? allVessels 
        : allVessels.filter((v: Vessel) => v.ownerId === user?.id)
      setUserVessels(vessels)
    } catch (err: any) {
      console.error('Ошибка загрузки катеров:', err)
    }
  }

  const handleCreateOrder = async () => {
    if (!createForm.title || !createForm.description || !createForm.startDate || !createForm.startTime || !createForm.hoursCount || !createForm.passengerCount) {
      setError('Заполните все обязательные поля')
      return
    }

    // Вычисляем дату окончания на основе даты начала, времени начала и количества часов
    const startDateTime = new Date(`${createForm.startDate}T${createForm.startTime}`)
    const hours = parseInt(createForm.hoursCount) || 0
    const endDateTime = new Date(startDateTime.getTime() + hours * 60 * 60 * 1000)
    const endDate = endDateTime.toISOString().split('T')[0]

    setCreating(true)
    setError('')

    try {
      // Формируем данные для отправки
      const orderData: any = {
        title: createForm.title,
        description: createForm.description,
        startDate: createForm.startDate,
        startTime: createForm.startTime,
        hoursCount: parseFloat(createForm.hoursCount) || 0,
        endDate: endDate,
        passengerCount: parseInt(createForm.passengerCount),
        route: createForm.route || null,
        additionalRequirements: createForm.additionalRequirements || null,
      }

      // Сохраняем бюджет от и до
      if (createForm.budgetFrom) {
        orderData.budgetFrom = parseFloat(createForm.budgetFrom) || null
      }
      if (createForm.budgetTo) {
        orderData.budgetTo = parseFloat(createForm.budgetTo) || null
      }
      // Для обратной совместимости сохраняем среднее значение в budget
      if (createForm.budgetFrom || createForm.budgetTo) {
        const from = parseFloat(createForm.budgetFrom) || 0
        const to = parseFloat(createForm.budgetTo) || 0
        if (from > 0 && to > 0) {
          orderData.budget = (from + to) / 2
        } else if (from > 0) {
          orderData.budget = from
        } else if (to > 0) {
          orderData.budget = to
        }
      }

      await agentOrdersService.create(orderData)
      setShowCreateModal(false)
      setCreateForm({
        title: '',
        description: '',
        startDate: '',
        startTime: '',
        hoursCount: '',
        passengerCount: '',
        budgetFrom: '',
        budgetTo: '',
        route: '',
        additionalRequirements: '',
      })
      await loadOrders()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка создания заказа')
    } finally {
      setCreating(false)
    }
  }

  const handleCancelOrder = async (orderId: number) => {
    if (!confirm('Вы уверены, что хотите отменить этот заказ?')) {
      return
    }

    setCancelling(orderId)
    setError('')

    try {
      await agentOrdersService.cancel(orderId)
      await loadOrders()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка отмены заказа')
    } finally {
      setCancelling(null)
    }
  }

  const handleRespond = async (orderId: number) => {
    if (!responseForm.vesselId) {
      setError('Выберите катер')
      return
    }

    setResponding(true)
    setError('')

    try {
      await agentOrdersService.respond(orderId, {
        vesselId: parseInt(responseForm.vesselId),
        message: responseForm.message || null,
        proposedPrice: responseForm.proposedPrice ? parseFloat(responseForm.proposedPrice) : null,
      })
      setShowResponseModal(null)
      setResponseForm({
        vesselId: '',
        message: '',
        proposedPrice: '',
      })
      await loadOrders()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка отклика на заказ')
    } finally {
      setResponding(false)
    }
  }


  const canRespond = () => {
    // Могут откликаться только владельцы катеров
    return user?.role === 'vessel_owner' && userVessels.length > 0
  }

  const isOrderCreator = (order: AgentOrder) => {
    return order.createdById === user?.id
  }

  if (loading) {
    return <LoadingAnimation message="Загрузка активных заказов..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">Активные заказы</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <FilePlus className="h-5 w-5 mr-2" />
          Разместить заказ
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FilePlus className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Нет активных заказов</h3>
          <p className="text-gray-600 mb-4">Создайте первый заказ, нажав кнопку "Разместить заказ"</p>
        </div>
      ) : (
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
                      <span>{format(new Date(order.startDate), 'dd.MM.yyyy')}</span>
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
                    {(order.budgetFrom || order.budgetTo) && (
                      <div className="flex items-center text-sm text-gray-600">
                        <DollarSign className="h-4 w-4 mr-2 text-primary-600" />
                        <span>
                          {order.budgetFrom && order.budgetTo
                            ? `от ${order.budgetFrom.toLocaleString()} до ${order.budgetTo.toLocaleString()} ₽`
                            : order.budgetFrom
                            ? `от ${order.budgetFrom.toLocaleString()} ₽`
                            : order.budgetTo
                            ? `до ${order.budgetTo.toLocaleString()} ₽`
                            : ''}
                        </span>
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

                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  {isOrderCreator(order) && (order.responsesCount || 0) > 0 && (
                    <span className="text-sm text-gray-600">
                      Откликов: {order.responsesCount || 0}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isOrderCreator(order) && (order.responsesCount || 0) > 0 && (
                    <button
                      onClick={() => navigate(`/agent/orders/${order.id}/responses`)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      Просмотреть отклики ({order.responsesCount || 0})
                    </button>
                  )}
                  {isOrderCreator(order) && order.status === 'active' && (
                    <button
                      onClick={() => handleCancelOrder(order.id)}
                      disabled={cancelling === order.id}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      {cancelling === order.id ? 'Отмена...' : 'Отменить заказ'}
                    </button>
                  )}
                  {canRespond() && !isOrderCreator(order) && (
                    <button
                      onClick={() => {
                        setSelectedOrderId(order.id)
                        setShowResponseModal(order.id)
                      }}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                    >
                      Откликнуться
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно создания заказа */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowCreateModal(false)} />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Разместить заказ</h3>
                  <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-500">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Название заказа *
                    </label>
                    <input
                      type="text"
                      value={createForm.title}
                      onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Описание *
                    </label>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Дата начала *
                      </label>
                      <input
                        type="date"
                        value={createForm.startDate}
                        onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Время начала *
                      </label>
                      <input
                        type="time"
                        value={createForm.startTime}
                        onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Количество часов *
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={createForm.hoursCount}
                        onChange={(e) => setCreateForm({ ...createForm, hoursCount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Например: 2, 4, 8"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Количество пассажиров *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={createForm.passengerCount}
                        onChange={(e) => setCreateForm({ ...createForm, passengerCount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Бюджет от (₽)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={createForm.budgetFrom}
                        onChange={(e) => setCreateForm({ ...createForm, budgetFrom: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Минимальная цена"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Бюджет до (₽)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={createForm.budgetTo}
                        onChange={(e) => setCreateForm({ ...createForm, budgetTo: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Максимальная цена"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Маршрут
                    </label>
                    <input
                      type="text"
                      value={createForm.route}
                      onChange={(e) => setCreateForm({ ...createForm, route: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Дополнительные требования
                    </label>
                    <textarea
                      value={createForm.additionalRequirements}
                      onChange={(e) => setCreateForm({ ...createForm, additionalRequirements: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleCreateOrder}
                  disabled={creating}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {creating ? 'Создание...' : 'Создать заказ'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно отклика на заказ */}
      {showResponseModal && selectedOrderId && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowResponseModal(null)} />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Откликнуться на заказ</h3>
                  <button onClick={() => setShowResponseModal(null)} className="text-gray-400 hover:text-gray-500">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Выберите катер *
                    </label>
                    <select
                      value={responseForm.vesselId}
                      onChange={(e) => setResponseForm({ ...responseForm, vesselId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      required
                    >
                      <option value="">-- Выберите катер --</option>
                      {userVessels.map((vessel) => (
                        <option key={vessel.id} value={vessel.id}>
                          {vessel.name} ({vessel.passengerCapacity} пасс.)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Цена за ЗАКАЗ (₽)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={responseForm.proposedPrice}
                      onChange={(e) => setResponseForm({ ...responseForm, proposedPrice: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Сообщение
                    </label>
                    <textarea
                      value={responseForm.message}
                      onChange={(e) => setResponseForm({ ...responseForm, message: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Дополнительная информация о вашем предложении..."
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => handleRespond(selectedOrderId)}
                  disabled={responding}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {responding ? 'Отправка...' : 'Откликнуться'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResponseModal(null)}
                  disabled={responding}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
