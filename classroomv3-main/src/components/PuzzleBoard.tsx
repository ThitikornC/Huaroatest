import { useState, useEffect } from 'react'
import { useDrag, useDrop, useDragLayer } from 'react-dnd'
import { getEmptyImage } from 'react-dnd-html5-backend'
import { audioManager } from '../utils/audio'
import './PuzzleBoard.css'

interface PuzzlePiece {
  id: number
  correctPosition: number
  currentPosition: number // ตำแหน่งปัจจุบันในกระดาน (0-8) หรือ -1 ถ้าอยู่ในพื้นที่ชิ้นส่วน
  imageData: string
}

interface PuzzleBoardProps {
  imageUrl: string
  difficulty: 'easy' | 'medium' | 'hard'
  onComplete?: () => void
  onEvaluate?: () => void
}

const GRID_SIZE = {
  easy: 3,
  medium: 4,
  hard: 5
}

function PuzzleBoard({ imageUrl, difficulty, onComplete, onEvaluate }: PuzzleBoardProps) {
  const [pieces, setPieces] = useState<PuzzlePiece[]>([])
  const [showHint, setShowHint] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(null)
  const gridSize = GRID_SIZE[difficulty]

  useEffect(() => {
    sliceImage()
  }, [imageUrl, difficulty])

  const sliceImage = async () => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl
    
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      
      // คำนวณขนาดที่เป็นสี่เหลี่ยมจัตุรัส
      const size = Math.min(img.width, img.height)
      const offsetX = (img.width - size) / 2
      const offsetY = (img.height - size) / 2
      
      const pieceWidth = size / gridSize
      const pieceHeight = size / gridSize
      
      const newPieces: PuzzlePiece[] = []
      
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          canvas.width = pieceWidth
          canvas.height = pieceHeight
          
          // วาดชิ้นส่วนจากตรงกลางรูป (crop แบบสี่เหลี่ยมจัตุรัส)
          ctx.drawImage(
            img,
            offsetX + col * pieceWidth,
            offsetY + row * pieceHeight,
            pieceWidth,
            pieceHeight,
            0,
            0,
            pieceWidth,
            pieceHeight
          )
          
          const position = row * gridSize + col
          newPieces.push({
            id: position,
            correctPosition: position,
            currentPosition: -1, // เริ่มต้นอยู่ในพื้นที่ชิ้นส่วน
            imageData: canvas.toDataURL()
          })
        }
      }
      
      // Shuffle pieces
      const shuffled = [...newPieces].sort(() => Math.random() - 0.5)
      
      setPieces(shuffled)
      setIsComplete(false)
      setSelectedPieceId(null)
    }
  }

  // ย้ายชิ้นส่วนจากที่หนึ่งไปยังอีกที่หนึ่ง
  const movePiece = (pieceId: number, toPosition: number) => {
    setPieces(prevPieces => {
      const newPieces = [...prevPieces]
      const pieceIndex = newPieces.findIndex(p => p.id === pieceId)
      if (pieceIndex === -1) return prevPieces

      const piece = newPieces[pieceIndex]
      const fromPosition = piece.currentPosition

      // ตรวจสอบว่ามีชิ้นอื่นอยู่ที่ตำแหน่งปลายทางหรือไม่
      const targetPieceIndex = newPieces.findIndex(p => p.currentPosition === toPosition)

      if (targetPieceIndex !== -1) {
        // มีชิ้นอยู่แล้ว - สลับที่กัน
        newPieces[targetPieceIndex] = {
          ...newPieces[targetPieceIndex],
          currentPosition: fromPosition
        }
      }

      // ย้ายชิ้นไปตำแหน่งใหม่
      newPieces[pieceIndex] = {
        ...newPieces[pieceIndex],
        currentPosition: toPosition
      }

      // เล่นเสียง
      const isCorrect = newPieces[pieceIndex].correctPosition === toPosition
      if (toPosition !== -1) {
        // วางบนกระดาน
        if (isCorrect) {
          audioManager.playCorrect()
        } else {
          audioManager.playFail()
        }
      } else {
        // ลากกลับไปที่ถาด
        audioManager.playClick()
      }

      // ตรวจสอบความสำเร็จ
      const allCorrect = newPieces.every(p => 
        p.currentPosition === p.correctPosition
      )
      
      if (allCorrect) {
        // Call onComplete callback ก่อน เพื่อให้จับภาพก่อนแสดง modal
        if (onComplete) {
          onComplete()
        }
        
        setTimeout(() => {
          setIsComplete(true)
          audioManager.playEndgame()
        }, 300)
      }

      return newPieces
    })

    // Clear tap selection after a move
    setSelectedPieceId(null)
  }

  // นำชิ้นส่วนกลับไปพื้นที่
  const removePiece = (pieceId: number) => {
    setPieces(prevPieces => {
      const newPieces = [...prevPieces]
      const pieceIndex = newPieces.findIndex(p => p.id === pieceId)
      if (pieceIndex === -1) return prevPieces

      newPieces[pieceIndex] = {
        ...newPieces[pieceIndex],
        currentPosition: -1
      }

      audioManager.playClick()
      return newPieces
    })

    if (selectedPieceId === pieceId) {
      setSelectedPieceId(null)
    }
  }

  // หาชิ้นส่วนที่อยู่ในตำแหน่งนั้นๆ
  const getPieceAtPosition = (position: number): PuzzlePiece | undefined => {
    return pieces.find(p => p.currentPosition === position)
  }

  // หาชิ้นส่วนที่อยู่ในพื้นที่
  const getPiecesInTray = (): PuzzlePiece[] => {
    return pieces.filter(p => p.currentPosition === -1)
  }

  return (
    <div className="puzzle-board-container">
      <CustomDragLayer pieces={pieces} />
      <div className="puzzle-controls">
        <button
          className="hint-btn"
          onClick={() => {
            setShowHint(!showHint)
            audioManager.playClick()
          }}
        >
          {showHint ? '🔍 ซ่อนคำใบ้' : '💡 แสดงคำใบ้'}
        </button>
        
        <button
          className="shuffle-btn"
          onClick={() => {
            sliceImage()
            audioManager.playClick()
          }}
        >
          🔀 เริ่มใหม่
        </button>
      </div>

      <div className="puzzle-game-layout">
        {/* กระดานจิ๊กซอว์ */}
        <div 
          className="puzzle-grid"
          style={{ 
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            gridTemplateRows: `repeat(${gridSize}, 1fr)`
          }}
        >
          {Array.from({ length: gridSize * gridSize }).map((_, position) => {
            const piece = getPieceAtPosition(position)
            const isCorrect = piece?.correctPosition === position
            
            return (
              <PuzzleSlot
                key={position}
                position={position}
                piece={piece}
                movePiece={movePiece}
                removePiece={removePiece}
                showHint={showHint}
                isCorrect={isCorrect}
                selectedPieceId={selectedPieceId}
                setSelectedPieceId={setSelectedPieceId}
                getPieceById={(id) => pieces.find(p => p.id === id)}
              />
            )
          })}
        </div>

        {/* พื้นที่ชิ้นส่วน */}
        <div className="pieces-tray">
          <h3>🧩 ชิ้นส่วนจิ๊กซอว์</h3>
          <div className="pieces-grid">
            {getPiecesInTray().map((piece) => (
              <DraggablePiece
                key={piece.id}
                piece={piece}
                showHint={showHint}
                isSelected={selectedPieceId === piece.id}
                onSelect={(id) => setSelectedPieceId(id)}
              />
            ))}
          </div>
          {getPiecesInTray().length === 0 && (
            <p className="tray-empty">✅ วางชิ้นส่วนครบแล้ว!</p>
          )}
        </div>
      </div>

      {isComplete && (
        <div className="completion-overlay">
          <div className="completion-message bounce">
            <div className="completion-icon">🎉</div>
            <h2>ยินดีด้วย!</h2>
            <p>คุณต่อจิ๊กซอว์สำเร็จแล้ว! 🎊</p>
            <div className="completion-buttons">
              <button
                className="play-again-btn"
                onClick={() => {
                  sliceImage()
                  setIsComplete(false)
                }}
              >
                🔄 เล่นอีกครั้ง
              </button>
              {onEvaluate && (
                <button
                  className="evaluate-btn"
                  onClick={onEvaluate}
                >
                  📊 ประเมินผล
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Custom Drag Layer สำหรับแสดงรูปตอนลาก
interface CustomDragLayerProps {
  pieces: PuzzlePiece[]
}

function CustomDragLayer({ pieces }: CustomDragLayerProps) {
  const { isDragging, item, currentOffset } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
    item: monitor.getItem(),
    currentOffset: monitor.getSourceClientOffset()
  }))

  if (!isDragging || !currentOffset || !item) {
    return null
  }

  // หารูปชิ้นส่วนที่กำลังลาก
  const piece = pieces.find(p => p.id === item.pieceId)
  if (!piece) return null

  return (
    <div
      style={{
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: 9999,
        left: 0,
        top: 0,
        width: '100%',
        height: '100%'
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: currentOffset.x,
          top: currentOffset.y,
          transform: 'translate(-50%, -50%)',
          opacity: 0.8
        }}
      >
        <img
          src={piece.imageData}
          alt="Dragging piece"
          style={{
            width: '120px',
            height: '120px',
            objectFit: 'cover',
            borderRadius: '8px',
            boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
            border: '3px solid #667eea'
          }}
          draggable={false}
        />
      </div>
    </div>
  )
}

// ช่องในกระดานจิ๊กซอว์
interface PuzzleSlotProps {
  position: number
  piece: PuzzlePiece | undefined
  movePiece: (pieceId: number, toPosition: number) => void
  removePiece: (pieceId: number) => void
  showHint: boolean
  isCorrect: boolean
  selectedPieceId: number | null
  setSelectedPieceId: (id: number | null) => void
  getPieceById: (id: number) => PuzzlePiece | undefined
}

function PuzzleSlot({ position, piece, movePiece, removePiece, showHint, isCorrect, selectedPieceId, setSelectedPieceId, getPieceById }: PuzzleSlotProps) {
  const [hasWrongPiece, setHasWrongPiece] = useState(false)
  const isWrongPiece = !!piece && piece.correctPosition !== position
  
  // รับชิ้นส่วนที่ถูกลากมา
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'PUZZLE_PIECE',
    drop: (item: { pieceId: number; correctPosition: number }) => {
      // ตรวจสอบว่าวางถูกหรือผิด
      const isCorrectDrop = item.correctPosition === position
      
      if (isCorrectDrop) {
        // วางถูก - ปิดสีแดง
        setHasWrongPiece(false)
      } else {
        // วางผิด - เปิดสีแดงค้างไว้
        setHasWrongPiece(true)
      }
      
      movePiece(item.pieceId, position)
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  }), [position])

  // ทำให้ชิ้นที่อยู่ในช่องลากได้
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: 'PUZZLE_PIECE',
    item: piece ? { pieceId: piece.id, correctPosition: piece.correctPosition } : null,
    canDrag: () => piece !== undefined,
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }), [piece])

  // ซ่อน default preview image
  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true })
  }, [preview])

  const combinedRef = (node: HTMLDivElement | null) => {
    drag(node)
    drop(node)
  }

  // ถ้าไม่มีชิ้นแล้ว ปิดสีแดง
  useEffect(() => {
    if (!piece) {
      setHasWrongPiece(false)
      return
    }

    if (!isWrongPiece) {
      setHasWrongPiece(false)
    }
  }, [piece, isWrongPiece])

  return (
    <div
      ref={combinedRef}
      className={`board-slot ${isOver && canDrop ? 'drop-target' : ''} ${piece ? 'filled' : ''} ${isDragging ? 'dragging' : ''} ${isCorrect && showHint ? 'correct-hint' : ''} ${hasWrongPiece && piece ? 'wrong-drop' : ''} ${!piece && selectedPieceId !== null ? 'selected-target' : ''}`}
      onClick={() => {
        if (selectedPieceId !== null) {
          const selectedPiece = getPieceById(selectedPieceId)
          const willBeCorrect = selectedPiece ? selectedPiece.correctPosition === position : false
          setHasWrongPiece(!willBeCorrect)
          movePiece(selectedPieceId, position)
          setSelectedPieceId(null)
        } else if (piece) {
          removePiece(piece.id)
          setSelectedPieceId(null)
        } else {
          audioManager.playClick()
        }
      }}
    >
      {piece ? (
        <img
          src={piece.imageData}
          alt={`Piece ${piece.id}`}
          className={`placed-piece-image ${isWrongPiece ? 'wrong-piece' : ''}`}
          draggable={false}
        />
      ) : (
        <div className="empty-slot-content">
          {showHint && <div className="slot-hint-number">{position + 1}</div>}
        </div>
      )}
    </div>
  )
}

// ชิ้นส่วนที่ลากได้จากพื้นที่
interface DraggablePieceProps {
  piece: PuzzlePiece
  showHint: boolean
  isSelected: boolean
  onSelect: (id: number | null) => void
}

function DraggablePiece({ piece, showHint, isSelected, onSelect }: DraggablePieceProps) {
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: 'PUZZLE_PIECE',
    item: { pieceId: piece.id, correctPosition: piece.correctPosition },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }), [piece.id, piece.correctPosition])

  // ซ่อน default preview image
  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true })
  }, [preview])

  return (
    <div
      ref={drag}
      className={`draggable-piece ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(isSelected ? null : piece.id)}
    >
      <img
        src={piece.imageData}
        alt={`Piece ${piece.id}`}
        className="piece-image"
        draggable={false}
      />
      {showHint && (
        <div className="piece-number">{piece.correctPosition + 1}</div>
      )}
    </div>
  )
}

export default PuzzleBoard
