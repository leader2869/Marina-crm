import { useEffect, useState } from 'react'
import { CheckCircle, User, Calendar, DollarSign, MapPin, Clock, Ship, X, Image as ImageIcon, User as UserIcon } from 'lucide-react'
import { agentOrdersService, vesselsService } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { AgentOrder, Vessel } from '../../types'
import { format } from 'date-fns'
import { LoadingAnimation } from '../../components/LoadingAnimation'

export default function CompletedOrders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<AgentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showVesselModal, setShowVesselModal] = useState<Vessel | null>(null)
  const [vesselDetails, setVesselDetails] = useState<Vessel | null>(null)
  const [loadingVesselDetails, setLoadingVesselDetails] = useState(false)

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

  const handleViewVessel = async (vessel: Vessel) => {
    setShowVesselModal(vessel)
    setVesselDetails(null)
    setLoadingVesselDetails(true)
    
    try {
      const fullVessel = await vesselsService.getById(vessel.id) as unknown as Vessel
      setVesselDetails(fullVessel)
    } catch (err: any) {
      console.error('Ошибка загрузки деталей катера:', err)
      setVesselDetails(vessel)
    } finally {
      setLoadingVesselDetails(false)
    }
  }

  const isOrderCreator = (order: AgentOrder) => {
    return order.createdById === user?.id
  }

  const isVesselOwner = (order: AgentOrder) => {
    return order.selectedVessel?.ownerId === user?.id
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

                {order.selectedVessel && (() => {
                  // Используем данные из responses.vessel если они есть (более полные), иначе из selectedVessel
                  const acceptedResponse = order.responses?.find((r: any) => r.status === 'accepted') || order.responses?.[0];
                  const vessel = acceptedResponse?.vessel || order.selectedVessel;
                  // Преобразуем price в число, если это строка (DECIMAL из БД может быть строкой)
                  let price: number | null = null;
                  if (acceptedResponse?.proposedPrice !== null && acceptedResponse?.proposedPrice !== undefined) {
                    const rawPrice = acceptedResponse.proposedPrice;
                    const numPrice = typeof rawPrice === 'string' ? parseFloat(rawPrice) : Number(rawPrice);
                    // Проверяем, что это валидное число
                    if (!isNaN(numPrice)) {
                      price = numPrice;
                    }
                  }

                  return (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Выбранный катер:</p>
                      <div 
                        onClick={() => handleViewVessel(vessel)}
                        className="rounded-lg shadow hover:shadow-lg transition-shadow p-6 relative overflow-hidden cursor-pointer"
                        style={{
                          backgroundImage: (() => {
                            if (vessel.photos && Array.isArray(vessel.photos) && vessel.photos.length > 0) {
                              const mainIndex = vessel.mainPhotoIndex !== undefined && vessel.mainPhotoIndex !== null 
                                ? vessel.mainPhotoIndex 
                                : 0
                              return `url(${vessel.photos[mainIndex]})`
                            }
                            return undefined
                          })(),
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundColor: (vessel.photos && Array.isArray(vessel.photos) && vessel.photos.length > 0) ? undefined : 'white',
                        }}
                      >
                        {/* Затемнение для читаемости текста */}
                        {(vessel.photos && Array.isArray(vessel.photos) && vessel.photos.length > 0) && (
                          <div className="absolute inset-0 bg-black bg-opacity-40 z-0" />
                        )}
                        <div className="relative z-10">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center flex-1">
                              <Ship className={`h-8 w-8 mr-3 ${(vessel.photos && Array.isArray(vessel.photos) && vessel.photos.length > 0) ? 'text-white' : 'text-primary-600'}`} />
                              <div className="flex-1">
                                <h3 className={`text-xl font-semibold ${(vessel.photos && Array.isArray(vessel.photos) && vessel.photos.length > 0) ? 'text-white' : 'text-gray-900'}`}>
                                  {vessel.name}
                                </h3>
                                {vessel.type && (
                                  <p className={`text-sm ${(vessel.photos && Array.isArray(vessel.photos) && vessel.photos.length > 0) ? 'text-gray-200' : 'text-gray-600'}`}>
                                    {vessel.type}
                                  </p>
                                )}
                              </div>
                            </div>
                            {price && (
                              <div className={`text-right ${(vessel.photos && Array.isArray(vessel.photos) && vessel.photos.length > 0) ? 'text-white' : 'text-gray-900'}`}>
                                <p className="text-xs font-medium opacity-80 mb-1">Предложенная цена</p>
                                <p className="text-2xl font-bold">
                                  {Number(price).toLocaleString()} ₽
                                </p>
                              </div>
                            )}
                          </div>
                          
                          <div className={`grid grid-cols-2 gap-4 ${(vessel.photos && Array.isArray(vessel.photos) && vessel.photos.length > 0) ? 'text-white' : 'text-gray-700'}`}>
                            {vessel.passengerCapacity !== undefined && vessel.passengerCapacity !== null && (
                              <div className="flex items-center text-sm">
                                <User className="h-4 w-4 mr-2 opacity-80" />
                                <span>Пассажировместимость: {vessel.passengerCapacity}</span>
                              </div>
                            )}
                            {vessel.length && (
                              <div className="flex items-center text-sm">
                                <span>Длина: {vessel.length} м</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                  Завершен
                </span>
                {isOrderCreator(order) && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">
                    Агент
                  </span>
                )}
                {isVesselOwner(order) && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                    Исполнитель
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Модальное окно просмотра катера */}
      {showVesselModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowVesselModal(null)} />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <Ship className="h-6 w-6 text-primary-600 mr-2" />
                    {showVesselModal.name}
                  </h3>
                  <button onClick={() => setShowVesselModal(null)} className="text-gray-400 hover:text-gray-500">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {loadingVesselDetails ? (
                  <div className="py-12 text-center">
                    <LoadingAnimation message="Загрузка информации о катере..." />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {vesselDetails?.photos && vesselDetails.photos.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Фотографии катера
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {vesselDetails.photos.map((photo, index) => (
                            <div key={index} className="relative">
                              <img
                                src={photo}
                                alt={`${vesselDetails.name} - фото ${index + 1}`}
                                className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                }}
                              />
                              {vesselDetails.mainPhotoIndex === index && (
                                <div className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold">
                                  Главное
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
                        <p className="text-sm text-gray-900">{vesselDetails?.type || showVesselModal.type || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Длина</label>
                        <p className="text-sm text-gray-900">{vesselDetails?.length || showVesselModal.length || '-'} м</p>
                      </div>
                      {vesselDetails?.width && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Ширина</label>
                          <p className="text-sm text-gray-900">{vesselDetails.width} м</p>
                        </div>
                      )}
                      {vesselDetails?.heightAboveWaterline && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Высота над ватерлинией</label>
                          <p className="text-sm text-gray-900">{vesselDetails.heightAboveWaterline} м</p>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Пассажировместимость</label>
                        <p className="text-sm text-gray-900">{vesselDetails?.passengerCapacity || showVesselModal.passengerCapacity || '-'} чел.</p>
                      </div>
                      {vesselDetails?.registrationNumber && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Регистрационный номер</label>
                          <p className="text-sm text-gray-900">{vesselDetails.registrationNumber}</p>
                        </div>
                      )}
                    </div>

                    {vesselDetails?.technicalSpecs && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Описание катера</label>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{vesselDetails.technicalSpecs}</p>
                      </div>
                    )}

                    {showVesselModal.owner && (
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                          <UserIcon className="h-4 w-4 mr-2" />
                          Владелец
                        </h4>
                        <p className="text-sm text-gray-900">
                          {showVesselModal.owner.firstName} {showVesselModal.owner.lastName}
                        </p>
                        {showVesselModal.owner.email && (
                          <p className="text-sm text-gray-600">{showVesselModal.owner.email}</p>
                        )}
                        {showVesselModal.owner.phone && (
                          <p className="text-sm text-gray-600">{showVesselModal.owner.phone}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setShowVesselModal(null)}
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
