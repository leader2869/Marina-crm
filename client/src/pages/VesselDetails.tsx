import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { vesselsService } from '../services/api'
import { Vessel } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { UserRole } from '../types'
import { Ship, Edit2, X, Save, Upload, Image as ImageIcon } from 'lucide-react'
import { LoadingAnimation } from '../components/LoadingAnimation'
import BackButton from '../components/BackButton'

export default function VesselDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [vessel, setVessel] = useState<Vessel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    type: '',
    length: '',
    width: '',
    heightAboveWaterline: '',
    passengerCapacity: '',
    registrationNumber: '',
    technicalSpecs: '',
  })
  const [photos, setPhotos] = useState<string[]>([])
  const [mainPhotoIndex, setMainPhotoIndex] = useState<number | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    if (id) {
      loadVessel()
    }
  }, [id])

  // Автоматически отключаем режим редактирования, если пользователь не может редактировать
  useEffect(() => {
    if (vessel && user && editing) {
      const canEditVessel = 
        user.role === UserRole.SUPER_ADMIN ||
        user.role === UserRole.ADMIN ||
        vessel.ownerId === user.id
      if (!canEditVessel) {
        setEditing(false)
      }
    }
  }, [vessel, user, editing])

  const loadVessel = async () => {
    try {
      const data = (await vesselsService.getById(parseInt(id!))) as unknown as Vessel
      console.log('Загруженные данные судна:', {
        id: data?.id,
        photosCount: data?.photos?.length || 0,
        mainPhotoIndex: data?.mainPhotoIndex,
        photos: data?.photos ? 'есть' : 'нет'
      })
      setVessel(data)
      if (data) {
        setEditForm({
          name: data.name,
          type: data.type,
          length: data.length.toString(),
          width: data.width?.toString() || '',
          heightAboveWaterline: data.heightAboveWaterline?.toString() || '',
          passengerCapacity: data.passengerCapacity?.toString() || '',
          registrationNumber: data.registrationNumber || '',
          technicalSpecs: data.technicalSpecs || '',
        })
        // Убеждаемся, что главное фото всегда на первом месте
        let loadedPhotos = data.photos || []
        let loadedMainPhotoIndex = data.mainPhotoIndex !== undefined && data.mainPhotoIndex !== null ? data.mainPhotoIndex : 0
        
        // Если главное фото не на первом месте, перемещаем его
        if (loadedMainPhotoIndex > 0 && loadedPhotos.length > loadedMainPhotoIndex) {
          const mainPhoto = loadedPhotos[loadedMainPhotoIndex]
          // Удаляем главное фото из текущей позиции
          loadedPhotos = loadedPhotos.filter((_, index) => index !== loadedMainPhotoIndex)
          // Вставляем на первое место
          loadedPhotos.unshift(mainPhoto)
          loadedMainPhotoIndex = 0
          
          // Обновляем на сервере, чтобы сохранить правильный порядок
          if (data.id) {
            try {
              await vesselsService.update(data.id, {
                photos: loadedPhotos,
                mainPhotoIndex: 0
              })
            } catch (err) {
              console.error('Ошибка обновления порядка фотографий:', err)
              // Продолжаем работу даже если не удалось обновить
            }
          }
        }
        
        console.log('Установка фотографий:', loadedPhotos.length)
        setPhotos(loadedPhotos)
        setMainPhotoIndex(loadedMainPhotoIndex)
        
        // Если пользователь не может редактировать, отключаем режим редактирования
        if (data && user) {
          const canEditVessel = 
            user.role === UserRole.SUPER_ADMIN ||
            user.role === UserRole.ADMIN ||
            data.ownerId === user.id
          if (!canEditVessel) {
            setEditing(false)
          }
        }
      }
    } catch (error: any) {
      console.error('Ошибка загрузки судна:', error)
      setError(error.error || error.message || 'Ошибка загрузки судна')
    } finally {
      setLoading(false)
    }
  }

  const canEdit = () => {
    if (!user || !vessel) return false
    return (
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      vessel.ownerId === user.id
    )
  }



  const handleSave = async () => {
    if (!vessel) return

    if (!editForm.name || !editForm.type || !editForm.length || !editForm.width || !editForm.passengerCapacity) {
      setError('Заполните все обязательные поля: Название, Тип, Длина, Ширина, Пассажировместимость')
      return
    }

    setError('')
    setSaving(true)

    try {
      const updateData: any = {
        name: editForm.name,
        type: editForm.type,
        length: parseFloat(editForm.length),
        width: parseFloat(editForm.width),
        heightAboveWaterline: editForm.heightAboveWaterline ? parseFloat(editForm.heightAboveWaterline) : null,
        passengerCapacity: parseInt(editForm.passengerCapacity),
        registrationNumber: editForm.registrationNumber || null,
        technicalSpecs: editForm.technicalSpecs || null,
      }

      await vesselsService.update(vessel.id, updateData)
      await loadVessel()
      setEditing(false)
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка обновления судна')
    } finally {
      setSaving(false)
    }
  }

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Проверяем тип файла
      if (!file.type.startsWith('image/')) {
        reject(new Error('Файл должен быть изображением'))
        return
      }
      
      // Сжимаем изображение перед конвертацией в base64
      const reader = new FileReader()
      reader.onloadend = () => {
        const img = new Image()
        img.onload = () => {
          // Создаем canvas для сжатия
          const canvas = document.createElement('canvas')
          const maxWidth = 1200
          const maxHeight = 1200
          let width = img.width
          let height = img.height
          
          // Вычисляем новые размеры с сохранением пропорций
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width
              width = maxWidth
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height
              height = maxHeight
            }
          }
          
          canvas.width = width
          canvas.height = height
          
          // Рисуем сжатое изображение
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height)
            // Конвертируем в base64 с качеством 0.8 (80%)
            const base64String = canvas.toDataURL('image/jpeg', 0.8)
            resolve(base64String)
          } else {
            reject(new Error('Не удалось создать контекст canvas'))
          }
        }
        img.onerror = () => {
          reject(new Error('Ошибка загрузки изображения'))
        }
        img.src = reader.result as string
      }
      reader.onerror = () => {
        reject(new Error('Ошибка чтения файла'))
      }
      reader.readAsDataURL(file)
    })
  }

  const handlePhotoUpload = async (newPhotos: string[]) => {
    if (!vessel) return

    setError('')
    setUploadingPhoto(true)

    try {
      // Если это первое фото, делаем его главным
      const newMainPhotoIndex = photos.length === 0 && newPhotos.length > 0 ? 0 : mainPhotoIndex
      
      console.log('Загрузка фотографий:', { 
        vesselId: vessel.id, 
        photosCount: newPhotos.length, 
        mainPhotoIndex: newMainPhotoIndex 
      })
      
      const updatedVessel = (await vesselsService.update(vessel.id, { 
        photos: newPhotos,
        mainPhotoIndex: newMainPhotoIndex
      })) as unknown as Vessel
      
      console.log('Ответ от сервера:', updatedVessel)
      
      // Обновляем состояние на основе ответа сервера
      if (updatedVessel && updatedVessel.photos) {
        console.log('Обновление состояния из ответа сервера:', updatedVessel.photos.length)
        setPhotos(updatedVessel.photos)
        setMainPhotoIndex(updatedVessel.mainPhotoIndex !== undefined ? updatedVessel.mainPhotoIndex : null)
      } else {
        // Если ответ не содержит photos, обновляем из локального состояния
        console.log('Обновление состояния из локальных данных')
        setPhotos(newPhotos)
        if (newMainPhotoIndex !== null && newMainPhotoIndex !== mainPhotoIndex) {
          setMainPhotoIndex(newMainPhotoIndex)
        }
      }
      
      // Обновляем vessel для синхронизации
      if (updatedVessel && updatedVessel.id) {
        setVessel(updatedVessel)
      } else {
        // Перезагружаем данные с сервера для синхронизации
        await loadVessel()
      }
    } catch (err: any) {
      console.error('Ошибка загрузки фотографий:', err)
      setError(err.error || err.message || 'Ошибка загрузки фотографии')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handlePhotoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Проверяем количество фотографий
    if (photos.length + files.length > 7) {
      setError(`Можно загрузить максимум 7 фотографий. У вас уже ${photos.length} фото.`)
      e.target.value = ''
      return
    }

    setError('')
    setUploadingPhoto(true)

    try {
      const newPhotos: string[] = [...photos]
      
      console.log('Начало обработки файлов:', files.length)
      
      // Обрабатываем все выбранные файлы
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          console.log(`Обработка файла ${i + 1}/${files.length}:`, file.name)
          const compressed = await compressImage(file)
          newPhotos.push(compressed)
          console.log(`Файл ${i + 1} обработан, размер base64:`, compressed.length)
        } catch (err: any) {
          console.error('Ошибка обработки изображения:', err)
          setError(err.message || 'Ошибка обработки изображения')
          e.target.value = ''
          setUploadingPhoto(false)
          return
        }
      }

      console.log('Все файлы обработаны, всего фото:', newPhotos.length)
      await handlePhotoUpload(newPhotos)
    } catch (err: any) {
      console.error('Ошибка загрузки фотографий:', err)
      setError(err.error || err.message || 'Ошибка загрузки фотографий')
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  const handleDeletePhoto = async (index: number) => {
    if (!vessel) return

    if (!window.confirm('Вы уверены, что хотите удалить эту фотографию?')) {
      return
    }

    setError('')
    setUploadingPhoto(true)

    try {
      const newPhotos = photos.filter((_, i) => i !== index)
      let newMainPhotoIndex = mainPhotoIndex

      // Если удаляем главное фото, выбираем первое как главное
      if (mainPhotoIndex === index) {
        newMainPhotoIndex = newPhotos.length > 0 ? 0 : null
      } else if (mainPhotoIndex !== null && mainPhotoIndex > index) {
        // Если удаляем фото перед главным, уменьшаем индекс главного
        newMainPhotoIndex = mainPhotoIndex - 1
      }

      await vesselsService.update(vessel.id, { 
        photos: newPhotos,
        mainPhotoIndex: newMainPhotoIndex
      })
      await loadVessel()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка удаления фотографии')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSetMainPhoto = async (index: number) => {
    if (!vessel || mainPhotoIndex === index) return

    setError('')
    setUploadingPhoto(true)

    try {
      // Перемещаем выбранное фото на первое место в массиве
      const newPhotos = [...photos]
      const selectedPhoto = newPhotos[index]
      
      // Удаляем фото из текущей позиции
      newPhotos.splice(index, 1)
      // Вставляем на первое место
      newPhotos.unshift(selectedPhoto)
      
      // Теперь главное фото всегда на позиции 0
      await vesselsService.update(vessel.id, { 
        photos: newPhotos,
        mainPhotoIndex: 0
      })
      await loadVessel()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка установки главного фото')
    } finally {
      setUploadingPhoto(false)
    }
  }

  if (loading) {
    return <LoadingAnimation message="Загрузка данных судна..." />
  }

  if (error || !vessel) {
    return (
      <div className="text-center py-12">
        <Ship className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Судно не найдено</h2>
        <p className="text-gray-600 mb-4">{error || 'Судно с указанным ID не найдено'}</p>
        <button
          onClick={() => navigate('/vessels')}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Вернуться к списку судов
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{vessel.name}</h1>
            <p className="mt-2 text-gray-600">Полная информация о судне</p>
          </div>
        </div>
        {canEdit() && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Edit2 className="h-5 w-5 mr-2" />
            Редактировать
          </button>
        )}
        {editing && canEdit() && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setEditing(false)
                loadVessel()
              }}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <X className="h-5 w-5 mr-2" />
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <Save className="h-5 w-5 mr-2" />
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Основная информация */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Ship className="h-6 w-6 text-primary-600 mr-2" />
            Основная информация
          </h2>
          {editing && canEdit() ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Название *
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label htmlFor="edit-type" className="block text-sm font-medium text-gray-700 mb-1">
                  Тип *
                </label>
                <input
                  id="edit-type"
                  type="text"
                  required
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label htmlFor="edit-length" className="block text-sm font-medium text-gray-700 mb-1">
                  Длина (м) *
                </label>
                <input
                  id="edit-length"
                  type="number"
                  step="0.01"
                  required
                  value={editForm.length}
                  onChange={(e) => setEditForm({ ...editForm, length: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label htmlFor="edit-width" className="block text-sm font-medium text-gray-700 mb-1">
                  Ширина (м) *
                </label>
                <input
                  id="edit-width"
                  type="number"
                  step="0.01"
                  required
                  value={editForm.width}
                  onChange={(e) => setEditForm({ ...editForm, width: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label htmlFor="edit-heightAboveWaterline" className="block text-sm font-medium text-gray-700 mb-1">
                  Высота над ватерлинией (м)
                </label>
                <input
                  id="edit-heightAboveWaterline"
                  type="number"
                  step="0.01"
                  value={editForm.heightAboveWaterline}
                  onChange={(e) => setEditForm({ ...editForm, heightAboveWaterline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label htmlFor="edit-passengerCapacity" className="block text-sm font-medium text-gray-700 mb-1">
                  Пассажировместимость *
                </label>
                <input
                  id="edit-passengerCapacity"
                  type="number"
                  min="1"
                  required
                  value={editForm.passengerCapacity}
                  onChange={(e) => setEditForm({ ...editForm, passengerCapacity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label htmlFor="edit-registrationNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Регистрационный номер
                </label>
                <input
                  id="edit-registrationNumber"
                  type="text"
                  value={editForm.registrationNumber}
                  onChange={(e) => setEditForm({ ...editForm, registrationNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label htmlFor="edit-technicalSpecs" className="block text-sm font-medium text-gray-700 mb-1">
                  Описание катера
                </label>
                <textarea
                  id="edit-technicalSpecs"
                  rows={4}
                  value={editForm.technicalSpecs}
                  onChange={(e) => setEditForm({ ...editForm, technicalSpecs: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Название:</span>
                <span className="font-semibold text-gray-900">{vessel.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Тип:</span>
                <span className="font-semibold text-gray-900">{vessel.type}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Длина:</span>
                <span className="font-semibold text-gray-900">{vessel.length} м</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Ширина *:</span>
                <span className="font-semibold text-gray-900">{vessel.width} м</span>
              </div>
              {vessel.heightAboveWaterline && (
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Высота над ватерлинией:</span>
                  <span className="font-semibold text-gray-900">{vessel.heightAboveWaterline} м</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Пассажировместимость:</span>
                <span className="font-semibold text-gray-900">{vessel.passengerCapacity} чел.</span>
              </div>
              {vessel.registrationNumber && (
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Регистрационный номер:</span>
                  <span className="font-semibold text-gray-900">{vessel.registrationNumber}</span>
                </div>
              )}
              {vessel.technicalSpecs && (
                <div className="py-2 border-b border-gray-200">
                  <span className="text-gray-600 block mb-2">Описание катера:</span>
                  <p className="text-gray-900 whitespace-pre-wrap">{vessel.technicalSpecs}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Фотографии катера */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <ImageIcon className="h-6 w-6 text-primary-600 mr-2" />
              Фотографии катера
            </h2>
            {canEdit() && (
              <label className="flex items-center px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50">
                <Upload className="h-4 w-4 mr-1.5" />
                {uploadingPhoto ? 'Загрузка...' : `Загрузить фото (${photos.length}/7)`}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoFileSelect}
                  disabled={uploadingPhoto || photos.length >= 7}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div className="space-y-4">
            {vessel.documentPath && (
              <div className="py-2 border-b border-gray-200">
                <span className="text-gray-600 block mb-2">Документы:</span>
                <a
                  href={vessel.documentPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Открыть документы →
                </a>
              </div>
            )}
            {photos.length > 0 && (
              <div className="py-2">
                <span className="text-gray-600 block mb-2">
                  Фотографии катера ({photos.length}/7):
                </span>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={photo}
                        alt={`${vessel.name} - фото ${index + 1}`}
                        className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
                        style={{
                          borderColor: mainPhotoIndex === index ? '#2563eb' : undefined,
                          borderWidth: mainPhotoIndex === index ? '3px' : '2px',
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                        }}
                      />
                      {mainPhotoIndex === index && (
                        <div className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold">
                          Главное
                        </div>
                      )}
                      {canEdit() && (
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          {mainPhotoIndex !== index && (
                            <button
                              onClick={() => handleSetMainPhoto(index)}
                              disabled={uploadingPhoto}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                              title="Сделать главным"
                            >
                              Главное
                            </button>
                          )}
                          <button
                            onClick={() => handleDeletePhoto(index)}
                            disabled={uploadingPhoto}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
                            title="Удалить"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Главное фото будет отображаться как фон карточки катера в списке катеров
                </p>
              </div>
            )}
            {!vessel.documentPath && photos.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 mb-2">Фотографии катера не загружены</p>
                {canEdit() && (
                  <p className="text-sm text-gray-500">Нажмите "Загрузить фото" для добавления фотографий (максимум 7)</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

