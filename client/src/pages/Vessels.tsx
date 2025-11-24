import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { vesselsService, usersService } from '../services/api'
import { Vessel, UserRole } from '../types'
import { Ship, Plus, Trash2, Search, Download, X, EyeOff, Eye } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { LoadingAnimation } from '../components/LoadingAnimation'
import BackButton from '../components/BackButton'

export default function Vessels() {
  const { user } = useAuth()
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [hiding, setHiding] = useState<number | null>(null)
  const [restoring, setRestoring] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [showHiddenVessels, setShowHiddenVessels] = useState(false)
  const [addForm, setAddForm] = useState({
    name: '',
    type: '',
    length: '',
    width: '',
    heightAboveWaterline: '',
    passengerCapacity: '',
    registrationNumber: '',
    technicalSpecs: '',
    ownerId: '',
  })
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN

  useEffect(() => {
    loadVessels()
    if (isSuperAdmin) {
      loadUsers()
    }
  }, [isSuperAdmin, showHiddenVessels])

  const loadVessels = async () => {
    try {
      const response = await vesselsService.getAll({ limit: 100 })
      let vesselsData = response.data || []
      
      // Отладочная информация
      if (vesselsData.length > 0) {
        console.log('📊 Загружены катера:', vesselsData.map((v: Vessel) => ({
          id: v.id,
          name: v.name,
          passengerCapacity: v.passengerCapacity
        })))
      }
      
      // Фильтруем скрытые катера на фронтенде, если не включен показ скрытых
      if (!showHiddenVessels) {
        vesselsData = vesselsData.filter((v: Vessel) => v.isActive !== false)
      }
      
      // Сортируем: сначала активные, потом скрытые
      vesselsData.sort((a: Vessel, b: Vessel) => {
        if (a.isActive && !b.isActive) return -1
        if (!a.isActive && b.isActive) return 1
        return 0
      })
      
      setVessels(vesselsData)
    } catch (error) {
      console.error('Ошибка загрузки катеров:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      // Загружаем пользователей для будущего использования (например, выбор владельца катера)
      await usersService.getAll({ limit: 100 })
      // setUsers(response.data || []) // Пока не используется, но оставляем для будущего
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error)
    }
  }

  const handleOpenAdd = () => {
    // Проверяем роль Guest
    if (user?.role === UserRole.GUEST) {
      alert('Для добавления катера необходимо зарегистрироваться. Пожалуйста, зарегистрируйтесь как судовладелец.')
      return
    }
    
    setShowAddModal(true)
    setAddForm({
      name: '',
      type: '',
      length: '',
      width: '',
      heightAboveWaterline: '',
      passengerCapacity: '',
      registrationNumber: '',
      technicalSpecs: '',
      ownerId: user?.id?.toString() || '',
    })
    setError('')
  }

  const handleCloseAdd = () => {
    setShowAddModal(false)
    setAddForm({
      name: '',
      type: '',
      length: '',
      width: '',
      heightAboveWaterline: '',
      passengerCapacity: '',
      registrationNumber: '',
      technicalSpecs: '',
      ownerId: user?.id?.toString() || '',
    })
    setError('')
  }

  const handleCreate = async () => {
    if (!addForm.name || !addForm.type || !addForm.length || !addForm.width || !addForm.passengerCapacity) {
      setError('Заполните все обязательные поля: Название, Тип, Длина, Ширина, Пассажировместимость')
      return
    }

    setError('')
    setCreating(true)

    try {
      const createData: any = {
        name: addForm.name,
        type: addForm.type,
        length: parseFloat(addForm.length),
        width: parseFloat(addForm.width),
        heightAboveWaterline: addForm.heightAboveWaterline ? parseFloat(addForm.heightAboveWaterline) : null,
        passengerCapacity: parseInt(addForm.passengerCapacity, 10),
        registrationNumber: addForm.registrationNumber || null,
        technicalSpecs: addForm.technicalSpecs || null,
      }

      console.log('[Frontend] Отправка данных для создания катера:', createData);

      const createdVessel = await vesselsService.create(createData) as any
      console.log('[Frontend] Катер создан, получен ответ:', createdVessel);
      console.log('[Frontend] Пассажировместимость в ответе:', createdVessel?.passengerCapacity);
      
      await loadVessels()
      handleCloseAdd()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка создания катера')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (vesselId: number) => {
    // Первое подтверждение
    if (!confirm('Вы уверены, что хотите удалить этот катер?')) return

    // Второе подтверждение
    if (!confirm('ВНИМАНИЕ! Это действие необратимо. Данные будут удалены из базы данных. Продолжить?')) return

    setDeleting(true)

    try {
      await vesselsService.delete(vesselId)
      await loadVessels()
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка удаления катера')
    } finally {
      setDeleting(false)
    }
  }

  const handleHide = async (vesselId: number) => {
    if (!confirm('Вы уверены, что хотите скрыть этот катер?')) return

    setHiding(vesselId)
    try {
      await vesselsService.hide(vesselId)
      await loadVessels()
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка скрытия катера')
    } finally {
      setHiding(null)
    }
  }

  const handleRestore = async (vesselId: number) => {
    setRestoring(vesselId)
    try {
      await vesselsService.restore(vesselId)
      await loadVessels()
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка восстановления катера')
    } finally {
      setRestoring(null)
    }
  }

  // Проверяем, может ли пользователь редактировать/удалять катер
  const canManageVessel = (vessel: Vessel) => {
    if (isSuperAdmin) return true
    if (user?.role === UserRole.VESSEL_OWNER && vessel.ownerId === user.id) return true
    return false
  }

  const exportToExcel = async () => {
    try {
      // Загружаем все катера для экспорта
      const response = await vesselsService.getAll({ limit: 10000 })
      const allVessels = response.data || []

      // Подготавливаем данные для Excel
      const excelData = allVessels.map((vessel: Vessel) => {
        return {
          'ID': vessel.id,
          'Название': vessel.name || '',
          'Тип': vessel.type || '',
          'Длина (м)': vessel.length || 0,
          'Ширина (м)': vessel.width || '-',
          'Высота над ватерлинией (м)': vessel.heightAboveWaterline || '-',
          'Пассажировместимость': vessel.passengerCapacity || '-',
          'Регистрационный номер': vessel.registrationNumber || '-',
          'Владелец (Имя)': vessel.owner?.firstName || '-',
          'Владелец (Фамилия)': vessel.owner?.lastName || '-',
          'Email владельца': vessel.owner?.email || '-',
          'Телефон владельца': vessel.owner?.phone || '-',
          'Дата создания': vessel.createdAt ? format(new Date(vessel.createdAt), 'dd.MM.yyyy HH:mm') : '-',
          'Дата обновления': vessel.updatedAt ? format(new Date(vessel.updatedAt), 'dd.MM.yyyy HH:mm') : '-',
        }
      })

      // Создаем рабочую книгу Excel
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Катера')

      // Настраиваем ширину столбцов
      const columnWidths = [
        { wch: 8 },  // ID
        { wch: 25 }, // Название
        { wch: 20 }, // Тип
        { wch: 12 }, // Длина
        { wch: 12 }, // Ширина
        { wch: 25 }, // Высота над ватерлинией
        { wch: 20 }, // Регистрационный номер
        { wch: 15 }, // Владелец (Имя)
        { wch: 15 }, // Владелец (Фамилия)
        { wch: 25 }, // Email владельца
        { wch: 18 }, // Телефон владельца
        { wch: 20 }, // Дата создания
        { wch: 20 }, // Дата обновления
      ]
      worksheet['!cols'] = columnWidths

      // Генерируем имя файла с текущей датой
      const fileName = `Катера_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.xlsx`

      // Сохраняем файл
      XLSX.writeFile(workbook, fileName)
    } catch (error: any) {
      console.error('Ошибка экспорта в Excel:', error)
      alert('Ошибка экспорта данных в Excel')
    }
  }

  // Фильтрация судов по поисковому запросу
  const filteredVessels = vessels.filter((vessel) => {
    if (!searchTerm) return true
    
    const searchLower = searchTerm.toLowerCase().trim()
    
    // Поиск по названию катера
    const vesselName = vessel.name?.toLowerCase() || ''
    if (vesselName.includes(searchLower)) return true
    
    // Поиск по регистрационному номеру
    const registrationNumber = vessel.registrationNumber?.toLowerCase() || ''
    if (registrationNumber.includes(searchLower)) return true
    
    // Поиск по владельцу
    if (vessel.owner) {
      // Поиск по полному имени (имя + фамилия)
      const ownerFullName = `${vessel.owner.firstName || ''} ${vessel.owner.lastName || ''}`.toLowerCase().trim()
      if (ownerFullName.includes(searchLower)) return true
      
      // Поиск по имени отдельно
      const ownerFirstName = vessel.owner.firstName?.toLowerCase() || ''
      if (ownerFirstName.includes(searchLower)) return true
      
      // Поиск по фамилии отдельно
      const ownerLastName = vessel.owner.lastName?.toLowerCase() || ''
      if (ownerLastName.includes(searchLower)) return true
      
      // Поиск по телефону владельца
      const ownerPhone = vessel.owner.phone?.toLowerCase() || ''
      if (ownerPhone.includes(searchLower)) return true
    }
    
    return false
  })

  if (loading) {
    return <LoadingAnimation message="Загрузка катеров..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Катера</h1>
            <p className="mt-2 text-gray-600">Управление катерами</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowHiddenVessels(!showHiddenVessels)
            }}
            className="flex items-center px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700"
          >
            {showHiddenVessels ? (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Скрыть скрытые
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4 mr-1" />
                Показать скрытые
              </>
            )}
          </button>
          {isSuperAdmin && (
            <button
              onClick={exportToExcel}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              title="Экспортировать в Excel"
            >
              <Download className="h-5 w-5 mr-2" />
              Экспорт в Excel
            </button>
          )}
          <button
            onClick={handleOpenAdd}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            Добавить катер
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по названию, владельцу, рег. номеру или телефону..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredVessels.map((vessel) => (
          <div 
            key={vessel.id} 
            className={`rounded-lg shadow hover:shadow-lg transition-shadow p-6 relative overflow-hidden ${
              vessel.isActive === false ? 'opacity-60 border-2 border-gray-300' : ''
            }`}
            style={{
              backgroundImage: (() => {
                if (vessel.photos && vessel.photos.length > 0) {
                  const mainIndex = vessel.mainPhotoIndex !== undefined && vessel.mainPhotoIndex !== null 
                    ? vessel.mainPhotoIndex 
                    : 0
                  return `url(${vessel.photos[mainIndex]})`
                }
                return undefined
              })(),
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: (vessel.photos && vessel.photos.length > 0) ? undefined : 'white',
            }}
          >
            {/* Затемнение для читаемости текста */}
            {(vessel.photos && vessel.photos.length > 0) && (
              <div className="absolute inset-0 bg-black bg-opacity-40 z-0" />
            )}
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <Link
                  to={`/vessels/${vessel.id}`}
                  className="flex items-center flex-1 hover:text-primary-400 transition-colors"
                >
                  <Ship className={`h-8 w-8 mr-3 ${(vessel.photos && vessel.photos.length > 0) ? 'text-white' : 'text-primary-600'}`} />
                  <div className="flex-1">
                    <h3 className={`text-xl font-semibold ${(vessel.photos && vessel.photos.length > 0) ? 'text-white' : 'text-gray-900'}`}>
                      {vessel.name}
                      {vessel.isActive === false && (
                        <span className={`ml-2 text-xs px-2 py-1 rounded ${
                          (vessel.photos && vessel.photos.length > 0) ? 'bg-gray-800 bg-opacity-60 text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                          Скрыт
                        </span>
                      )}
                    </h3>
                  </div>
                </Link>
                {canManageVessel(vessel) && (
                  <div className="flex gap-1">
                    {vessel.isActive ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleHide(vessel.id)
                        }}
                        disabled={hiding === vessel.id}
                        className="p-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded disabled:opacity-50"
                        title="Скрыть катер"
                      >
                        <EyeOff className="h-5 w-5" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleRestore(vessel.id)
                        }}
                        disabled={restoring === vessel.id}
                        className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded disabled:opacity-50"
                        title="Восстановить катер"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDelete(vessel.id)
                      }}
                      disabled={deleting}
                      className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                      title="Удалить катер"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
              <Link to={`/vessels/${vessel.id}`} className="block">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className={(vessel.photos && vessel.photos.length > 0) ? 'text-gray-200' : 'text-gray-600'}>Тип:</span>
                      <span className={`font-semibold ${(vessel.photos && vessel.photos.length > 0) ? 'text-white' : 'text-gray-900'}`}>{vessel.type}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className={(vessel.photos && vessel.photos.length > 0) ? 'text-gray-200' : 'text-gray-600'}>Длина:</span>
                      <span className={`font-semibold ${(vessel.photos && vessel.photos.length > 0) ? 'text-white' : 'text-gray-900'}`}>{vessel.length} м</span>
                    </div>
                    {vessel.width && (
                      <div className="flex justify-between text-sm">
                        <span className={(vessel.photos && vessel.photos.length > 0) ? 'text-gray-200' : 'text-gray-600'}>Ширина:</span>
                        <span className={`font-semibold ${(vessel.photos && vessel.photos.length > 0) ? 'text-white' : 'text-gray-900'}`}>{vessel.width} м</span>
                      </div>
                    )}
                    {vessel.heightAboveWaterline && (
                      <div className="flex justify-between text-sm">
                        <span className={(vessel.photos && vessel.photos.length > 0) ? 'text-gray-200' : 'text-gray-600'}>Высота над ватерлинией:</span>
                        <span className={`font-semibold ${(vessel.photos && vessel.photos.length > 0) ? 'text-white' : 'text-gray-900'}`}>{vessel.heightAboveWaterline} м</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className={(vessel.photos && vessel.photos.length > 0) ? 'text-gray-200' : 'text-gray-600'}>Пассажировместимость:</span>
                      <span className={`font-semibold ${(vessel.photos && vessel.photos.length > 0) ? 'text-white' : 'text-gray-900'}`}>
                        {vessel.passengerCapacity !== undefined && vessel.passengerCapacity !== null 
                          ? `${vessel.passengerCapacity} чел.` 
                          : '- чел.'}
                      </span>
                    </div>
                    {vessel.registrationNumber && (
                      <div className="flex justify-between text-sm">
                        <span className={(vessel.photos && vessel.photos.length > 0) ? 'text-gray-200' : 'text-gray-600'}>Рег. номер:</span>
                        <span className={`font-semibold ${(vessel.photos && vessel.photos.length > 0) ? 'text-white' : 'text-gray-900'}`}>{vessel.registrationNumber}</span>
                      </div>
                    )}
                </div>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filteredVessels.length === 0 && vessels.length > 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Ship className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Катера по запросу "{searchTerm}" не найдены</p>
        </div>
      )}

      {vessels.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Ship className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Катера не найдены</p>
        </div>
      )}

      {/* Модальное окно создания катера */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={handleCloseAdd} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Создать новый катер</h3>
                  <button
                    onClick={handleCloseAdd}
                    className="text-gray-400 hover:text-gray-500"
                  >
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
                    <label htmlFor="add-name" className="block text-sm font-medium text-gray-700">
                      Название *
                    </label>
                    <input
                      id="add-name"
                      type="text"
                      required
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="add-type" className="block text-sm font-medium text-gray-700">
                      Тип *
                    </label>
                    <input
                      id="add-type"
                      type="text"
                      required
                      value={addForm.type}
                      onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      placeholder="Яхта, Катер, Лодка и т.д."
                    />
                  </div>

                  <div>
                    <label htmlFor="add-length" className="block text-sm font-medium text-gray-700">
                      Длина (м) *
                    </label>
                    <input
                      id="add-length"
                      type="number"
                      step="0.1"
                      required
                      value={addForm.length}
                      onChange={(e) => setAddForm({ ...addForm, length: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="add-width" className="block text-sm font-medium text-gray-700">
                      Ширина (м) *
                    </label>
                    <input
                      id="add-width"
                      type="number"
                      step="0.1"
                      required
                      value={addForm.width}
                      onChange={(e) => setAddForm({ ...addForm, width: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="add-height" className="block text-sm font-medium text-gray-700">
                      Высота над ватерлинией (м)
                    </label>
                    <input
                      id="add-height"
                      type="number"
                      step="0.1"
                      value={addForm.heightAboveWaterline}
                      onChange={(e) => setAddForm({ ...addForm, heightAboveWaterline: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="add-passengerCapacity" className="block text-sm font-medium text-gray-700">
                      Пассажировместимость *
                    </label>
                    <input
                      id="add-passengerCapacity"
                      type="number"
                      min="1"
                      required
                      value={addForm.passengerCapacity}
                      onChange={(e) => setAddForm({ ...addForm, passengerCapacity: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="add-registration" className="block text-sm font-medium text-gray-700">
                      Регистрационный номер
                    </label>
                    <input
                      id="add-registration"
                      type="text"
                      value={addForm.registrationNumber}
                      onChange={(e) => setAddForm({ ...addForm, registrationNumber: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="add-specs" className="block text-sm font-medium text-gray-700">
                      Технические характеристики
                    </label>
                    <textarea
                      id="add-specs"
                      rows={4}
                      value={addForm.technicalSpecs}
                      onChange={(e) => setAddForm({ ...addForm, technicalSpecs: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {creating ? 'Создание...' : 'Создать'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseAdd}
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
    </div>
  )
}

