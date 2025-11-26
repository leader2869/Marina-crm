import { useState, useEffect, useCallback, useRef } from 'react'
import { Gamepad2, Play, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'
import BackButton from '../components/BackButton'

interface Position {
  x: number
  y: number
}

const GRID_SIZE = 20
const CELL_SIZE = 20
const INITIAL_SNAKE: Position[] = [{ x: 10, y: 10 }]
const INITIAL_DIRECTION = { x: 1, y: 0 }
const GAME_SPEED = 150

export default function MiniGames() {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE)
  const [food, setFood] = useState<Position>({ x: 15, y: 15 })
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const directionRef = useRef<Position>(INITIAL_DIRECTION)
  const gameLoopRef = useRef<number | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Определение мобильного устройства
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Генерация случайной позиции для еды
  const generateFood = useCallback((): Position => {
    const x = Math.floor(Math.random() * GRID_SIZE)
    const y = Math.floor(Math.random() * GRID_SIZE)
    return { x, y }
  }, [])

  // Проверка столкновения со стенами или собой
  const checkCollision = useCallback((head: Position, snakeBody: Position[]): boolean => {
    // Столкновение со стенами
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      return true
    }
    // Столкновение с собой
    return snakeBody.some((segment, index) => {
      if (index === 0) return false
      return segment.x === head.x && segment.y === head.y
    })
  }, [])

  // Игровой цикл
  useEffect(() => {
    if (!isPlaying || gameOver) {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
        gameLoopRef.current = null
      }
      return
    }

    gameLoopRef.current = window.setInterval(() => {
      setSnake((prevSnake) => {
        const newHead: Position = {
          x: prevSnake[0].x + directionRef.current.x,
          y: prevSnake[0].y + directionRef.current.y,
        }

        // Проверка столкновения
        if (checkCollision(newHead, prevSnake)) {
          setGameOver(true)
          setIsPlaying(false)
          return prevSnake
        }

        const newSnake = [newHead, ...prevSnake]

        // Проверка поедания еды
        if (newHead.x === food.x && newHead.y === food.y) {
          setScore((prev) => prev + 10)
          setFood(generateFood())
          return newSnake
        }

        // Удаляем хвост, если не съели еду
        return newSnake.slice(0, -1)
      })
    }, GAME_SPEED)

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
        gameLoopRef.current = null
      }
    }
  }, [isPlaying, gameOver, food, checkCollision, generateFood])

  // Изменение направления
  const changeDirection = useCallback((newDirection: Position) => {
    if (!isPlaying) return
    
    // Предотвращаем движение в противоположном направлении
    if (
      (directionRef.current.x === 1 && newDirection.x === -1) ||
      (directionRef.current.x === -1 && newDirection.x === 1) ||
      (directionRef.current.y === 1 && newDirection.y === -1) ||
      (directionRef.current.y === -1 && newDirection.y === 1)
    ) {
      return
    }

    directionRef.current = newDirection
  }, [isPlaying])

  // Обработка нажатий клавиш
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isPlaying) return

      const key = e.key
      let newDirection: Position | null = null

      switch (key) {
        case 'ArrowUp':
          if (directionRef.current.y === 0) {
            newDirection = { x: 0, y: -1 }
          }
          break
        case 'ArrowDown':
          if (directionRef.current.y === 0) {
            newDirection = { x: 0, y: 1 }
          }
          break
        case 'ArrowLeft':
          if (directionRef.current.x === 0) {
            newDirection = { x: -1, y: 0 }
          }
          break
        case 'ArrowRight':
          if (directionRef.current.x === 0) {
            newDirection = { x: 1, y: 0 }
          }
          break
        default:
          return
      }

      if (newDirection) {
        changeDirection(newDirection)
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isPlaying, changeDirection])

  // Обработка touch событий для мобильных
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !isPlaying) return

    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = touch.clientY - touchStartRef.current.y
    const minSwipeDistance = 30

    if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) {
      return
    }

    let newDirection: Position | null = null

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Горизонтальный swipe
      if (deltaX > 0 && directionRef.current.x === 0) {
        newDirection = { x: 1, y: 0 } // Вправо
      } else if (deltaX < 0 && directionRef.current.x === 0) {
        newDirection = { x: -1, y: 0 } // Влево
      }
    } else {
      // Вертикальный swipe
      if (deltaY > 0 && directionRef.current.y === 0) {
        newDirection = { x: 0, y: 1 } // Вниз
      } else if (deltaY < 0 && directionRef.current.y === 0) {
        newDirection = { x: 0, y: -1 } // Вверх
      }
    }

    if (newDirection) {
      changeDirection(newDirection)
    }

    touchStartRef.current = null
  }

  // Начало игры
  const startGame = () => {
    setSnake(INITIAL_SNAKE)
    setFood(generateFood())
    directionRef.current = INITIAL_DIRECTION
    setGameOver(false)
    setScore(0)
    setIsPlaying(true)
  }

  // Перезапуск игры
  const resetGame = () => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current)
      gameLoopRef.current = null
    }
    setSnake(INITIAL_SNAKE)
    setFood(generateFood())
    directionRef.current = INITIAL_DIRECTION
    setGameOver(false)
    setScore(0)
    setIsPlaying(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Gamepad2 className="h-8 w-8 text-primary-600 mr-3" />
            Мини игры
          </h1>
          <p className="mt-2 text-gray-600">Развлекательные мини-игры</p>
        </div>
      </div>

      {/* Игра Змейка */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Змейка</h2>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="text-lg font-semibold text-gray-700">
                Счет: <span className="text-primary-600">{score}</span>
              </div>
              {gameOver && (
                <div className="text-lg font-semibold text-red-600">
                  Игра окончена!
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {!isPlaying && !gameOver && (
                <button
                  onClick={startGame}
                  className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Начать игру
                </button>
              )}
              {(gameOver || isPlaying) && (
                <button
                  onClick={resetGame}
                  className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Перезапустить
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Игровое поле */}
        <div className="flex flex-col items-center">
          <div
            className="border-4 border-gray-800 rounded-lg bg-gray-100 touch-none"
            style={{
              width: GRID_SIZE * CELL_SIZE,
              height: GRID_SIZE * CELL_SIZE,
              position: 'relative',
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Русалка (еда) */}
            <div
              className="absolute flex items-center justify-center text-2xl"
              style={{
                left: food.x * CELL_SIZE,
                top: food.y * CELL_SIZE,
                width: CELL_SIZE,
                height: CELL_SIZE,
              }}
            >
              🧜‍♀️
            </div>

            {/* Катер */}
            {snake.map((segment, index) => (
              <div
                key={index}
                className="absolute flex items-center justify-center"
                style={{
                  left: segment.x * CELL_SIZE,
                  top: segment.y * CELL_SIZE,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  zIndex: snake.length - index,
                }}
              >
                {index === 0 ? (
                  <div className="text-2xl" style={{ filter: 'drop-shadow(0 0 4px rgba(37, 99, 235, 0.8))' }}>
                    ⛵
                  </div>
                ) : (
                  <div
                    className="bg-primary-500 rounded-sm"
                    style={{
                      width: CELL_SIZE - 2,
                      height: CELL_SIZE - 2,
                      opacity: 0.7,
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Инструкции */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg max-w-md">
            <h3 className="font-semibold text-gray-900 mb-2">Управление:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>⬆️ Стрелка вверх - движение вверх</li>
              <li>⬇️ Стрелка вниз - движение вниз</li>
              <li>⬅️ Стрелка влево - движение влево</li>
              <li>➡️ Стрелка вправо - движение вправо</li>
            </ul>
            <p className="text-sm text-gray-600 mt-3">
              Соберите как можно больше очков, собирая русалок. Управляйте катером и избегайте столкновений со стенами и собой!
            </p>
          </div>

          {/* Кнопки управления для мобильных */}
          {isMobile && isPlaying && (
            <div className="mt-6 w-full max-w-xs">
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="flex flex-col items-center gap-2">
                  {/* Верхняя кнопка */}
                  <button
                    onClick={() => changeDirection({ x: 0, y: -1 })}
                    disabled={directionRef.current.y !== 0}
                    className="w-16 h-16 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md"
                  >
                    <ArrowUp className="h-6 w-6" />
                  </button>
                  
                  {/* Средний ряд */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => changeDirection({ x: -1, y: 0 })}
                      disabled={directionRef.current.x !== 0}
                      className="w-16 h-16 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md"
                    >
                      <ArrowLeft className="h-6 w-6" />
                    </button>
                    
                    <div className="w-16 h-16"></div>
                    
                    <button
                      onClick={() => changeDirection({ x: 1, y: 0 })}
                      disabled={directionRef.current.x !== 0}
                      className="w-16 h-16 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md"
                    >
                      <ArrowRight className="h-6 w-6" />
                    </button>
                  </div>
                  
                  {/* Нижняя кнопка */}
                  <button
                    onClick={() => changeDirection({ x: 0, y: 1 })}
                    disabled={directionRef.current.y !== 0}
                    className="w-16 h-16 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md"
                  >
                    <ArrowDown className="h-6 w-6" />
                  </button>
                </div>
                <p className="text-xs text-gray-600 text-center mt-3">
                  Или используйте свайпы на игровом поле
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
