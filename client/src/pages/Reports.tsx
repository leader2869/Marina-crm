import { Link } from 'react-router-dom'
import BackButton from '../components/BackButton'

export default function Reports() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold">Отчеты</h1>
          <p className="text-gray-600">Формирование отчетов по доходам и расходам</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/reports/finance"
          className="bg-white rounded-lg shadow p-5 border border-gray-100 hover:shadow-md hover:border-primary-200 transition-all"
        >
          <h2 className="text-lg font-semibold text-gray-900">Отчет по доходам и расходам</h2>
          <p className="text-sm text-gray-600 mt-2">
            Аналитика операций кассы клуба по периоду: доходы, расходы, итоговые суммы и детализация.
          </p>
        </Link>
        <Link
          to="/reports/tenants"
          className="bg-white rounded-lg shadow p-5 border border-gray-100 hover:shadow-md hover:border-primary-200 transition-all"
        >
          <h2 className="text-lg font-semibold text-gray-900">Отчет по арендаторам</h2>
          <p className="text-sm text-gray-600 mt-2">
            Свободные и занятые места, ФИО и телефоны арендаторов, принятые и ожидаемые деньги.
          </p>
        </Link>
      </div>
    </div>
  )
}
