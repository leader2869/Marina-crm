import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { agentOrdersService, vesselsService } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { AgentOrder, AgentOrderResponse, Vessel } from '../../types'
import { format } from 'date-fns'
import { Ship, User, Calendar, DollarSign, MapPin, MessageSquare, X, User as UserIcon, Image as ImageIcon, Send, CheckSquare, Square, Share2, XCircle, Download } from 'lucide-react'
import { LoadingAnimation } from '../../components/LoadingAnimation'
import BackButton from '../../components/BackButton'
import html2canvas from 'html2canvas'

export default function OrderResponses() {
  const { orderId } = useParams<{ orderId: string }>()
  const { user } = useAuth()
  const [order, setOrder] = useState<AgentOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedResponses, setSelectedResponses] = useState<Set<number>>(new Set())
  const [showShareModal, setShowShareModal] = useState(false)
  const [showVesselModal, setShowVesselModal] = useState<Vessel | null>(null)
  const [vesselDetails, setVesselDetails] = useState<Vessel | null>(null)
  const [loadingVesselDetails, setLoadingVesselDetails] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (orderId) {
      loadOrder()
    }
  }, [orderId])

  const loadOrder = async () => {
    try {
      setLoading(true)
      const data = await agentOrdersService.getById(parseInt(orderId!)) as unknown as AgentOrder
      console.log('[OrderResponses] Order loaded:', {
        id: data.id,
        createdById: data.createdById,
        responsesCount: data.responses?.length || 0,
        responses: data.responses?.map((r: AgentOrderResponse) => ({
          id: r.id,
          vesselId: r.vesselId,
          vesselName: r.vessel?.name
        }))
      })
      setOrder(data)
    } catch (err: any) {
      console.error('Ошибка загрузки заказа:', err)
      setError(err.error || err.message || 'Ошибка загрузки заказа')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectVessel = async (responseId: number) => {
    if (!order) return
    
    try {
      await agentOrdersService.selectVessel(order.id, { responseId })
      await loadOrder()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка выбора катера')
    }
  }

  const handleCancelOrder = async () => {
    if (!order) return
    
    if (!confirm('Вы уверены, что хотите отменить этот заказ?')) {
      return
    }

    setCancelling(true)
    setError('')

    try {
      await agentOrdersService.cancel(order.id)
      await loadOrder()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка отмены заказа')
    } finally {
      setCancelling(false)
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

  const toggleResponseSelection = (responseId: number) => {
    console.log('[OrderResponses] toggleResponseSelection:', responseId)
    setSelectedResponses(prev => {
      const newSet = new Set(prev)
      if (newSet.has(responseId)) {
        newSet.delete(responseId)
        console.log('[OrderResponses] Removed from selection:', responseId)
      } else {
        newSet.add(responseId)
        console.log('[OrderResponses] Added to selection:', responseId)
      }
      console.log('[OrderResponses] New selection:', Array.from(newSet))
      return newSet
    })
  }

  const generateVesselCardsImage = async (responses: AgentOrderResponse[]) => {
    if (!order) return

    try {
      // Создаем временный контейнер для карточек
      const container = document.createElement('div')
      container.style.position = 'absolute'
      container.style.left = '-9999px'
      container.style.top = '0'
      container.style.width = '1200px'
      container.style.backgroundColor = '#f3f4f6'
      container.style.padding = '40px'
      container.style.fontFamily = 'system-ui, -apple-system, sans-serif'
      document.body.appendChild(container)

      // Заголовок документа
      const header = document.createElement('div')
      header.style.marginBottom = '30px'
      header.style.paddingBottom = '20px'
      header.style.borderBottom = '2px solid #e5e7eb'
      header.innerHTML = `
        <h1 style="font-size: 28px; font-weight: bold; color: #111827; margin: 0 0 10px 0;">Предложения по заказу</h1>
        <h2 style="font-size: 20px; font-weight: 600; color: #374151; margin: 0 0 15px 0;">${order.title}</h2>
        <div style="display: flex; gap: 20px; flex-wrap: wrap; font-size: 14px; color: #6b7280;">
          <div>📅 Даты: ${format(new Date(order.startDate), 'dd.MM.yyyy')} - ${format(new Date(order.endDate), 'dd.MM.yyyy')}</div>
          <div>👥 Пассажиров: ${order.passengerCount}</div>
          ${order.budget ? `<div>💰 Бюджет: ${order.budget.toLocaleString('ru-RU')} ₽</div>` : ''}
          ${order.route ? `<div>📍 Маршрут: ${order.route}</div>` : ''}
        </div>
      `
      container.appendChild(header)

      // Создаем карточки катеров
      const cardsContainer = document.createElement('div')
      cardsContainer.style.display = 'grid'
      cardsContainer.style.gridTemplateColumns = 'repeat(2, 1fr)'
      cardsContainer.style.gap = '30px'
      container.appendChild(cardsContainer)

      // Ждем, пока все изображения загрузятся
      const imagePromises: Promise<void>[] = []

      for (let i = 0; i < responses.length; i++) {
        const response = responses[i]
        const vessel = response.vessel
        const mainPhotoIndex = vessel?.mainPhotoIndex !== undefined && vessel?.mainPhotoIndex !== null 
          ? vessel.mainPhotoIndex 
          : 0
        const mainPhoto = vessel?.photos && vessel.photos.length > 0 
          ? vessel.photos[mainPhotoIndex] 
          : null

        const card = document.createElement('div')
        card.style.backgroundColor = '#ffffff'
        card.style.borderRadius = '12px'
        card.style.overflow = 'hidden'
        card.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)'
        card.style.position = 'relative'
        card.style.minHeight = '400px'

        // Фон с изображением или градиентом
        if (mainPhoto) {
          card.style.backgroundImage = `url(${mainPhoto})`
          card.style.backgroundSize = 'cover'
          card.style.backgroundPosition = 'center'
          const overlay = document.createElement('div')
          overlay.style.position = 'absolute'
          overlay.style.inset = '0'
          overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.4)'
          overlay.style.zIndex = '0'
          card.appendChild(overlay)
        } else {
          card.style.background = 'linear-gradient(to bottom right, #dbeafe, #bfdbfe)'
        }

        const content = document.createElement('div')
        content.style.position = 'relative'
        content.style.zIndex = '10'
        content.style.padding = '24px'
        content.style.color = mainPhoto ? '#ffffff' : '#111827'
        content.style.height = '100%'
        content.style.display = 'flex'
        content.style.flexDirection = 'column'

        // Цена сверху по центру
        if (response.proposedPrice) {
          const priceBadge = document.createElement('div')
          priceBadge.style.position = 'absolute'
          priceBadge.style.top = '16px'
          priceBadge.style.left = '50%'
          priceBadge.style.transform = 'translateX(-50%)'
          priceBadge.style.backgroundColor = mainPhoto ? 'rgba(255, 255, 255, 0.95)' : '#2563eb'
          priceBadge.style.color = mainPhoto ? '#2563eb' : '#ffffff'
          priceBadge.style.padding = '8px 16px'
          priceBadge.style.borderRadius = '8px'
          priceBadge.style.fontWeight = 'bold'
          priceBadge.style.fontSize = '18px'
          priceBadge.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)'
          priceBadge.innerHTML = `
            <div style="font-size: 11px; margin-bottom: 2px;">Цена</div>
            <div>${response.proposedPrice.toLocaleString('ru-RU')} ₽</div>
          `
          content.appendChild(priceBadge)
        }

        // Название катера
        const title = document.createElement('h3')
        title.style.fontSize = '24px'
        title.style.fontWeight = 'bold'
        title.style.margin = response.proposedPrice ? '60px 0 16px 0' : '0 0 16px 0'
        title.style.color = mainPhoto ? '#ffffff' : '#111827'
        title.textContent = `${i + 1}. ${vessel?.name || 'Катер'}`
        content.appendChild(title)

        // Характеристики
        const specs = document.createElement('div')
        specs.style.fontSize = '14px'
        specs.style.marginBottom = '16px'
        specs.style.color = mainPhoto ? 'rgba(255, 255, 255, 0.9)' : '#4b5563'
        specs.innerHTML = `
          <div style="margin-bottom: 8px;">👥 Пассажировместимость: <strong>${vessel?.passengerCapacity || '-'} чел.</strong></div>
          ${vessel?.type ? `<div style="margin-bottom: 8px;">Тип: ${vessel.type}</div>` : ''}
          ${vessel?.length ? `<div style="margin-bottom: 8px;">Длина: ${vessel.length} м</div>` : ''}
          ${vessel?.width ? `<div style="margin-bottom: 8px;">Ширина: ${vessel.width} м</div>` : ''}
        `
        content.appendChild(specs)

        // Сообщение от владельца
        if (response.message) {
          const message = document.createElement('div')
          message.style.backgroundColor = mainPhoto ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.05)'
          message.style.padding = '12px'
          message.style.borderRadius = '8px'
          message.style.marginBottom = '16px'
          message.style.fontStyle = 'italic'
          message.style.fontSize = '13px'
          message.style.color = mainPhoto ? '#ffffff' : '#374151'
          message.textContent = `"${response.message}"`
          content.appendChild(message)
        }

        // Описание катера
        if (vessel?.technicalSpecs) {
          const description = document.createElement('div')
          description.style.fontSize = '13px'
          description.style.color = mainPhoto ? 'rgba(255, 255, 255, 0.9)' : '#6b7280'
          description.style.lineHeight = '1.6'
          description.style.flexGrow = '1'
          const shortSpecs = vessel.technicalSpecs.length > 200 
            ? `${vessel.technicalSpecs.substring(0, 200)}...` 
            : vessel.technicalSpecs
          description.textContent = shortSpecs
          content.appendChild(description)
        }

        card.appendChild(content)
        cardsContainer.appendChild(card)

        // Ждем загрузки изображения, если есть
        if (mainPhoto) {
          const img = new Image()
          const promise = new Promise<void>((resolve) => {
            img.onload = () => resolve()
            img.onerror = () => resolve() // Продолжаем даже если изображение не загрузилось
            img.src = mainPhoto
          })
          imagePromises.push(promise)
        }
      }

      // Ждем загрузки всех изображений
      await Promise.all(imagePromises)

      // Делаем скриншот всего контейнера
      const canvas = await html2canvas(container, {
        backgroundColor: '#f3f4f6',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
      })

      // Скачиваем изображение
      const link = document.createElement('a')
      link.download = `Предложения_${order.title.replace(/[^a-zа-яё0-9]/gi, '_')}_${format(new Date(), 'yyyy-MM-dd')}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()

      // Удаляем временный контейнер
      document.body.removeChild(container)
    } catch (error) {
      console.error('Ошибка генерации изображения:', error)
      alert('Ошибка при создании изображения с карточками катеров')
    }
  }

  const isOrderCreator = () => {
    const result = order?.createdById === user?.id
    console.log('[OrderResponses] isOrderCreator check:', {
      orderCreatedById: order?.createdById,
      userId: user?.id,
      result
    })
    return result
  }

  if (loading) {
    return <LoadingAnimation message="Загрузка откликов..." />
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <BackButton />
        <div className="text-center py-12">
          <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Заказ не найден</h2>
          <p className="text-gray-600 mb-4">{error || 'Заказ с указанным ID не найден'}</p>
        </div>
      </div>
    )
  }

  const responses = order.responses || []
  const selectedResponsesList = responses.filter((r: AgentOrderResponse) => 
    selectedResponses.has(r.id)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{order.title}</h1>
            <p className="mt-2 text-gray-600">Отклики на заказ</p>
          </div>
        </div>
        {isOrderCreator() && order.status === 'active' && (
          <button
            onClick={handleCancelOrder}
            disabled={cancelling}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <XCircle className="h-4 w-4 mr-2" />
            {cancelling ? 'Отмена...' : 'Отменить заказ'}
          </button>
        )}
      </div>

      {/* Информация о заказе */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        {order.description && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-700">{order.description}</p>
          </div>
        )}
      </div>

      {/* Кнопка отправки предложений */}
      {isOrderCreator() && selectedResponses.size > 0 && (
        <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Выбрано катеров: {selectedResponses.size}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Отправьте предложения клиенту через мессенджеры
              </p>
            </div>
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
            >
              <Send className="h-4 w-4 mr-2" />
              Отправить предложения
            </button>
          </div>
        </div>
      )}

      {/* Список откликов */}
      {responses.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Нет откликов</h3>
          <p className="text-gray-600">Пока нет откликов на этот заказ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {responses.map((response: AgentOrderResponse) => {
            const vessel = response.vessel
            const mainPhotoIndex = vessel?.mainPhotoIndex !== undefined && vessel?.mainPhotoIndex !== null 
              ? vessel.mainPhotoIndex 
              : 0
            const mainPhoto = vessel?.photos && vessel.photos.length > 0 
              ? vessel.photos[mainPhotoIndex] 
              : null
            const isSelected = selectedResponses.has(response.id)
            
            return (
              <div 
                key={response.id} 
                className={`relative rounded-lg shadow hover:shadow-lg transition-all overflow-hidden ${
                  isSelected 
                    ? 'border-2 border-primary-500 bg-primary-50' 
                    : 'border border-gray-200'
                }`}
                style={{
                  backgroundImage: mainPhoto ? `url(${mainPhoto})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: mainPhoto ? undefined : 'white',
                }}
              >
                {/* Затемнение для читаемости текста */}
                {mainPhoto && (
                  <div className="absolute inset-0 bg-black bg-opacity-40 z-0" />
                )}

                {/* Чекбокс выбора */}
                {isOrderCreator() && (
                  <div className="absolute top-2 left-2 z-20">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        console.log('[OrderResponses] Checkbox clicked for response:', response.id)
                        toggleResponseSelection(response.id)
                      }}
                      className={`p-2 rounded-full cursor-pointer ${
                        isSelected 
                          ? 'bg-primary-600 text-white hover:bg-primary-700' 
                          : 'bg-white text-gray-600 hover:bg-gray-100 border-2 border-gray-300'
                      } shadow-lg transition-colors`}
                      title={isSelected ? 'Снять выбор' : 'Выбрать катер'}
                    >
                      {isSelected ? (
                        <CheckSquare className="h-5 w-5" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                )}

                {/* Статус отклика */}
                <div className="absolute top-2 right-2 z-10">
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

                {/* Цена сверху по центру */}
                {response.proposedPrice && (
                  <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10">
                    <div className={`px-4 py-2 rounded-lg shadow-lg ${
                      mainPhoto 
                        ? 'bg-white bg-opacity-95' 
                        : 'bg-primary-600'
                    }`}>
                      <div className={`text-center ${mainPhoto ? 'text-primary-600' : 'text-white'}`}>
                        <div className="text-xs font-medium mb-0.5">Цена</div>
                        <div className={`text-xl font-bold ${mainPhoto ? 'text-primary-600' : 'text-white'}`}>
                          {response.proposedPrice.toLocaleString('ru-RU')} ₽
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className={`relative z-10 p-6 ${mainPhoto ? 'text-white' : 'text-gray-900'} ${response.proposedPrice ? 'pt-16' : ''}`}>
                  <div className="flex items-center mb-3">
                    <Ship className={`h-6 w-6 mr-2 ${mainPhoto ? 'text-white' : 'text-primary-600'}`} />
                    <h3 className={`text-xl font-semibold ${mainPhoto ? 'text-white' : 'text-gray-900'}`}>
                      {vessel?.name || 'Катер'}
                    </h3>
                  </div>

                  <div className={`space-y-2 text-sm ${mainPhoto ? 'text-white' : 'text-gray-600'}`}>
                    <div>
                      <span className="font-medium">Пассажировместимость: </span>
                      {vessel?.passengerCapacity || '-'} чел.
                    </div>
                  </div>

                  {vessel?.technicalSpecs && (
                    <div className={`mt-3 text-sm ${mainPhoto ? 'text-white' : 'text-gray-700'} line-clamp-2`}>
                      {vessel.technicalSpecs.length > 100 
                        ? `${vessel.technicalSpecs.substring(0, 100)}...` 
                        : vessel.technicalSpecs}
                    </div>
                  )}

                  {response.message && (
                    <div className={`mt-3 p-2 bg-white bg-opacity-20 rounded text-sm italic ${mainPhoto ? 'text-white' : 'text-gray-700'}`}>
                      "{response.message}"
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleViewVessel(vessel!)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        mainPhoto 
                          ? 'bg-white bg-opacity-20 text-white hover:bg-opacity-30' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Посмотреть
                    </button>
                    {isOrderCreator() && order.status === 'active' && response.status === 'pending' && (
                      <button
                        onClick={() => handleSelectVessel(response.id)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          mainPhoto 
                            ? 'bg-primary-600 text-white hover:bg-primary-700' 
                            : 'bg-primary-600 text-white hover:bg-primary-700'
                        }`}
                      >
                        Выбрать
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Модальное окно отправки предложений */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowShareModal(false)} />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <Share2 className="h-6 w-6 text-primary-600 mr-2" />
                    Отправить предложения клиенту
                  </h3>
                  <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-gray-500">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {selectedResponsesList.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">Выберите катеры для отправки</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-gray-700 mb-2">
                        Будет создано изображение с карточками всех выбранных катеров ({selectedResponsesList.length}).
                      </p>
                      <p className="text-xs text-gray-600">
                        В изображение будут включены: фотографии катеров, характеристики, предложенные цены и описания.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => generateVesselCardsImage(selectedResponsesList)}
                        className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium shadow-md"
                      >
                        <Download className="h-5 w-5 mr-2" />
                        Скачать изображение с карточками катеров
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

