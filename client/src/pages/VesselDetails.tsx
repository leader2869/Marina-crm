import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { vesselsService } from '../services/api'
import { Vessel } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { UserRole } from '../types'
import { Ship, ArrowLeft, User, Calendar, FileText, Edit2, X, Save } from 'lucide-react'
import { format } from 'date-fns'

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
    registrationNumber: '',
    technicalSpecs: '',
  })

  useEffect(() => {
    if (id) {
      loadVessel()
    }
  }, [id])

  const loadVessel = async () => {
    try {
      const data = (await vesselsService.getById(parseInt(id!))) as unknown as Vessel
      setVessel(data)
      if (data) {
        setEditForm({
          name: data.name,
          type: data.type,
          length: data.length.toString(),
          width: data.width?.toString() || '',
          heightAboveWaterline: data.heightAboveWaterline?.toString() || '',
          registrationNumber: data.registrationNumber || '',
          technicalSpecs: data.technicalSpecs || '',
        })
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

    setError('')
    setSaving(true)

    try {
      const updateData: any = {
        name: editForm.name,
        type: editForm.type,
        length: parseFloat(editForm.length),
        width: editForm.width ? parseFloat(editForm.width) : null,
        heightAboveWaterline: editForm.heightAboveWaterline ? parseFloat(editForm.heightAboveWaterline) : null,
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

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Загрузка...</p>
      </div>
    )
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
          <button
            onClick={() => navigate('/vessels')}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            title="Назад"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
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
        {editing && (
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
          {editing ? (
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
                  Ширина (м)
                </label>
                <input
                  id="edit-width"
                  type="number"
                  step="0.01"
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
                  Технические характеристики
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
              {vessel.width && (
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Ширина:</span>
                  <span className="font-semibold text-gray-900">{vessel.width} м</span>
                </div>
              )}
              {vessel.heightAboveWaterline && (
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Высота над ватерлинией:</span>
                  <span className="font-semibold text-gray-900">{vessel.heightAboveWaterline} м</span>
                </div>
              )}
              {vessel.registrationNumber && (
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Регистрационный номер:</span>
                  <span className="font-semibold text-gray-900">{vessel.registrationNumber}</span>
                </div>
              )}
              {vessel.technicalSpecs && (
                <div className="py-2 border-b border-gray-200">
                  <span className="text-gray-600 block mb-2">Технические характеристики:</span>
                  <p className="text-gray-900 whitespace-pre-wrap">{vessel.technicalSpecs}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Информация о владельце */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <User className="h-6 w-6 text-primary-600 mr-2" />
            Владелец
          </h2>
          {vessel.owner ? (
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Имя:</span>
                <span className="font-semibold text-gray-900">
                  {vessel.owner.firstName} {vessel.owner.lastName}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Email:</span>
                <span className="font-semibold text-gray-900">{vessel.owner.email}</span>
              </div>
              {vessel.owner.phone && (
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Телефон:</span>
                  <span className="font-semibold text-gray-900">{vessel.owner.phone}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600">Информация о владельце не загружена</p>
          )}
        </div>

        {/* Дополнительная информация */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Calendar className="h-6 w-6 text-primary-600 mr-2" />
            Дополнительная информация
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Дата регистрации:</span>
              <span className="font-semibold text-gray-900">
                {format(new Date(vessel.createdAt), 'dd.MM.yyyy')}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Последнее обновление:</span>
              <span className="font-semibold text-gray-900">
                {format(new Date(vessel.updatedAt), 'dd.MM.yyyy HH:mm')}
              </span>
            </div>
          </div>
        </div>

        {/* Документы и фото */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <FileText className="h-6 w-6 text-primary-600 mr-2" />
            Документы и фото
          </h2>
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
            {vessel.photo && (
              <div className="py-2">
                <span className="text-gray-600 block mb-2">Фото судна:</span>
                <div className="mt-2">
                  <img
                    src={vessel.photo}
                    alt={vessel.name}
                    className="w-full h-64 object-cover rounded-lg border border-gray-200"
                  />
                </div>
              </div>
            )}
            {!vessel.documentPath && !vessel.photo && (
              <p className="text-gray-600">Документы и фото не загружены</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

