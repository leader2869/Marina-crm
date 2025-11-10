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
    ? 'flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-blue-100'
    : 'flex items-center justify-center py-12'

  return (
    <div className={containerClass}>
      <div className="relative w-full max-w-md">
        {/* Океан */}
        <div className="relative h-64 overflow-hidden rounded-lg bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600">
          {/* Волны */}
          <div className="absolute bottom-0 w-full">
            {/* Волна 1 */}
            <svg
              className="absolute bottom-0 w-full"
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
              style={{ height: '60px' }}
            >
              <path
                d="M0,60 Q300,20 600,60 T1200,60 L1200,120 L0,120 Z"
                fill="rgba(255,255,255,0.3)"
                className="wave-animation-1"
              />
            </svg>
            {/* Волна 2 */}
            <svg
              className="absolute bottom-0 w-full"
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
              style={{ height: '50px' }}
            >
              <path
                d="M0,50 Q400,10 800,50 T1200,50 L1200,120 L0,120 Z"
                fill="rgba(255,255,255,0.4)"
                className="wave-animation-2"
              />
            </svg>
            {/* Волна 3 */}
            <svg
              className="absolute bottom-0 w-full"
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
              style={{ height: '40px' }}
            >
              <path
                d="M0,40 Q200,0 400,40 T800,40 T1200,40 L1200,120 L0,120 Z"
                fill="rgba(255,255,255,0.5)"
                className="wave-animation-3"
              />
            </svg>
          </div>

          {/* Кораблик */}
          <div className="boat-container">
            <svg
              className="boat"
              width="80"
              height="60"
              viewBox="0 0 80 60"
              style={{
                position: 'absolute',
                bottom: '45%',
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              {/* Корпус корабля */}
              <path
                d="M10 40 L70 40 L65 50 L15 50 Z"
                fill="#8B4513"
                className="boat-body"
              />
              {/* Палуба */}
              <path
                d="M15 40 L65 40 L60 45 L20 45 Z"
                fill="#D2691E"
              />
              {/* Мачта */}
              <line
                x1="40"
                y1="40"
                x2="40"
                y2="15"
                stroke="#654321"
                strokeWidth="2"
                className="boat-mast"
              />
              {/* Парус */}
              <path
                d="M40 20 L40 35 L55 35 Z"
                fill="#FFFFFF"
                className="boat-sail"
              />
              {/* Флаг */}
              <path
                d="M40 15 L40 20 L45 18 Z"
                fill="#FF0000"
                className="boat-flag"
              />
            </svg>
          </div>

          {/* Солнце */}
          <div className="absolute top-4 right-4">
            <div className="sun-animation w-12 h-12 bg-yellow-300 rounded-full shadow-lg"></div>
          </div>

          {/* Облака */}
          <div className="absolute top-8 left-8 cloud-animation-1">
            <div className="w-16 h-8 bg-white rounded-full opacity-60"></div>
            <div className="w-12 h-12 bg-white rounded-full opacity-60 -mt-6 ml-4"></div>
            <div className="w-14 h-10 bg-white rounded-full opacity-60 -mt-4 ml-8"></div>
          </div>
          <div className="absolute top-12 right-16 cloud-animation-2">
            <div className="w-12 h-6 bg-white rounded-full opacity-50"></div>
            <div className="w-10 h-10 bg-white rounded-full opacity-50 -mt-5 ml-3"></div>
            <div className="w-12 h-8 bg-white rounded-full opacity-50 -mt-3 ml-6"></div>
          </div>
        </div>

        {/* Сообщение */}
        <div className="mt-6 text-center">
          <p className="text-lg font-semibold text-blue-700 animate-pulse">
            {message}
          </p>
        </div>
      </div>

      <style>{`
        /* Анимация волн */
        .wave-animation-1 {
          animation: wave1 3s ease-in-out infinite;
        }
        
        .wave-animation-2 {
          animation: wave2 4s ease-in-out infinite;
        }
        
        .wave-animation-3 {
          animation: wave3 5s ease-in-out infinite;
        }

        @keyframes wave1 {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(-25px);
          }
        }

        @keyframes wave2 {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(30px);
          }
        }

        @keyframes wave3 {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(-20px);
          }
        }

        /* Анимация кораблика */
        .boat-container {
          animation: boatFloat 3s ease-in-out infinite;
        }

        .boat {
          animation: boatSway 2s ease-in-out infinite;
        }

        .boat-body {
          animation: boatBounce 2.5s ease-in-out infinite;
        }

        .boat-mast {
          animation: mastSway 2s ease-in-out infinite;
        }

        .boat-sail {
          animation: sailFlap 1.5s ease-in-out infinite;
        }

        .boat-flag {
          animation: flagWave 1s ease-in-out infinite;
        }

        @keyframes boatFloat {
          0%, 100% {
            transform: translateX(-50%) translateY(0);
          }
          50% {
            transform: translateX(-50%) translateY(-10px);
          }
        }

        @keyframes boatSway {
          0%, 100% {
            transform: translateX(-50%) rotate(0deg);
          }
          25% {
            transform: translateX(-50%) rotate(-2deg);
          }
          75% {
            transform: translateX(-50%) rotate(2deg);
          }
        }

        @keyframes boatBounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }

        @keyframes mastSway {
          0%, 100% {
            transform: rotate(0deg);
            transform-origin: bottom center;
          }
          25% {
            transform: rotate(-1deg);
            transform-origin: bottom center;
          }
          75% {
            transform: rotate(1deg);
            transform-origin: bottom center;
          }
        }

        @keyframes sailFlap {
          0%, 100% {
            transform: scaleY(1);
          }
          50% {
            transform: scaleY(1.05);
          }
        }

        @keyframes flagWave {
          0%, 100% {
            transform: rotate(0deg);
            transform-origin: left center;
          }
          50% {
            transform: rotate(10deg);
            transform-origin: left center;
          }
        }

        /* Анимация солнца */
        .sun-animation {
          animation: sunRotate 10s linear infinite;
        }

        @keyframes sunRotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        /* Анимация облаков */
        .cloud-animation-1 {
          animation: cloudMove1 20s ease-in-out infinite;
        }

        .cloud-animation-2 {
          animation: cloudMove2 25s ease-in-out infinite;
        }

        @keyframes cloudMove1 {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(30px);
          }
        }

        @keyframes cloudMove2 {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(-40px);
          }
        }
      `}</style>
    </div>
  )
}

export default LoadingAnimation

