<div className=""></div>// ВАРИАНТ 3: Моторный катер (без парусов)
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
          <svg width="65" height="45" viewBox="0 0 65 45">
            {/* Корпус катера */}
            <path d="M8 32 L57 32 L52 40 L13 40 Z" fill="#2563EB" className="boat-body" />
            {/* Палуба */}
            <path d="M12 32 L53 32 L50 36 L15 36 Z" fill="#3B82F6" />
            {/* Кабина */}
            <rect x="20" y="28" width="25" height="8" fill="#1E40AF" rx="2" />
            {/* Окна кабины */}
            <rect x="23" y="30" width="4" height="4" fill="#93C5FD" />
            <rect x="38" y="30" width="4" height="4" fill="#93C5FD" />
            {/* Флаг */}
            <path d="M45 28 L45 32 L50 30 Z" fill="#EF4444" className="boat-flag" />
          </svg>
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm font-medium text-gray-600 animate-pulse">{message}</p>
        </div>
      </div>
      <style>{`
        .boat-container { animation: boatSway 2s ease-in-out infinite; }
        .boat-body { animation: boatBounce 2.5s ease-in-out infinite; }
        .boat-flag { animation: flagWave 1s ease-in-out infinite; transform-origin: left center; }
        @keyframes boatSway { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-3deg); } 75% { transform: rotate(3deg); } }
        @keyframes boatBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        @keyframes flagWave { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(15deg); } }
      `}</style>
    </div>
  )
}

