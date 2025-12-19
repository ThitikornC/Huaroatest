import { useRef, useState, useEffect } from 'react'
import { Stage, Layer, Line, Image as KonvaImage } from 'react-konva'
import Toolbox from '../../components/Toolbox'
import { audioManager } from '../../utils/audio'
import { getImages } from '../../services/storage'
import { defaultColoringImages } from '../../config/defaultImages'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import './PlayColoring.css'

interface LineData {
  points: number[]
  stroke: string
  strokeWidth: number
  isEraser?: boolean
}

function PlayColoring() {
  const [lines, setLines] = useState<LineData[]>([])
  const [currentColor, setCurrentColor] = useState('#FF6B6B')
  const [brushSize, setBrushSize] = useState(10)
  const [isDrawing, setIsDrawing] = useState(false)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  // Multi-touch support: เก็บเส้นที่กำลังวาดแยกตาม touch ID
  const activeLines = useRef<Map<number, number>>(new Map()) // touchId -> lineIndex
  const [showOutline, setShowOutline] = useState(true)
  const [isEraser, setIsEraser] = useState(false)
  const [coloringImages, setColoringImages] = useState<any[]>([])
  const [isStarted, setIsStarted] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
  const [isMusicPlaying, setIsMusicPlaying] = useState(true)
  const stageRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Activity form data
  const [weekNumber, setWeekNumber] = useState('')
  const [learningSubject, setLearningSubject] = useState('')
  const [learningUnit, setLearningUnit] = useState('')
  const [responsibleTeacher, setResponsibleTeacher] = useState('')
  const [testerName, setTesterName] = useState('')
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [savedActivities, setSavedActivities] = useState<any[]>([])
  const [showActivityList, setShowActivityList] = useState(false)
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null)
  
  // Evaluation states
  const [showEvaluation, setShowEvaluation] = useState(false)
  const [evaluation, setEvaluation] = useState({
    creativity: 5,
    colorChoice: 5,
    neatness: 5,
    completeness: 5
  })

  useEffect(() => {
    // Load images from teacher and default images
    const teacherImages = getImages().filter(img => img.category === 'coloring')
    const allImages = [...defaultColoringImages, ...teacherImages]
    setColoringImages(allImages)
  }, [])

  // Calculate responsive canvas size - รองรับทุกอุปกรณ์รวม Smart TV
  useEffect(() => {
    const updateCanvasSize = () => {
      if (!isStarted) return
      
      // Get actual viewport dimensions
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // Reserve space for UI elements
      const headerHeight = 100
      const paddingSpace = 60
      
      // Calculate available space
      const availableWidth = viewportWidth - paddingSpace
      const availableHeight = viewportHeight - headerHeight - 80
      
      // Dynamic max size based on screen resolution
      let maxWidth: number
      let maxHeight: number
      
      // Smart TV / 4K Displays (>= 1920px)
      if (viewportWidth >= 1920) {
        // ใช้พื้นที่ 70% ของหน้าจอ แต่ไม่เกิน 1800px
        maxWidth = Math.min(availableWidth * 0.7, 1800)
        maxHeight = Math.min(availableHeight * 0.85, 1200)
      }
      // Large Desktop (1600-1919px)
      else if (viewportWidth >= 1600) {
        maxWidth = Math.min(availableWidth * 0.75, 1400)
        maxHeight = Math.min(availableHeight * 0.85, 1000)
      }
      // Desktop (1200-1599px)
      else if (viewportWidth >= 1200) {
        maxWidth = Math.min(availableWidth * 0.8, 1100)
        maxHeight = Math.min(availableHeight * 0.85, 850)
      }
      // Tablet Landscape / Small Desktop (900-1199px)
      else if (viewportWidth >= 900) {
        maxWidth = Math.min(availableWidth * 0.85, 850)
        maxHeight = Math.min(availableHeight * 0.85, 700)
      }
      // Tablet Portrait (768-899px)
      else if (viewportWidth >= 768) {
        maxWidth = availableWidth * 0.9
        maxHeight = availableHeight * 0.8
      }
      // Mobile (< 768px)
      else {
        maxWidth = availableWidth
        maxHeight = availableHeight * 0.75
      }
      
      // Ensure minimum usable size
      const minDimension = viewportWidth >= 1920 ? 600 : 300
      maxWidth = Math.max(maxWidth, minDimension)
      maxHeight = Math.max(maxHeight, minDimension)
      
      // Calculate final canvas size
      if (image) {
        // Maintain image aspect ratio
        const imgRatio = image.width / image.height
        const maxRatio = maxWidth / maxHeight
        
        let newWidth: number, newHeight: number
        
        if (imgRatio > maxRatio) {
          // Wider image - fit to width
          newWidth = maxWidth
          newHeight = maxWidth / imgRatio
        } else {
          // Taller image - fit to height
          newHeight = maxHeight
          newWidth = maxHeight * imgRatio
        }
        
        // Ensure not too small on large screens
        if (viewportWidth >= 1920) {
          const minSize = 700
          if (newWidth < minSize || newHeight < minSize) {
            const scale = minSize / Math.min(newWidth, newHeight)
            newWidth *= scale
            newHeight *= scale
          }
        }
        
        setCanvasSize({ 
          width: Math.floor(newWidth), 
          height: Math.floor(newHeight) 
        })
      } else {
        // Blank canvas - use 4:3 aspect ratio
        const ratio = 4 / 3
        let newWidth = maxWidth
        let newHeight = maxWidth / ratio
        
        if (newHeight > maxHeight) {
          newHeight = maxHeight
          newWidth = maxHeight * ratio
        }
        
        setCanvasSize({ 
          width: Math.floor(newWidth), 
          height: Math.floor(newHeight) 
        })
      }
    }
    
    // Initial size calculation
    updateCanvasSize()
    
    // Update on window resize
    window.addEventListener('resize', updateCanvasSize)
    window.addEventListener('orientationchange', updateCanvasSize)
    
    // Delayed recalculation for DOM rendering
    const timer = setTimeout(updateCanvasSize, 150)
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize)
      window.removeEventListener('orientationchange', updateCanvasSize)
      clearTimeout(timer)
    }
  }, [isStarted, image])

  // Play/Pause background music
  useEffect(() => {
    if (isStarted) {
      audioManager.playBackgroundMusic()
    } else {
      audioManager.pauseBackgroundMusic()
    }

    return () => {
      audioManager.pauseBackgroundMusic()
    }
  }, [isStarted])

  // Mouse handlers (single touch)
  const handleMouseDown = (e: any) => {
    setIsDrawing(true)
    const pos = e.target.getStage().getPointerPosition()
    const size = isEraser ? brushSize * 2 : brushSize
    const newLine = { 
      points: [pos.x, pos.y], 
      stroke: currentColor, 
      strokeWidth: size,
      isEraser: isEraser
    }
    setLines(prev => {
      activeLines.current.set(0, prev.length) // Mouse ใช้ ID = 0
      return [...prev, newLine]
    })
    audioManager.playClick()
  }

  const handleMouseMove = (e: any) => {
    if (!isDrawing) return

    const stage = e.target.getStage()
    const point = stage.getPointerPosition()
    const lineIndex = activeLines.current.get(0)
    
    if (lineIndex !== undefined) {
      setLines(prev => {
        const newLines = [...prev]
        if (newLines[lineIndex]) {
          newLines[lineIndex] = {
            ...newLines[lineIndex],
            points: [...newLines[lineIndex].points, point.x, point.y]
          }
        }
        return newLines
      })
    }
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
    activeLines.current.delete(0)
  }

  // Multi-touch handlers - วาดหลายนิ้วพร้อมกัน! 🎨
  const handleTouchStart = (e: any) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    const touches = e.evt.changedTouches
    
    setLines(prev => {
      const newLines = [...prev]
      
      for (let i = 0; i < touches.length; i++) {
        const touch = touches[i]
        const pos = stage.getPointerPosition(touch)
        if (!pos) continue
        
        const size = isEraser ? brushSize * 2 : brushSize
        const newLine = {
          points: [pos.x, pos.y],
          stroke: currentColor,
          strokeWidth: size,
          isEraser: isEraser
        }
        
        activeLines.current.set(touch.identifier, newLines.length)
        newLines.push(newLine)
      }
      
      return newLines
    })
    
    setIsDrawing(true)
    audioManager.playClick()
  }

  const handleTouchMove = (e: any) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    const touches = e.evt.changedTouches
    
    setLines(prev => {
      const newLines = [...prev]
      
      for (let i = 0; i < touches.length; i++) {
        const touch = touches[i]
        const lineIndex = activeLines.current.get(touch.identifier)
        
        if (lineIndex !== undefined && newLines[lineIndex]) {
          const pos = stage.getPointerPosition(touch)
          if (!pos) continue
          
          newLines[lineIndex] = {
            ...newLines[lineIndex],
            points: [...newLines[lineIndex].points, pos.x, pos.y]
          }
        }
      }
      
      return newLines
    })
  }

  const handleTouchEnd = (e: any) => {
    const touches = e.evt.changedTouches
    
    for (let i = 0; i < touches.length; i++) {
      activeLines.current.delete(touches[i].identifier)
    }
    
    if (activeLines.current.size === 0) {
      setIsDrawing(false)
    }
  }

  const handleUndo = () => {
    if (lines.length > 0) {
      setLines(lines.slice(0, -1))
      audioManager.playClick()
    }
  }

  const handleClear = () => {
    setLines([])
    audioManager.playClick()
  }

  const handleSave = () => {
    // แทนที่การบันทึกแบบเดิม ให้เปิดฟอร์มประเมิน
    setShowEvaluation(true)
    audioManager.playClick()
  }

  const handleExportPDF = async () => {
    if (!stageRef.current) return

    try {
      // 1. บันทึกภาพผลงานจาก canvas
      const artworkDataUrl = stageRef.current.toDataURL()

      // 2. คำนวณคะแนนรวม
      const totalScore = evaluation.creativity + evaluation.colorChoice + 
                        evaluation.neatness + evaluation.completeness
      const averageScore = (totalScore / 4).toFixed(1)

      // 3. สร้าง HTML template สำหรับแปลงเป็น PDF (รองรับภาษาไทย - จัดให้พอดี 1 หน้า)
      const reportElement = document.createElement('div')
      reportElement.style.cssText = `
        width: 794px;
        background: white;
        padding: 25px 30px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        position: absolute;
        left: -9999px;
        top: 0;
      `

      reportElement.innerHTML = `
        <div style="background: linear-gradient(135deg, #FF6B9D 0%, #FFC75F 100%); padding: 18px; border-radius: 12px; text-align: center; margin-bottom: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
          <h1 style="color: white; margin: 0 0 6px 0; font-size: 26px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">🎨 แบบประเมินกิจกรรมระบายสี</h1>
          <p style="color: white; margin: 0; font-size: 13px; opacity: 0.95;">Coloring Activity Evaluation Report</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; border: 2px solid #e9ecef;">
            <h2 style="color: #667eea; margin: 0 0 10px 0; font-size: 15px; border-bottom: 2px solid #667eea; padding-bottom: 6px;">📋 ข้อมูลกิจกรรม</h2>
            <p style="margin: 4px 0; color: #495057; font-size: 12px;"><strong>สัปดาห์ที่:</strong> ${weekNumber || '-'}</p>
            <p style="margin: 4px 0; color: #495057; font-size: 12px;"><strong>สาระการเรียนรู้:</strong> ${learningSubject || '-'}</p>
            <p style="margin: 4px 0; color: #495057; font-size: 12px;"><strong>หน่วยการเรียนรู้:</strong> ${learningUnit || '-'}</p>
            <p style="margin: 4px 0; color: #495057; font-size: 12px;"><strong>ครูผู้รับผิดชอบ:</strong> ${responsibleTeacher || '-'}</p>
            <p style="margin: 4px 0; color: #495057; font-size: 12px;"><strong>ผู้ทดสอบ:</strong> ${testerName || '-'}</p>
            <p style="margin: 4px 0; color: #495057; font-size: 12px;"><strong>วันที่:</strong> ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; border: 2px solid #e9ecef;">
            <h2 style="color: #667eea; margin: 0 0 10px 0; font-size: 15px; border-bottom: 2px solid #667eea; padding-bottom: 6px;">📊 การประเมิน</h2>
            ${[
              { label: 'ความคิดสร้างสรรค์', score: evaluation.creativity },
              { label: 'การเลือกใช้สี', score: evaluation.colorChoice },
              { label: 'ความเรียบร้อย', score: evaluation.neatness },
              { label: 'ความสมบูรณ์', score: evaluation.completeness }
            ].map(item => {
              const percentage = (item.score / 5) * 100
              const color = item.score >= 4 ? '#4CAF50' : item.score >= 3 ? '#FFC107' : '#f44336'
              return `
                <div style="margin-bottom: 8px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span style="font-weight: 600; color: #333; font-size: 11px;">${item.label}</span>
                    <span style="font-weight: 700; color: ${color}; font-size: 12px;">${item.score}/5</span>
                  </div>
                  <div style="background: #e9ecef; height: 18px; border-radius: 9px; overflow: hidden;">
                    <div style="background: ${color}; width: ${percentage}%; height: 100%; display: flex; align-items: center; justify-content: flex-end; padding-right: 6px;">
                      <span style="color: white; font-size: 10px; font-weight: 600;">${percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              `
            }).join('')}
            
            <div style="background: linear-gradient(135deg, #FF6B9D 0%, #FFC75F 100%); padding: 12px; border-radius: 10px; margin-top: 12px; text-align: center; box-shadow: 0 3px 10px rgba(255,107,157,0.3);">
              <span style="color: white; font-size: 13px; font-weight: 600;">คะแนนเฉลี่ย: </span>
              <span style="color: white; font-size: 24px; font-weight: 700; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">${averageScore}/5</span>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 15px;">
          <h2 style="color: #667eea; margin: 0 0 10px 0; font-size: 16px; border-bottom: 2px solid #667eea; padding-bottom: 6px;">🖼️ ผลงานนักเรียน</h2>
          <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 12px; border: 2px solid #e9ecef;">
            <img src="${artworkDataUrl}" style="max-width: 100%; max-height: 400px; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
          </div>
        </div>

        <div style="margin-top: 15px; padding-top: 15px; border-top: 2px dashed #dee2e6;">
          <div style="text-align: center;">
            <p style="margin: 0 0 5px 0; color: #333; font-size: 11px;">ลงชื่อ ..............................................</p>
            <p style="margin: 0 0 15px 0; color: #6c757d; font-size: 10px;">ครูผู้รับผิดชอบ</p>
            <p style="margin: 0; color: #333; font-size: 11px;">( ${responsibleTeacher || '............................................'} )</p>
          </div>
        </div>

        <div style="text-align: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid #dee2e6;">
          <p style="margin: 0; color: #adb5bd; font-size: 9px;">สร้างโดยระบบ Classroom Games | ${new Date().toLocaleString('th-TH')}</p>
        </div>
      `

      document.body.appendChild(reportElement)

      document.body.appendChild(reportElement)

      // 4. แปลง HTML เป็นรูปภาพด้วย html2canvas
      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })

      // 5. ลบ element ออกจาก DOM
      document.body.removeChild(reportElement)

      // 6. สร้าง PDF และใส่รูปภาพ
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      
      // คำนวณขนาดรูปให้พอดีกับหน้า A4
      const imgWidth = pdfWidth
      const imgHeight = (canvas.height * pdfWidth) / canvas.width
      
      // ถ้ารูปสูงเกินหน้า A4 ให้แบ่งเป็นหลายหน้า
      if (imgHeight > pdfHeight) {
        let heightLeft = imgHeight
        let position = 0
        
        // หน้าแรก
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pdfHeight
        
        // หน้าถัดไป
        while (heightLeft > 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
          heightLeft -= pdfHeight
        }
      } else {
        // ใส่รูปลงในหน้าเดียว
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      }

      // 7. บันทึกไฟล์
      const fileName = `แบบประเมินระบายสี-สัปดาห์${weekNumber || 'X'}-${Date.now()}.pdf`
      pdf.save(fileName)

      audioManager.playSuccess()
      alert('ส่งออก PDF เรียบร้อย! 🎉')
      setShowEvaluation(false)
      
      // รีเซ็ตฟอร์มประเมิน
      setEvaluation({
        creativity: 5,
        colorChoice: 5,
        neatness: 5,
        completeness: 5
      })

    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('เกิดข้อผิดพลาดในการส่งออก PDF กรุณาลองใหม่อีกครั้ง')
    }
  }

  const toggleMusic = () => {
    const isPlaying = audioManager.toggleBackgroundMusic()
    setIsMusicPlaying(isPlaying)
    audioManager.playClick()
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string
        setSelectedImageUrl(imageUrl)
        audioManager.playClick()
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSelectImage = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl)
    audioManager.playClick()
  }

  const handleSaveActivity = () => {
    // ถ้าอยู่ในโหมดแก้ไข
    if (editingActivityId) {
      handleUpdateActivity()
      return
    }

    if (!selectedImageUrl) {
      alert('กรุณาเลือกรูปภาพก่อน!')
      return
    }

    const newActivity = {
      id: Date.now(),
      weekNumber,
      learningSubject,
      learningUnit,
      responsibleTeacher,
      testerName,
      imageUrl: selectedImageUrl,
      createdAt: new Date().toLocaleString('th-TH')
    }

    setSavedActivities(prev => [...prev, newActivity])
    audioManager.playSuccess()
    alert('บันทึกกิจกรรมเรียบร้อย!')
  }

  const handleLoadActivity = (activity: any) => {
    setWeekNumber(activity.weekNumber)
    setLearningSubject(activity.learningSubject)
    setLearningUnit(activity.learningUnit)
    setResponsibleTeacher(activity.responsibleTeacher)
    setTesterName(activity.testerName || '')
    setSelectedImageUrl(activity.imageUrl)
    setShowActivityList(false)
    audioManager.playClick()
    alert('โหลดกิจกรรมเรียบร้อย!')
  }

  const handleDeleteActivity = (activityId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('ต้องการลบกิจกรรมนี้?')) return
    
    const updated = savedActivities.filter(a => a.id !== activityId)
    setSavedActivities(updated)
    localStorage.setItem('coloringActivities', JSON.stringify(updated))
    audioManager.playClick()
  }

  const handleEditActivity = (activity: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingActivityId(activity.id)
    handleLoadActivity(activity)
  }

  const handleUpdateActivity = () => {
    if (!editingActivityId) return
    if (!selectedImageUrl) {
      alert('กรุณาเลือกรูปภาพก่อน!')
      return
    }

    const updated = savedActivities.map(a => 
      a.id === editingActivityId ? {
        ...a,
        weekNumber,
        learningSubject,
        learningUnit,
        responsibleTeacher,
        testerName,
        imageUrl: selectedImageUrl,
      } : a
    )

    setSavedActivities(updated)
    localStorage.setItem('coloringActivities', JSON.stringify(updated))
    setEditingActivityId(null)
    audioManager.playSuccess()
    alert('อัปเดตกิจกรรมสำเร็จ!')
  }

  const handleStartActivity = () => {
    if (!selectedImageUrl) {
      alert('กรุณาเลือกรูปภาพก่อนเริ่มกิจกรรม!')
      return
    }

    const img = new window.Image()
    img.src = selectedImageUrl
    img.onload = () => {
      setImage(img)
      setLines([])
      setIsStarted(true)
      audioManager.playClick()
    }
  }

  if (!isStarted) {
    return (
      <div className="coloring-page">
        <div className="coloring-header">
          <h1>🎨 ระบายสี</h1>
          <button className="back-btn" onClick={() => window.history.back()}>
            ← กลับ
          </button>
        </div>

        <div className="coloring-setup">
          {/* Activity Form - Combined with Tester */}
          <div className="activity-form">
            <h2 className="form-title">📝 กรอกข้อมูลกิจกรรม</h2>
            <div className="form-row">
              <div className="form-field">
                <label>สัปดาห์ที่</label>
                <input 
                  type="text" 
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(e.target.value)}
                  placeholder="กรอกสัปดาห์ที่..."
                />
              </div>
              <div className="form-field">
                <label>สาระการเรียนรู้</label>
                <input 
                  type="text" 
                  value={learningSubject}
                  onChange={(e) => setLearningSubject(e.target.value)}
                  placeholder="กรอกสาระการเรียนรู้..."
                />
              </div>
              <div className="form-field">
                <label>หน่วยการเรียนรู้</label>
                <input 
                  type="text" 
                  value={learningUnit}
                  onChange={(e) => setLearningUnit(e.target.value)}
                  placeholder="กรอกหน่วยการเรียนรู้..."
                />
              </div>
              <div className="form-field">
                <label>ครูผู้รับผิดชอบ</label>
                <input 
                  type="text" 
                  value={responsibleTeacher}
                  onChange={(e) => setResponsibleTeacher(e.target.value)}
                  placeholder="กรอกชื่อครู..."
                />
              </div>
            </div>

            {/* Tester Name - Inside same box */}
            <div className="tester-section-inline">
              <div className="form-field-tester">
                <label>ผู้ทดสอบ</label>
                <input 
                  type="text" 
                  value={testerName}
                  onChange={(e) => setTesterName(e.target.value)}
                  placeholder="กรอกชื่อผู้ทดสอบ..."
                />
              </div>
            </div>
          </div>

          {/* Image Selection Section */}
          <div className="setup-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>🖼️ เลือกรูป</h2>
              <span style={{ color: '#999', fontSize: '0.9rem' }}>👆 เลื่อนดูรูปเพิ่ม →</span>
            </div>
            <div className="image-gallery">
              {/* กระดาษเปล่า - การ์ดแรก */}
              <div 
                className={`gallery-item blank-paper-item ${selectedImageUrl === 'blank' ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedImageUrl('blank')
                  audioManager.playClick()
                }}
              >
                <div className="blank-paper-preview">
                  <span style={{ fontSize: '4rem' }}>📄</span>
                </div>
                <span>กระดาษเปล่า</span>
              </div>

              {/* Upload Image Card */}
              <div className="gallery-item upload-item">
                <label htmlFor="image-upload" className="upload-label">
                  <div className="upload-preview">
                    <span style={{ fontSize: '4rem' }}>📤</span>
                  </div>
                  <span className="upload-text">เพิ่มรูปภาพ</span>
                </label>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </div>

              {/* รูปจากครู */}
              {coloringImages.map(img => (
                <div 
                  key={img.id} 
                  className={`gallery-item ${selectedImageUrl === img.url ? 'selected' : ''}`}
                  onClick={() => handleSelectImage(img.url)}
                >
                  <img src={img.url} alt={img.name} />
                  <span>{img.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons - 3 buttons */}
          <div className="action-buttons">
            <button 
              className={`action-btn start-btn ${!selectedImageUrl ? 'disabled' : ''}`}
              onClick={handleStartActivity}
              disabled={!selectedImageUrl}
              title={!selectedImageUrl ? 'กรุณาเลือกรูปก่อน' : 'เริ่มกิจกรรม'}
            >
              เริ่มกิจกรรม
            </button>
            <button 
              className="action-btn save-btn"
              onClick={handleSaveActivity}
              title={editingActivityId ? "อัปเดตกิจกรรม" : "บันทึกรูปและข้อมูลกิจกรรม"}
            >
              {editingActivityId ? 'อัปเดตกิจกรรม' : 'บันทึกกิจกรรม'}
            </button>
            {editingActivityId && (
              <button 
                className="action-btn cancel-btn"
                onClick={() => {
                  setEditingActivityId(null)
                  setWeekNumber('')
                  setLearningSubject('')
                  setLearningUnit('')
                  setResponsibleTeacher('')
                  setTesterName('')
                  audioManager.playClick()
                }}
                title="ยกเลิกการแก้ไข"
              >
                ✕ ยกเลิก
              </button>
            )}
            <button 
              className="action-btn select-btn"
              onClick={() => setShowActivityList(true)}
              title="เลือกจากกิจกรรมที่บันทึกไว้"
            >
              เลือกกิจกรรม
            </button>
          </div>
        </div>

        {/* Activity List Modal */}
        {showActivityList && (
          <div className="modal-overlay" onClick={() => setShowActivityList(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>กิจกรรมที่บันทึกไว้</h2>
              <button className="close-btn" onClick={() => setShowActivityList(false)}>✕</button>
              
              {savedActivities.length === 0 ? (
                <p className="no-data">ยังไม่มีกิจกรรมที่บันทึกไว้</p>
              ) : (
                <div className="activity-list">
                  {savedActivities.map(activity => (
                    <div 
                      key={activity.id} 
                      className="activity-item"
                      onClick={() => handleLoadActivity(activity)}
                    >
                      <img src={activity.imageUrl} alt="รูปกิจกรรม" />
                      <div className="activity-info">
                        <h3>สัปดาห์ที่ {activity.weekNumber}</h3>
                        <p><strong>สาระ:</strong> {activity.learningSubject || '-'}</p>
                        <p><strong>หน่วย:</strong> {activity.learningUnit || '-'}</p>
                        <p><strong>ครู:</strong> {activity.responsibleTeacher || '-'}</p>
                        {activity.testerName && <p><strong>ผู้ทดสอบ:</strong> {activity.testerName}</p>}
                        <p className="date">{activity.createdAt}</p>
                      </div>
                      <div className="activity-actions">
                        <button 
                          className="edit-activity-btn"
                          onClick={(e) => handleEditActivity(activity, e)}
                          title="แก้ไขกิจกรรม"
                        >
                          ✏️
                        </button>
                        <button 
                          className="delete-activity-btn"
                          onClick={(e) => handleDeleteActivity(activity.id, e)}
                          title="ลบกิจกรรม"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="coloring-page">
      <div className="coloring-header">
        <h1>🎨 ระบายสี</h1>
        <div className="header-actions">
          <button className="music-btn" onClick={toggleMusic} title={isMusicPlaying ? 'ปิดเสียง' : 'เปิดเสียง'}>
            {isMusicPlaying ? '🔊' : '🔇'}
          </button>
          <button className="change-image-btn" onClick={() => setIsStarted(false)}>
            🖼️ เปลี่ยนรูป
          </button>
          <button className="back-btn" onClick={() => window.history.back()}>
            ← กลับ
          </button>
        </div>
      </div>

      <div className="coloring-container" ref={containerRef}>
        <Toolbox
          currentColor={currentColor}
          onColorChange={setCurrentColor}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
          onUndo={handleUndo}
          onClear={handleClear}
          onSave={handleSave}
          showOutline={showOutline}
          onToggleOutline={() => setShowOutline(!showOutline)}
          isEraser={isEraser}
          onToggleEraser={() => setIsEraser(!isEraser)}
        />

        <div className="canvas-wrapper">
          <Stage
            width={canvasSize.width}
            height={canvasSize.height}
            onMouseDown={handleMouseDown}
            onMousemove={handleMouseMove}
            onMouseup={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            ref={stageRef}
            className="drawing-stage"
          >
            {/* Layer 1: รูปพื้นหลัง (ไม่ถูกลบ) */}
            <Layer>
              {image && showOutline && (
                <KonvaImage
                  image={image}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  opacity={0.3}
                />
              )}
            </Layer>
            
            {/* Layer 2: เส้นวาด (ลบได้) */}
            <Layer>
              {lines.map((line, i) => (
                <Line
                  key={i}
                  points={line.points}
                  stroke={line.isEraser ? 'white' : line.stroke}
                  strokeWidth={line.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={line.isEraser ? 'destination-out' : 'source-over'}
                />
              ))}
            </Layer>
          </Stage>
        </div>
      </div>

      <div className="mascot">
        <div className="mascot-avatar">🦊</div>
        <div className="mascot-speech">วาดสวย ๆ นะ!</div>
      </div>

      {/* Evaluation Modal */}
      {showEvaluation && (
        <div className="modal-overlay evaluation-modal">
          <div className="modal-content evaluation-content">
            <h2>ประเมินผลงาน</h2>
            <button className="close-btn" onClick={() => setShowEvaluation(false)}>✕</button>
            
            <div className="evaluation-form">
              <div className="evaluation-item">
                <label>ความคิดสร้างสรรค์ (Creativity)</label>
                <div className="score-selector">
                  {[1, 2, 3, 4, 5].map(score => (
                    <button
                      key={score}
                      className={`score-btn ${evaluation.creativity === score ? 'active' : ''}`}
                      onClick={() => setEvaluation(prev => ({ ...prev, creativity: score }))}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              <div className="evaluation-item">
                <label>การเลือกใช้สี (Color Choice)</label>
                <div className="score-selector">
                  {[1, 2, 3, 4, 5].map(score => (
                    <button
                      key={score}
                      className={`score-btn ${evaluation.colorChoice === score ? 'active' : ''}`}
                      onClick={() => setEvaluation(prev => ({ ...prev, colorChoice: score }))}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              <div className="evaluation-item">
                <label>ความเรียบร้อย (Neatness)</label>
                <div className="score-selector">
                  {[1, 2, 3, 4, 5].map(score => (
                    <button
                      key={score}
                      className={`score-btn ${evaluation.neatness === score ? 'active' : ''}`}
                      onClick={() => setEvaluation(prev => ({ ...prev, neatness: score }))}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              <div className="evaluation-item">
                <label>ความสมบูรณ์ (Completeness)</label>
                <div className="score-selector">
                  {[1, 2, 3, 4, 5].map(score => (
                    <button
                      key={score}
                      className={`score-btn ${evaluation.completeness === score ? 'active' : ''}`}
                      onClick={() => setEvaluation(prev => ({ ...prev, completeness: score }))}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              <div className="evaluation-summary">
                <div className="total-score">
                  <span>คะแนนเฉลี่ย:</span>
                  <span className="score-value">
                    {((evaluation.creativity + evaluation.colorChoice + evaluation.neatness + evaluation.completeness) / 4).toFixed(1)} / 5
                  </span>
                </div>
              </div>

              <div className="evaluation-actions">
                <button className="cancel-eval-btn" onClick={() => setShowEvaluation(false)}>
                  ยกเลิก
                </button>
                <button className="export-pdf-btn" onClick={handleExportPDF}>
                  📄 ส่งออก PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PlayColoring
