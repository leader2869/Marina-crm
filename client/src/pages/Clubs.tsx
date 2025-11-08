import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { clubsService } from '../services/api'
import { Club, UserRole } from '../types'
import { Anchor, MapPin, Phone, Mail, Globe, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Clubs() {
  const { user } = useAuth()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadClubs()
  }, [])

  const loadClubs = async () => {
    try {
      const response = await clubsService.getAll({ limit: 100 })
      setClubs(response.data || [])
    } catch (error) {
      console.error('Ошибка загрузки клубов:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredClubs = clubs.filter((club) =>
    club.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    club.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDelete = async (clubId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Первое подтверждение
    if (!confirm('Вы уверены, что хотите удалить этот яхт-клуб?')) return

    // Второе подтверждение
    if (!confirm('ВНИМАНИЕ! Это действие необратимо. Данные будут удалены из базы данных. Продолжить?')) return

    setDeleting(true)

    try {
      await clubsService.delete(clubId)
      await loadClubs()
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка удаления яхт-клуба')
    } finally {
      setDeleting(false)
    }
  }

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Яхт-клубы</h1>
          <p className="mt-2 text-gray-600">Управление яхт-клубами</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="h-5 w-5 mr-2" />
          Добавить клуб
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <input
          type="text"
          placeholder="Поиск по названию или адресу..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredClubs.map((club) => (
          <Link
            key={club.id}
            to={`/clubs/${club.id}`}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <Anchor className="h-8 w-8 text-primary-600 mr-3" />
                <h3 className="text-xl font-semibold text-gray-900">{club.name}</h3>
              </div>
              {isSuperAdmin && (
                <button
                  onClick={(e) => handleDelete(club.id, e)}
                  disabled={deleting}
                  className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                  title="Удалить"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </div>
            {club.description && (
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">{club.description}</p>
            )}
            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="h-4 w-4 mr-2" />
                {club.address}
              </div>
              {club.phone && (
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="h-4 w-4 mr-2" />
                  {club.phone}
                </div>
              )}
              {club.email && (
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="h-4 w-4 mr-2" />
                  {club.email}
                </div>
              )}
              {club.website && (
                <div className="flex items-center text-sm text-primary-600">
                  <Globe className="h-4 w-4 mr-2" />
                  {club.website}
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Мест:</span>
                <span className="font-semibold">{club.totalBerths}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-600">Цена за день:</span>
                <span className="font-semibold text-primary-600">
                  {club.basePrice.toLocaleString()} ₽
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filteredClubs.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Anchor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Клубы не найдены</p>
        </div>
      )}
    </div>
  )
}

