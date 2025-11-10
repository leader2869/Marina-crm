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
        {/* Маленький кораблик */}
        <div className="boat-container">
          <svg
            className="boat"
            width="60"
            height="45"
            viewBox="0 0 60 45"
          >
            {/* Корпус корабля */}
            <path
              d="M8 30 L52 30 L48 38 L12 38 Z"
              fill="#8B4513"
              className="boat-body"
            />
            {/* Палуба */}
            <path
              d="M12 30 L48 30 L45 34 L15 34 Z"
              fill="#D2691E"
            />
            {/* Мачта */}
            <line
              x1="30"
              y1="30"
              x2="30"
              y2="12"
              stroke="#654321"
              strokeWidth="2"
              className="boat-mast"
            />
            {/* Парус */}
            <path
              d="M30 15 L30 28 L42 28 Z"
              fill="#FFFFFF"
              className="boat-sail"
            />
            {/* Флаг */}
            <path
              d="M30 12 L30 16 L34 14 Z"
              fill="#FF0000"
              className="boat-flag"
            />
          </svg>
        </div>

        {/* Сообщение */}
        <div className="mt-4 text-center">
          <p className="text-sm font-medium text-gray-600 animate-pulse">
            {message}
          </p>
        </div>
      </div>

      <style>{`
        /* Анимация кораблика - покачивание */
        .boat-container {
          animation: boatSway 2s ease-in-out infinite;
        }

        .boat {
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
        }

        .boat-body {
          animation: boatBounce 2.5s ease-in-out infinite;
        }

        .boat-mast {
          animation: mastSway 2s ease-in-out infinite;
          transform-origin: bottom center;
        }

        .boat-sail {
          animation: sailFlap 1.5s ease-in-out infinite;
        }

        .boat-flag {
          animation: flagWave 1s ease-in-out infinite;
          transform-origin: left center;
        }

        @keyframes boatSway {
          0%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(-3deg);
          }
          75% {
            transform: rotate(3deg);
          }
        }

        @keyframes boatBounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }

        @keyframes mastSway {
          0%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(-1.5deg);
          }
          75% {
            transform: rotate(1.5deg);
          }
        }

        @keyframes sailFlap {
          0%, 100% {
            transform: scaleY(1);
          }
          50% {
            transform: scaleY(1.08);
          }
        }

        @keyframes flagWave {
          0%, 100% {
            transform: rotate(0deg);
          }
          50% {
            transform: rotate(15deg);
          }
        }
      `}</style>
    </div>
  )
}

export default LoadingAnimation

