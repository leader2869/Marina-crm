import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Anchor, X } from 'lucide-react'

export default function Login() {
  const [emailOrPhone, setEmailOrPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [showGuestModal, setShowGuestModal] = useState(false)
  const [guestForm, setGuestForm] = useState({
    firstName: '',
    phone: '',
  })
  const { login, loginAsGuest } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(emailOrPhone, password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.error || 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  const handleGuestLoginClick = () => {
    setShowGuestModal(true)
    setError('')
  }

  const handleGuestModalClose = () => {
    setShowGuestModal(false)
    setGuestForm({ firstName: '', phone: '' })
    setError('')
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

  // Функция валидации российского номера телефона
  const validateRussianPhone = (phone: string): boolean => {
    if (!phone || phone.trim() === '') {
      return true // Телефон необязателен
    }

    // Удаляем все пробелы, скобки, дефисы для проверки
    const cleaned = phone.replace(/[\s\-\(\)]/g, '')
    
    // Российский номер телефона должен быть:
    // +7XXXXXXXXXX (11 символов: +7 и 10 цифр)
    // 8XXXXXXXXXX (11 цифр: 8 и 10 цифр)
    // 7XXXXXXXXXX (11 цифр: 7 и 10 цифр)
    
    // Проверяем формат с +7
    if (cleaned.startsWith('+7')) {
      const digits = cleaned.substring(2) // Убираем +7
      return /^[0-9]{10}$/.test(digits) // Должно быть ровно 10 цифр
    }
    
    // Проверяем формат с 8
    if (cleaned.startsWith('8')) {
      return /^8[0-9]{10}$/.test(cleaned) // Должно быть 8 и 10 цифр (всего 11)
    }
    
    // Проверяем формат с 7 (без +)
    if (cleaned.startsWith('7')) {
      return /^7[0-9]{10}$/.test(cleaned) // Должно быть 7 и 10 цифр (всего 11)
    }
    
    // Если не начинается с +7, 8 или 7, проверяем что это 10 цифр (только цифры)
    if (/^[0-9]{10}$/.test(cleaned)) {
      return true // 10 цифр - валидный формат
    }
    
    return false
  }

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!guestForm.firstName.trim()) {
      setError('Пожалуйста, введите имя')
      return
    }

    // Валидация номера телефона, если он введен
    if (guestForm.phone && guestForm.phone.trim() !== '') {
      if (!validateRussianPhone(guestForm.phone)) {
        setError('Номер телефона должен соответствовать формату российского номера: +7 (999) 123-45-67 или 8 (999) 123-45-67')
        return
      }
    }

    setGuestLoading(true)

    try {
      await loginAsGuest(guestForm.firstName, guestForm.phone || undefined)
      setShowGuestModal(false)
      setGuestForm({ firstName: '', phone: '' })
      navigate('/clubs')
    } catch (err: any) {
      setError(err.error || 'Ошибка входа как гость')
    } finally {
      setGuestLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <div className="flex justify-center">
            <Anchor className="h-12 w-12 text-primary-600" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Marina CRM</h2>
          <p className="mt-2 text-sm text-gray-600">Войдите в свой аккаунт</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="emailOrPhone" className="block text-sm font-medium text-gray-700">
                Email или телефон
              </label>
              <input
                id="emailOrPhone"
                name="emailOrPhone"
                type="text"
                required
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                placeholder="admin@marina-crm.com или +7 (999) 123-45-67"
              />
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || guestLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={handleGuestLoginClick}
              disabled={loading || guestLoading}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              Войти как гость
            </button>
          </div>

          <div className="text-center">
            <Link to="/register" className="text-sm text-primary-600 hover:text-primary-500">
              Нет аккаунта? Зарегистрироваться
            </Link>
          </div>
        </form>
      </div>

      {/* Модальное окно для входа как гость */}
      {showGuestModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={handleGuestModalClose} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Вход как гость</h3>
                  <button
                    onClick={handleGuestModalClose}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleGuestLogin} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}

                  <div>
                    <label htmlFor="guest-firstName" className="block text-sm font-medium text-gray-700">
                      Имя *
                    </label>
                    <input
                      id="guest-firstName"
                      type="text"
                      required
                      value={guestForm.firstName}
                      onChange={(e) => setGuestForm({ ...guestForm, firstName: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      placeholder="Введите ваше имя"
                    />
                  </div>

                  <div>
                    <label htmlFor="guest-phone" className="block text-sm font-medium text-gray-700">
                      Номер телефона
                    </label>
                    <input
                      id="guest-phone"
                      type="tel"
                      value={guestForm.phone}
                      onChange={(e) => {
                        const inputValue = e.target.value
                        // Если пользователь пытается удалить +7, предотвращаем это
                        if (inputValue.length < 2 || !inputValue.startsWith('+7')) {
                          // Если поле почти пустое, оставляем +7
                          if (inputValue.length < 2) {
                            setGuestForm({ ...guestForm, phone: '+7' })
                            return
                          }
                        }
                        const formatted = formatPhoneNumber(inputValue)
                        setGuestForm({ ...guestForm, phone: formatted })
                        // Очищаем ошибку при вводе
                        if (error && error.includes('Номер телефона')) {
                          setError('')
                        }
                      }}
                      onKeyDown={(e) => {
                        // Предотвращаем удаление +7 при нажатии Backspace в начале
                        if (e.key === 'Backspace' && guestForm.phone === '+7') {
                          e.preventDefault()
                        }
                        // Предотвращаем удаление + при нажатии Backspace
                        if (e.key === 'Backspace' && guestForm.phone === '+7 (') {
                          e.preventDefault()
                          setGuestForm({ ...guestForm, phone: '+7' })
                        }
                      }}
                      onFocus={(e) => {
                        // Если поле пустое, добавляем +7 при фокусе
                        if (!e.target.value || e.target.value === '') {
                          setGuestForm({ ...guestForm, phone: '+7' })
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
                      Формат: +7 (999) 123-45-67 или 8 (999) 123-45-67
                    </p>
                  </div>

                  <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      disabled={guestLoading}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                    >
                      {guestLoading ? 'Вход...' : 'Войти'}
                    </button>
                    <button
                      type="button"
                      onClick={handleGuestModalClose}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

