import { useState, useEffect, useCallback } from 'react'
import { audioManager } from '../utils/audio'
import { getPuzzleConfigs, getImagesByCategory } from '../services/storage'
import { defaultPuzzleImages } from '../config/defaultImages'

export interface PuzzleConfig {
  id: string
  name: string
  imageUrl: string
  difficulty: 'easy' | 'medium' | 'hard'
  createdAt?: string
}

export type DifficultyLevel = 'easy' | 'medium' | 'hard'

interface UsePuzzleReturn {
  difficulty: DifficultyLevel
  imageUrl: string
  started: boolean
  puzzleConfigs: PuzzleConfig[]
  selectedConfig: string
  isLoading: boolean
  error: string | null
  toast: { message: string; type: 'success' | 'error' | 'warning' } | null
  setDifficulty: (level: DifficultyLevel) => void
  handleImageUpload: (file: File | null, directUrl?: string) => Promise<void>
  handleConfigSelect: (configId: string) => void
  handleStart: () => void
  setStarted: (started: boolean) => void
  clearToast: () => void
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=600&h=400&fit=crop'

export const usePuzzle = (): UsePuzzleReturn => {
  const [difficulty, setDifficultyState] = useState<DifficultyLevel>('easy')
  const [imageUrl, setImageUrl] = useState<string>('')
  const [started, setStarted] = useState(false)
  const [puzzleConfigs, setPuzzleConfigs] = useState<PuzzleConfig[]>([])
  const [selectedConfig, setSelectedConfig] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null)

  useEffect(() => {
    // Load both teacher configs and default images
    const teacherConfigs = getPuzzleConfigs()
    const uploadedPuzzleImages = getImagesByCategory('puzzle')
    const defaultConfigs = defaultPuzzleImages.map(img => ({
      id: img.id,
      name: img.name,
      imageUrl: img.url,
      difficulty: 'easy' as DifficultyLevel,
      createdAt: new Date().toISOString()
    }))
    const uploadedConfigs = uploadedPuzzleImages.map(img => ({
      id: img.id,
      name: img.name,
      imageUrl: img.url,
      difficulty: 'easy' as DifficultyLevel,
      createdAt: img.uploadedAt
    }))
    setPuzzleConfigs([...defaultConfigs, ...uploadedConfigs, ...teacherConfigs])
  }, [])

  // Auto-clear toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type })
  }, [])

  const clearToast = useCallback(() => {
    setToast(null)
  }, [])

  const setDifficulty = useCallback((level: DifficultyLevel) => {
    setDifficultyState(level)
    audioManager.playClick()
  }, [])

  const validateImage = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, GIF, หรือ WEBP)'
    }
    if (file.size > MAX_FILE_SIZE) {
      return `ไฟล์ใหญ่เกินไป (สูงสุด ${MAX_FILE_SIZE / 1024 / 1024}MB)`
    }
    return null
  }

  const handleImageUpload = useCallback(async (file: File | null, directUrl?: string): Promise<void> => {
    setError(null)
    
    // ถ้ามี directUrl ให้ใช้เลย (สำหรับโหลดจากกิจกรรมที่บันทึก)
    if (directUrl) {
      setImageUrl(directUrl)
      setSelectedConfig('')
      return
    }
    
    // ต้องมี file ถ้าไม่มี directUrl
    if (!file) {
      return
    }
    
    // Validate file
    const validationError = validateImage(file)
    if (validationError) {
      setError(validationError)
      showToast(validationError, 'error')
      audioManager.playError?.()
      return
    }

    setIsLoading(true)
    
    try {
      // Read file as data URL
      const reader = new FileReader()
      
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = (event) => {
          const result = event.target?.result as string
          resolve(result)
        }
        reader.onerror = () => {
          reject(new Error('ไม่สามารถอ่านไฟล์ได้'))
        }
        reader.readAsDataURL(file)
      })

      // Validate image can be loaded
      await new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('ไฟล์รูปภาพไม่ถูกต้อง'))
        img.src = dataUrl
      })

      setImageUrl(dataUrl)
      setSelectedConfig('') // Clear config selection when uploading
      showToast('อัปโหลดรูปภาพสำเร็จ!', 'success')
      audioManager.playSuccess?.()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอัปโหลดรูป'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      audioManager.playError?.()
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  const handleConfigSelect = useCallback((configId: string) => {
    const config = puzzleConfigs.find(c => c.id === configId)
    if (config) {
      setSelectedConfig(configId)
      setImageUrl(config.imageUrl)
      setDifficultyState(config.difficulty)
      setError(null)
      audioManager.playClick()
      showToast(`เลือก "${config.name}" แล้ว`, 'success')
    }
  }, [puzzleConfigs, showToast])

  const handleStart = useCallback(() => {
    if (!imageUrl) {
      // Show warning and use default image
      showToast('ใช้รูปภาพตัวอย่าง', 'warning')
      setImageUrl(DEFAULT_IMAGE)
    }
    setStarted(true)
    audioManager.playClick()
  }, [imageUrl, showToast])

  return {
    difficulty,
    imageUrl,
    started,
    puzzleConfigs,
    selectedConfig,
    isLoading,
    error,
    toast,
    setDifficulty,
    handleImageUpload,
    handleConfigSelect,
    handleStart,
    setStarted,
    clearToast,
  }
}
