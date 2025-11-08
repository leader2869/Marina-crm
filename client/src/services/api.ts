import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error.response?.data || error.message)
  }
)

export const authService = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/profile'),
}

export const clubsService = {
  getAll: (params?: any) => api.get('/clubs', { params }),
  getById: (id: number) => api.get(`/clubs/${id}`),
  create: (data: any) => api.post('/clubs', data),
  update: (id: number, data: any) => api.put(`/clubs/${id}`, data),
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
  create: (data: any) => api.post('/users', data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
}

export default api

