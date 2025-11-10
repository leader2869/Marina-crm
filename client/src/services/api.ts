import axios from 'axios'

// Определяем URL API: если VITE_API_URL не установлен, используем относительный путь для production
// или localhost для development
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  // Если мы на production (Vercel), используем относительный путь
  if (import.meta.env.PROD) {
    return '/api'
  }
  // Для development используем localhost
  return 'http://localhost:3001/api'
}

const API_URL = getApiUrl()

// Логируем URL API для отладки
console.log('API URL:', API_URL)
console.log('VITE_API_URL:', import.meta.env.VITE_API_URL)
console.log('PROD:', import.meta.env.PROD)

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 секунд таймаут
})

// Добавляем токен к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Обработка ошибок
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      url: error.config?.url,
      method: error.config?.method
    })
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    
    // Если ошибка 404, возвращаем объект с error
    if (error.response?.status === 404) {
      return Promise.reject({
        error: error.response?.data?.error || 'Маршрут не найден',
        message: error.response?.data?.error || 'Маршрут не найден',
      })
    }
    
    // Если ошибка 500 или другая серверная ошибка
    if (error.response?.status >= 500) {
      return Promise.reject({
        error: error.response?.data?.error || 'Ошибка сервера',
        message: error.response?.data?.message || error.response?.data?.error || 'Сервер временно недоступен',
        details: error.response?.data?.details
      })
    }
    
    // Если есть данные об ошибке в ответе
    if (error.response?.data) {
      return Promise.reject({
        error: error.response.data.error || error.response.data.message || 'Ошибка запроса',
        message: error.response.data.message || error.response.data.error || 'Ошибка запроса',
        details: error.response.data.details
      })
    }
    
    // Если нет ответа от сервера (сетевая ошибка)
    if (!error.response) {
      return Promise.reject({
        error: 'Ошибка сети',
        message: 'Не удалось подключиться к серверу. Проверьте подключение к интернету и настройки API URL.',
        details: error.message
      })
    }
    
    return Promise.reject(error.response?.data || error.message)
  }
)

export const authService = {
  login: (emailOrPhone: string, password: string) =>
    api.post('/auth/login', { emailOrPhone, password }),
  register: (data: any) => api.post('/auth/register', data),
  loginAsGuest: (firstName: string, phone?: string) => 
    api.post('/auth/guest', { firstName, phone }),
  getProfile: () => api.get('/auth/profile'),
}

export const clubsService = {
  getAll: (params?: any) => api.get('/clubs', { params }),
  getById: (id: number) => api.get(`/clubs/${id}`),
  create: (data: any) => api.post('/clubs', data),
  update: (id: number, data: any) => api.put(`/clubs/${id}`, data),
  hide: (id: number) => api.post(`/clubs/${id}/hide`),
  restore: (id: number) => api.post(`/clubs/${id}/restore`),
  delete: (id: number) => api.delete(`/clubs/${id}`),
}

export const vesselsService = {
  getAll: (params?: any) => api.get('/vessels', { params }),
  getById: (id: number) => api.get(`/vessels/${id}`),
  create: (data: any) => api.post('/vessels', data),
  update: (id: number, data: any) => api.put(`/vessels/${id}`, data),
  delete: (id: number) => api.delete(`/vessels/${id}`),
}

export const bookingsService = {
  getAll: (params?: any) => api.get('/bookings', { params }),
  getByClub: (clubId: number) => api.get(`/bookings/club/${clubId}`),
  getById: (id: number) => api.get(`/bookings/${id}`),
  create: (data: any) => api.post('/bookings', data),
  update: (id: number, data: any) => api.put(`/bookings/${id}`, data),
  cancel: (id: number) => api.delete(`/bookings/${id}`),
}

export const financesService = {
  getIncomes: (params?: any) => api.get('/finances/incomes', { params }),
  createIncome: (data: any) => api.post('/finances/incomes', data),
  getExpenses: (params?: any) => api.get('/finances/expenses', { params }),
  createExpense: (data: any) => api.post('/finances/expenses', data),
  approveExpense: (id: number) => api.post(`/finances/expenses/${id}/approve`),
  getExpenseCategories: (params?: any) => api.get('/finances/expense-categories', { params }),
  createExpenseCategory: (data: any) => api.post('/finances/expense-categories', data),
  getAnalytics: (params: any) => api.get('/finances/analytics', { params }),
  getBudgets: (params?: any) => api.get('/finances/budgets', { params }),
  createBudget: (data: any) => api.post('/finances/budgets', data),
}

export const paymentsService = {
  getAll: (params?: any) => api.get('/payments', { params }),
  getById: (id: number) => api.get(`/payments/${id}`),
  create: (data: any) => api.post('/payments', data),
  updateStatus: (id: number, data: any) => api.put(`/payments/${id}/status`, data),
  getOverdue: (params?: any) => api.get('/payments/overdue', { params }),
}

export const usersService = {
  getAll: (params?: any) => api.get('/users', { params }),
  getGuests: (params?: any) => api.get('/users/guests', { params }),
  getById: (id: number) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
}

export const berthsService = {
  getByClub: (clubId: number) => api.get(`/berths/club/${clubId}`),
  getAvailableByClub: (clubId: number, params?: { startDate?: string; endDate?: string }) => 
    api.get(`/berths/club/${clubId}/available`, { params }),
  create: (data: any) => api.post('/berths', data),
  update: (id: number, data: any) => api.put(`/berths/${id}`, data),
  delete: (id: number) => api.delete(`/berths/${id}`),
}

export const tariffsService = {
  getByClub: (clubId: number) => api.get(`/tariffs/club/${clubId}`),
  create: (data: any) => api.post('/tariffs', data),
  update: (id: number, data: any) => api.put(`/tariffs/${id}`, data),
  delete: (id: number) => api.delete(`/tariffs/${id}`),
}

export const bookingRulesService = {
  getByClub: (clubId: number) => api.get(`/booking-rules/club/${clubId}`),
  create: (data: any) => api.post('/booking-rules', data),
  update: (id: number, data: any) => api.put(`/booking-rules/${id}`, data),
  delete: (id: number) => api.delete(`/booking-rules/${id}`),
}

export default api

