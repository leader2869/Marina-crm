import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { clubsService, berthsService } from '../services/api'
import { Club, Berth } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { UserRole } from '../types'
import { MapPin, Phone, Mail, Globe, Anchor, Edit2, X, Plus, Trash2 } from 'lucide-react'

export default function ClubDetails() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [club, setClub] = useState<Club | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    address: '',
    latitude: '',
    longitude: '',
    phone: '',
    email: '',
    website: '',
    minRentalPeriod: '',
    maxRentalPeriod: '',
    basePrice: '',
    minPricePerMonth: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showAddBerthModal, setShowAddBerthModal] = useState(false)
  const [showEditBerthModal, setShowEditBerthModal] = useState(false)
  const [selectedBerth, setSelectedBerth] = useState<Berth | null>(null)
  const [berthForm, setBerthForm] = useState({
    number: '',
    length: '',
    width: '',
    pricePerDay: '',
    notes: '',
  })
  const [savingBerth, setSavingBerth] = useState(false)
  const [deletingBerth, setDeletingBerth] = useState(false)

  useEffect(() => {
    if (id) {
      loadClub()
    }
  }, [id])

  const loadClub = async () => {
    try {
      const data = (await clubsService.getById(parseInt(id!))) as unknown as Club
      setClub(data)
      if (data) {
        setEditForm({
          name: data.name,
          description: data.description || '',
          address: data.address,
          latitude: data.latitude.toString(),
          longitude: data.longitude.toString(),
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          minRentalPeriod: data.minRentalPeriod.toString(),
          maxRentalPeriod: data.maxRentalPeriod.toString(),
          basePrice: data.basePrice.toString(),
          minPricePerMonth: data.minPricePerMonth?.toString() || '',
        })
      }
    } catch (error) {
      console.error('Ошибка загрузки клуба:', error)
    } finally {
      setLoading(false)
    }
  }

  const canEdit = () => {
    if (!user || !club) return false
    return (
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.CLUB_OWNER && club.ownerId === user.id)
    )
  }

  const canManageBerths = () => {
    if (!user || !club) return false
    return (
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.CLUB_OWNER && club.ownerId === user.id)
    )
  }

  const handleOpenAddBerth = () => {
    setBerthForm({
      number: '',
      length: '20',
      width: '5',
      pricePerDay: club?.basePrice?.toString() || '',
      notes: '',
    })
    setShowAddBerthModal(true)
  }

  const handleOpenEditBerth = (berth: Berth) => {
    setSelectedBerth(berth)
    setBerthForm({
      number: berth.number,
      length: berth.length.toString(),
      width: berth.width.toString(),
      pricePerDay: berth.pricePerDay?.toString() || '',
      notes: berth.notes || '',
    })
    setShowEditBerthModal(true)
  }

  const handleCloseBerthModal = () => {
    setShowAddBerthModal(false)
    setShowEditBerthModal(false)
    setSelectedBerth(null)
    setBerthForm({
      number: '',
      length: '20',
      width: '5',
      pricePerDay: '',
      notes: '',
    })
  }

  const handleCreateBerth = async () => {
    if (!club) return

    setSavingBerth(true)
    setError('')

    try {
      await berthsService.create({
        clubId: club.id,
        number: berthForm.number,
        length: parseFloat(berthForm.length),
        width: parseFloat(berthForm.width),
        pricePerDay: berthForm.pricePerDay ? parseFloat(berthForm.pricePerDay) : null,
        notes: berthForm.notes || null,
      })

      await loadClub()
      handleCloseBerthModal()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка создания места')
    } finally {
      setSavingBerth(false)
    }
  }

  const handleUpdateBerth = async () => {
    if (!selectedBerth) return

    setSavingBerth(true)
    setError('')

    try {
      await berthsService.update(selectedBerth.id, {
        number: berthForm.number,
        length: parseFloat(berthForm.length),
        width: parseFloat(berthForm.width),
        pricePerDay: berthForm.pricePerDay ? parseFloat(berthForm.pricePerDay) : null,
        notes: berthForm.notes || null,
      })

      await loadClub()
      handleCloseBerthModal()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка обновления места')
    } finally {
      setSavingBerth(false)
    }
  }

  const handleDeleteBerth = async (berthId: number) => {
    if (!confirm('Вы уверены, что хотите удалить это место?')) return

    setDeletingBerth(true)
    setError('')

    try {
      await berthsService.delete(berthId)
      await loadClub()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка удаления места')
    } finally {
      setDeletingBerth(false)
    }
  }

  const handleSave = async () => {
    if (!club) return

    setError('')
    setSaving(true)

    try {
      const updateData = {
        name: editForm.name,
        description: editForm.description || null,
        address: editForm.address,
        latitude: parseFloat(editForm.latitude),
        longitude: parseFloat(editForm.longitude),
        phone: editForm.phone || null,
        email: editForm.email || null,
        website: editForm.website || null,
        minRentalPeriod: parseInt(editForm.minRentalPeriod),
        maxRentalPeriod: parseInt(editForm.maxRentalPeriod),
        basePrice: parseFloat(editForm.basePrice),
        minPricePerMonth: editForm.minPricePerMonth ? parseFloat(editForm.minPricePerMonth) : null,
      }

      await clubsService.update(club.id, updateData)
      await loadClub()
      setEditing(false)
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка обновления клуба')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>
  }

  if (!club) {
    return <div className="text-center py-12">Клуб не найден</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{club.name}</h1>
          {club.description && <p className="mt-2 text-gray-600">{club.description}</p>}
        </div>
        {canEdit() && (
          <button
            onClick={() => setEditing(!editing)}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Edit2 className="h-5 w-5 mr-2" />
            {editing ? 'Отмена' : 'Редактировать'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {editing ? (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Редактирование яхт-клуба</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">
                  Название *
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-address" className="block text-sm font-medium text-gray-700">
                  Адрес *
                </label>
                <input
                  id="edit-address"
                  type="text"
                  required
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-latitude" className="block text-sm font-medium text-gray-700">
                  Широта *
                </label>
                <input
                  id="edit-latitude"
                  type="number"
                  step="any"
                  required
                  value={editForm.latitude}
                  onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-longitude" className="block text-sm font-medium text-gray-700">
                  Долгота *
                </label>
                <input
                  id="edit-longitude"
                  type="number"
                  step="any"
                  required
                  value={editForm.longitude}
                  onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-phone" className="block text-sm font-medium text-gray-700">
                  Телефон
                </label>
                <input
                  id="edit-phone"
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-website" className="block text-sm font-medium text-gray-700">
                  Веб-сайт
                </label>
                <input
                  id="edit-website"
                  type="url"
                  value={editForm.website}
                  onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-basePrice" className="block text-sm font-medium text-gray-700">
                  Базовая цена за день *
                </label>
                <input
                  id="edit-basePrice"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={editForm.basePrice}
                  onChange={(e) => setEditForm({ ...editForm, basePrice: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-minPricePerMonth" className="block text-sm font-medium text-gray-700">
                  Минимальная цена за месяц
                </label>
                <input
                  id="edit-minPricePerMonth"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.minPricePerMonth}
                  onChange={(e) => setEditForm({ ...editForm, minPricePerMonth: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-minRentalPeriod" className="block text-sm font-medium text-gray-700">
                  Минимальный период аренды (дней) *
                </label>
                <input
                  id="edit-minRentalPeriod"
                  type="number"
                  required
                  min="1"
                  value={editForm.minRentalPeriod}
                  onChange={(e) => setEditForm({ ...editForm, minRentalPeriod: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-maxRentalPeriod" className="block text-sm font-medium text-gray-700">
                  Максимальный период аренды (дней) *
                </label>
                <input
                  id="edit-maxRentalPeriod"
                  type="number"
                  required
                  min="1"
                  value={editForm.maxRentalPeriod}
                  onChange={(e) => setEditForm({ ...editForm, maxRentalPeriod: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700">
                Описание
              </label>
              <textarea
                id="edit-description"
                rows={4}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setError('')
                  if (club) {
                    setEditForm({
                      name: club.name,
                      description: club.description || '',
                      address: club.address,
                      latitude: club.latitude.toString(),
                      longitude: club.longitude.toString(),
                      phone: club.phone || '',
                      email: club.email || '',
                      website: club.website || '',
                      minRentalPeriod: club.minRentalPeriod.toString(),
                      maxRentalPeriod: club.maxRentalPeriod.toString(),
                      basePrice: club.basePrice.toString(),
                      minPricePerMonth: club.minPricePerMonth?.toString() || '',
                    })
                  }
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Информация</h2>
            <div className="space-y-3">
              <div className="flex items-center">
                <MapPin className="h-5 w-5 text-gray-400 mr-3" />
                <span className="text-gray-700">{club.address}</span>
              </div>
              {club.phone && (
                <div className="flex items-center">
                  <Phone className="h-5 w-5 text-gray-400 mr-3" />
                  <span className="text-gray-700">{club.phone}</span>
                </div>
              )}
              {club.email && (
                <div className="flex items-center">
                  <Mail className="h-5 w-5 text-gray-400 mr-3" />
                  <span className="text-gray-700">{club.email}</span>
                </div>
              )}
              {club.website && (
                <div className="flex items-center">
                  <Globe className="h-5 w-5 text-gray-400 mr-3" />
                  <a href={club.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                    {club.website}
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Характеристики</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Всего мест:</span>
                <span className="font-semibold">{club.totalBerths}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Базовая цена за день:</span>
                <span className="font-semibold text-primary-600">
                  {club.basePrice.toLocaleString()} ₽
                </span>
              </div>
              {club.minPricePerMonth && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Минимальная цена за месяц:</span>
                  <span className="font-semibold text-primary-600">
                    {club.minPricePerMonth.toLocaleString()} ₽
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Минимальный период аренды:</span>
                <span className="font-semibold">{club.minRentalPeriod} дней</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Максимальный период аренды:</span>
                <span className="font-semibold">{club.maxRentalPeriod} дней</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {club.latitude && club.longitude && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Расположение</h2>
          <div className="w-full h-96 rounded-lg overflow-hidden border border-gray-200">
            <iframe
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${parseFloat(club.latitude.toString())},${parseFloat(club.longitude.toString())}&hl=ru&z=15&output=embed`}
              title={`Карта расположения ${club.name}`}
            />
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2" />
            <span>{club.address}</span>
          </div>
          <div className="mt-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${parseFloat(club.latitude.toString())},${parseFloat(club.longitude.toString())}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              Открыть в Google Maps →
            </a>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Места</h2>
          {canManageBerths() && (
            <button
              onClick={handleOpenAddBerth}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Plus className="h-5 w-5 mr-2" />
              Добавить место
            </button>
          )}
        </div>

        {club.berths && club.berths.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {club.berths.map((berth) => (
              <div key={berth.id} className="border border-gray-200 rounded-lg p-4 relative">
                {canManageBerths() && (
                  <div className="absolute top-2 right-2 flex space-x-2">
                    <button
                      onClick={() => handleOpenEditBerth(berth)}
                      className="p-1 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded"
                      title="Редактировать"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBerth(berth.id)}
                      disabled={deletingBerth}
                      className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div className="flex items-center mb-2">
                  <Anchor className="h-5 w-5 text-primary-600 mr-2" />
                  <span className="font-semibold">{berth.number}</span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Длина: {berth.length} м</div>
                  <div>Ширина: {berth.width} м</div>
                  {berth.pricePerDay && (
                    <div className="text-primary-600 font-semibold">
                      {berth.pricePerDay.toLocaleString()} ₽/день
                    </div>
                  )}
                  <div className={`mt-2 ${berth.isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                    {berth.isAvailable ? 'Доступен' : 'Занят'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Anchor className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Места не добавлены</p>
            {canManageBerths() && (
              <button
                onClick={handleOpenAddBerth}
                className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
              >
                Добавить первое место
              </button>
            )}
          </div>
        )}
      </div>

      {/* Модальное окно добавления места */}
      {showAddBerthModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={handleCloseBerthModal}></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Добавить место</h3>
                  <button
                    onClick={handleCloseBerthModal}
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
                    <label htmlFor="berth-number" className="block text-sm font-medium text-gray-700">
                      Номер места *
                    </label>
                    <input
                      id="berth-number"
                      type="text"
                      required
                      value={berthForm.number}
                      onChange={(e) => setBerthForm({ ...berthForm, number: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      placeholder="Место 1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="berth-length" className="block text-sm font-medium text-gray-700">
                        Длина (м) *
                      </label>
                      <input
                        id="berth-length"
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={berthForm.length}
                        onChange={(e) => setBerthForm({ ...berthForm, length: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="berth-width" className="block text-sm font-medium text-gray-700">
                        Ширина (м) *
                      </label>
                      <input
                        id="berth-width"
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={berthForm.width}
                        onChange={(e) => setBerthForm({ ...berthForm, width: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="berth-price" className="block text-sm font-medium text-gray-700">
                      Цена за день (₽)
                    </label>
                    <input
                      id="berth-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={berthForm.pricePerDay}
                      onChange={(e) => setBerthForm({ ...berthForm, pricePerDay: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      placeholder={club?.basePrice?.toString() || '0'}
                    />
                  </div>

                  <div>
                    <label htmlFor="berth-notes" className="block text-sm font-medium text-gray-700">
                      Примечания
                    </label>
                    <textarea
                      id="berth-notes"
                      rows={3}
                      value={berthForm.notes}
                      onChange={(e) => setBerthForm({ ...berthForm, notes: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleCreateBerth}
                  disabled={savingBerth}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {savingBerth ? 'Создание...' : 'Создать'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseBerthModal}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования места */}
      {showEditBerthModal && selectedBerth && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={handleCloseBerthModal}></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Редактировать место</h3>
                  <button
                    onClick={handleCloseBerthModal}
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
                    <label htmlFor="edit-berth-number" className="block text-sm font-medium text-gray-700">
                      Номер места *
                    </label>
                    <input
                      id="edit-berth-number"
                      type="text"
                      required
                      value={berthForm.number}
                      onChange={(e) => setBerthForm({ ...berthForm, number: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="edit-berth-length" className="block text-sm font-medium text-gray-700">
                        Длина (м) *
                      </label>
                      <input
                        id="edit-berth-length"
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={berthForm.length}
                        onChange={(e) => setBerthForm({ ...berthForm, length: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="edit-berth-width" className="block text-sm font-medium text-gray-700">
                        Ширина (м) *
                      </label>
                      <input
                        id="edit-berth-width"
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={berthForm.width}
                        onChange={(e) => setBerthForm({ ...berthForm, width: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="edit-berth-price" className="block text-sm font-medium text-gray-700">
                      Цена за день (₽)
                    </label>
                    <input
                      id="edit-berth-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={berthForm.pricePerDay}
                      onChange={(e) => setBerthForm({ ...berthForm, pricePerDay: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-berth-notes" className="block text-sm font-medium text-gray-700">
                      Примечания
                    </label>
                    <textarea
                      id="edit-berth-notes"
                      rows={3}
                      value={berthForm.notes}
                      onChange={(e) => setBerthForm({ ...berthForm, notes: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleUpdateBerth}
                  disabled={savingBerth}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {savingBerth ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseBerthModal}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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

