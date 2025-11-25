import { useEffect, useState } from 'react'
import { FilePlus, Ship, User, Calendar, DollarSign, MapPin, MessageSquare, X } from 'lucide-react'
import { agentOrdersService, vesselsService } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { AgentOrder, AgentOrderResponse, Vessel } from '../../types'
import { format } from 'date-fns'
import { LoadingAnimation } from '../../components/LoadingAnimation'

export default function CreateOrder() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<AgentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showResponseModal, setShowResponseModal] = useState<number | null>(null)
  const [showResponsesModal, setShowResponsesModal] = useState<number | null>(null)
  const [userVessels, setUserVessels] = useState<Vessel[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [responding, setResponding] = useState(false)
  const [error, setError] = useState('')

  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    passengerCount: '',
    budget: '',
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
    if (!createForm.title || !createForm.description || !createForm.startDate || !createForm.endDate || !createForm.passengerCount) {
      setError('Заполните все обязательные поля')
      return
    }

    setCreating(true)
    setError('')

    try {
      await agentOrdersService.create(createForm)
      setShowCreateModal(false)
      setCreateForm({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        passengerCount: '',
        budget: '',
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

  const handleSelectVessel = async (orderId: number, responseId: number) => {
    try {
      await agentOrdersService.selectVessel(orderId, { responseId })
      setShowResponsesModal(null)
      await loadOrders()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка выбора катера')
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
                      <span>{format(new Date(order.startDate), 'dd.MM.yyyy')} - {format(new Date(order.endDate), 'dd.MM.yyyy')}</span>
                    </div>
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

                  <div className="flex items-center text-sm text-gray-500">
                    <span>Создал: {order.createdBy?.firstName} {order.createdBy?.lastName}</span>
                    <span className="mx-2">•</span>
                    <span>{format(new Date(order.createdAt), 'dd.MM.yyyy HH:mm')}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  {order.responses && order.responses.length > 0 && (
                    <span className="text-sm text-gray-600">
                      Откликов: {order.responses.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isOrderCreator(order) && order.responses && order.responses.length > 0 && (
                    <button
                      onClick={() => setShowResponsesModal(order.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      Просмотреть отклики ({order.responses.length})
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
                        Дата окончания *
                      </label>
                      <input
                        type="date"
                        value={createForm.endDate}
                        onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Бюджет (₽)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={createForm.budget}
                        onChange={(e) => setCreateForm({ ...createForm, budget: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
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
                      Предложенная цена (₽)
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

      {/* Модальное окно просмотра откликов */}
      {showResponsesModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowResponsesModal(null)} />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Отклики на заказ</h3>
                  <button onClick={() => setShowResponsesModal(null)} className="text-gray-400 hover:text-gray-500">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {(() => {
                  const order = orders.find(o => o.id === showResponsesModal)
                  if (!order || !order.responses || order.responses.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600">Пока нет откликов на этот заказ</p>
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-4">
                      {order.responses.map((response: AgentOrderResponse) => {
                        const vessel = response.vessel
                        const mainPhotoIndex = vessel?.mainPhotoIndex !== undefined && vessel?.mainPhotoIndex !== null 
                          ? vessel.mainPhotoIndex 
                          : 0
                        const mainPhoto = vessel?.photos && vessel.photos.length > 0 
                          ? vessel.photos[mainPhotoIndex] 
                          : null
                        
                        return (
                          <div key={response.id} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            {/* Фото катера */}
                            {mainPhoto ? (
                              <div className="relative h-48 bg-gray-200">
                                <img
                                  src={mainPhoto}
                                  alt={vessel?.name || 'Катер'}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                  }}
                                />
                                <div className="absolute top-2 right-2">
                                  {response.status === 'accepted' && (
                                    <span className="px-2 py-1 bg-green-500 text-white rounded text-xs font-semibold shadow">
                                      Выбран
                                    </span>
                                  )}
                                  {response.status === 'rejected' && (
                                    <span className="px-2 py-1 bg-red-500 text-white rounded text-xs font-semibold shadow">
                                      Отклонен
                                    </span>
                                  )}
                                  {response.status === 'pending' && (
                                    <span className="px-2 py-1 bg-yellow-500 text-white rounded text-xs font-semibold shadow">
                                      Ожидает
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="relative h-48 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                                <Ship className="h-16 w-16 text-blue-400" />
                                <div className="absolute top-2 right-2">
                                  {response.status === 'accepted' && (
                                    <span className="px-2 py-1 bg-green-500 text-white rounded text-xs font-semibold shadow">
                                      Выбран
                                    </span>
                                  )}
                                  {response.status === 'rejected' && (
                                    <span className="px-2 py-1 bg-red-500 text-white rounded text-xs font-semibold shadow">
                                      Отклонен
                                    </span>
                                  )}
                                  {response.status === 'pending' && (
                                    <span className="px-2 py-1 bg-yellow-500 text-white rounded text-xs font-semibold shadow">
                                      Ожидает
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Информация о катере */}
                            <div className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h4 className="text-lg font-semibold text-gray-900 mb-1 flex items-center">
                                    <Ship className="h-5 w-5 text-primary-600 mr-2" />
                                    {vessel?.name || 'Катер'}
                                  </h4>
                                  <div className="text-sm text-gray-600 mb-2">
                                    <span>Владелец: {response.vesselOwner?.firstName} {response.vesselOwner?.lastName}</span>
                                    <span className="mx-2">•</span>
                                    <span>Пассажировместимость: {vessel?.passengerCapacity || '-'} чел.</span>
                                  </div>
                                </div>
                              </div>

                              {/* Краткое описание катера */}
                              {vessel?.technicalSpecs && (
                                <div className="mb-3">
                                  <p className="text-sm text-gray-700 line-clamp-2">
                                    {vessel.technicalSpecs.length > 150 
                                      ? `${vessel.technicalSpecs.substring(0, 150)}...` 
                                      : vessel.technicalSpecs}
                                  </p>
                                </div>
                              )}

                              {/* Предложенная цена */}
                              {response.proposedPrice && (
                                <div className="mb-3 p-3 bg-primary-50 rounded-lg border border-primary-200">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">Предложенная цена:</span>
                                    <span className="text-lg font-bold text-primary-600">
                                      {response.proposedPrice.toLocaleString('ru-RU')} ₽
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Сообщение от владельца */}
                              {response.message && (
                                <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                                  <p className="text-sm text-gray-700 italic">"{response.message}"</p>
                                </div>
                              )}

                              {/* Кнопка выбора */}
                              {order.status === 'active' && response.status === 'pending' && (
                                <button
                                  onClick={() => handleSelectVessel(order.id, response.id)}
                                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition-colors"
                                >
                                  Выбрать этот катер
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setShowResponsesModal(null)}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
