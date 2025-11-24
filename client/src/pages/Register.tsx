import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Anchor } from 'lucide-react'

export default function Register() {
  const [searchParams] = useSearchParams()
  const roleParam = searchParams.get('role')
  
  const [formData, setFormData] = useState({
    password: '',
    firstName: '',
    lastName: '',
    phone: '+7',
    role: (roleParam === 'club_owner' ? 'club_owner' : roleParam === 'agent' ? 'agent' : roleParam === 'captain' ? 'captain' : roleParam === 'mechanic' ? 'mechanic' : 'vessel_owner') as 'vessel_owner' | 'club_owner' | 'agent' | 'captain' | 'mechanic',
  })
  
  // Обновляем роль при изменении query параметра
  useEffect(() => {
    if (roleParam === 'club_owner' || roleParam === 'vessel_owner' || roleParam === 'agent' || roleParam === 'captain' || roleParam === 'mechanic') {
      setFormData(prev => ({ ...prev, role: roleParam as 'vessel_owner' | 'club_owner' | 'agent' | 'captain' | 'mechanic' }))
    }
  }, [roleParam])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  // Функция валидации российского номера телефона
  const validateRussianPhone = (phone: string): boolean => {
    if (!phone || phone.trim() === '') {
      return false
    }

    // Удаляем все нецифровые символы, кроме +
    const cleaned = phone.replace(/[^\d+]/g, '')
    
    // Российский номер телефона должен быть:
    // +7XXXXXXXXXX (11 символов: +7 и 10 цифр)
    
    // Проверяем формат с +7
    if (cleaned.startsWith('+7')) {
      const digits = cleaned.substring(2) // Убираем +7
      return /^[0-9]{10}$/.test(digits) // Должно быть ровно 10 цифр
    }
    
    return false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Валидация телефона
    if (!formData.phone || formData.phone.trim() === '' || formData.phone === '+7') {
      setError('Пожалуйста, введите номер телефона')
      return
    }
    
    if (!validateRussianPhone(formData.phone)) {
      setError('Номер телефона должен соответствовать формату российского номера: +7 (999) 123-45-67')
      return
    }
    
    setLoading(true)

    try {
      const response: any = await register(formData)
      // Если регистрация как CLUB_OWNER, показываем сообщение о валидации
      if (formData.role === 'club_owner' && response?.message) {
        alert(response.message)
      }
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.error || 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  // Функция форматирования номера телефона
  const formatPhoneNumber = (value: string): string => {
    // Если поле пустое, возвращаем +7
    if (!value || value.trim() === '') {
      return '+7'
    }
    
    // Удаляем все нецифровые символы, кроме +
    let cleaned = value.replace(/[^\d+]/g, '')
    
    // Если номер начинается с 8, заменяем на +7
    if (cleaned.startsWith('8')) {
      cleaned = '+7' + cleaned.substring(1)
    }
    
    // Если номер начинается с 7 (без +), добавляем +
    if (cleaned.startsWith('7') && !cleaned.startsWith('+7')) {
      cleaned = '+' + cleaned
    }
    
    // Если номер не начинается с +7, добавляем +7
    if (!cleaned.startsWith('+7')) {
      // Если начинается с цифр, добавляем +7
      if (/^\d/.test(cleaned)) {
        cleaned = '+7' + cleaned
      } else {
        cleaned = '+7' + cleaned
      }
    }
    
    // Если пользователь пытается удалить +7, оставляем минимум +7
    if (cleaned.length < 2) {
      return '+7'
    }
    
    // Извлекаем только цифры после +7
    const digits = cleaned.substring(2).replace(/\D/g, '')
    
    // Ограничиваем до 10 цифр (после +7)
    const limitedDigits = digits.substring(0, 10)
    
    // Форматируем номер: +7 (XXX) XXX-XX-XX
    if (limitedDigits.length === 0) {
      return '+7'
    } else if (limitedDigits.length <= 3) {
      return `+7 (${limitedDigits}`
    } else if (limitedDigits.length <= 6) {
      return `+7 (${limitedDigits.substring(0, 3)}) ${limitedDigits.substring(3)}`
    } else if (limitedDigits.length <= 8) {
      return `+7 (${limitedDigits.substring(0, 3)}) ${limitedDigits.substring(3, 6)}-${limitedDigits.substring(6)}`
    } else {
      return `+7 (${limitedDigits.substring(0, 3)}) ${limitedDigits.substring(3, 6)}-${limitedDigits.substring(6, 8)}-${limitedDigits.substring(8, 10)}`
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.target.name === 'phone') {
      const formatted = formatPhoneNumber(e.target.value)
      setFormData({ ...formData, phone: formatted })
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <div className="flex justify-center">
            <Anchor className="h-12 w-12 text-primary-600" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Регистрация</h2>
          <p className="mt-2 text-sm text-gray-600">Создайте новый аккаунт</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                Имя
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                value={formData.firstName}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                Фамилия
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                value={formData.lastName}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Телефон *
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                value={formData.phone}
                onKeyDown={(e) => {
                  // Предотвращаем удаление +7 при нажатии Backspace в начале
                  if (e.key === 'Backspace' && formData.phone === '+7') {
                    e.preventDefault()
                  }
                  // Предотвращаем удаление + при нажатии Backspace
                  if (e.key === 'Backspace' && formData.phone === '+7 (') {
                    e.preventDefault()
                    setFormData({ ...formData, phone: '+7' })
                  }
                }}
                onFocus={(e) => {
                  // Если поле пустое, добавляем +7 при фокусе
                  if (!e.target.value || e.target.value === '') {
                    setFormData({ ...formData, phone: '+7' })
                  }
                }}
                onChange={(e) => {
                  const inputValue = e.target.value
                  // Если пользователь пытается удалить +7, предотвращаем это
                  if (inputValue.length < 2 || !inputValue.startsWith('+7')) {
                    // Если поле почти пустое, оставляем +7
                    if (inputValue.length < 2) {
                      setFormData({ ...formData, phone: '+7' })
                      return
                    }
                  }
                  const formatted = formatPhoneNumber(inputValue)
                  setFormData({ ...formData, phone: formatted })
                  // Очищаем ошибку при вводе
                  if (error && error.includes('Номер телефона')) {
                    setError('')
                  }
                }}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white ${
                  error && error.includes('Номер телефона') 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-300'
                }`}
                placeholder="+7 (999) 123-45-67"
              />
              <p className="mt-1 text-xs text-gray-500">
                Формат: +7 (999) 123-45-67
              </p>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
              />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Роль *
              </label>
              <select
                id="role"
                name="role"
                required
                value={formData.role}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
              >
                <option value="vessel_owner">Судовладелец</option>
                <option value="club_owner">Владелец яхт-клуба</option>
                <option value="agent">Агент</option>
                <option value="captain">Капитан</option>
                <option value="mechanic">Механик</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Выберите роль для регистрации в системе
              </p>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </div>

          <div className="text-center">
            <Link to="/login" className="text-sm text-primary-600 hover:text-primary-500">
              Уже есть аккаунт? Войти
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

