import { useNavigate } from 'react-router-dom'
import { Wrench, Fuel, ArrowRight } from 'lucide-react'
import BackButton from '../components/BackButton'

export default function VesselMaintenance() {
  const navigate = useNavigate()

  const maintenanceOptions = [
    {
      name: 'Заправка катеров',
      description: 'Управление заправками катеров',
      href: '/vessel-refueling',
      icon: Fuel,
      color: 'bg-blue-500',
    },
    {
      name: 'Сервис катеров',
      description: 'Управление сервисным обслуживанием катеров',
      href: '/vessel-service',
      icon: Wrench,
      color: 'bg-green-500',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Wrench className="h-8 w-8 text-primary-600 mr-3" />
            Обслуживание катеров
          </h1>
          <p className="mt-2 text-gray-600">Выберите раздел обслуживания</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {maintenanceOptions.map((option) => {
          const Icon = option.icon
          return (
            <div
              key={option.href}
              onClick={() => navigate(option.href)}
              className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow duration-200 border-2 border-transparent hover:border-primary-500"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`${option.color} p-3 rounded-lg`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">
                      {option.name}
                    </h3>
                    <p className="text-gray-600 text-sm">{option.description}</p>
                  </div>
                </div>
                <ArrowRight className="h-6 w-6 text-gray-400 flex-shrink-0" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

