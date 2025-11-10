// ВАРИАНТ 7: Элегантная яхта (стильный дизайн)
import React from 'react'

interface LoadingAnimationProps {
  message?: string
  fullScreen?: boolean
}

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ 
  message = 'Загрузка...',
  fullScreen = false 
}) => {
  const containerClass = fullScreen 
    ? 'flex items-center justify-center min-h-screen'
    : 'flex items-center justify-center py-12'

  return (
    <div className={containerClass}>
      <div className="flex flex-col items-center justify-center">
        <div className="boat-container">
          <svg width="75" height="55" viewBox="0 0 75 55">
            {/* Корпус яхты */}
            <path d="M8 40 L67 40 L64 48 L11 48 Z" fill="#1E40AF" className="boat-body" />
            {/* Палуба */}
            <path d="M12 40 L63 40 L61 44 L14 44 Z" fill="#3B82F6" />
            {/* Мачта */}
            <line x1="37" y1="40" x2="37" y2="5" stroke="#1F2937" strokeWidth="3" className="boat-mast" />
            {/* Главный парус */}
            <path d="M37 10 L37 38 L58 38 Z" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="0.5" className="boat-sail" />
            {/* Передний парус (стаксель) */}
            <path d="M37 12 L37 35 L22 35 Z" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="0.5" className="boat-sail" />
            {/* Флаг */}
            <path d="M37 5 L37 9 L43 7 Z" fill="#EF4444" className="boat-flag" />
          </svg>
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm font-medium text-gray-600 animate-pulse">{message}</p>
        </div>
      </div>
      <style>{`
        .boat-container { animation: boatSway 2s ease-in-out infinite; }
        .boat-body { animation: boatBounce 2.5s ease-in-out infinite; }
        .boat-mast { animation: mastSway 2s ease-in-out infinite; transform-origin: bottom center; }
        .boat-sail { animation: sailFlap 1.5s ease-in-out infinite; }
        .boat-flag { animation: flagWave 1s ease-in-out infinite; transform-origin: left center; }
        @keyframes boatSway { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-3deg); } 75% { transform: rotate(3deg); } }
        @keyframes boatBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        @keyframes mastSway { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-1.5deg); } 75% { transform: rotate(1.5deg); } }
        @keyframes sailFlap { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.08); } }
        @keyframes flagWave { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(15deg); } }
      `}</style>
    </div>
  )
}

