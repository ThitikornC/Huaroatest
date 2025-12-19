import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { MouseTransition, TouchTransition } from 'react-dnd-multi-backend'
import { MultiBackend } from 'react-dnd-multi-backend'
import { useEffect, useState } from 'react'
import PuzzleBoard from '../../components/PuzzleBoard'
import { usePuzzle } from '../../hooks/usePuzzle'
import { audioManager } from '../../utils/audio'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import './PlayPuzzle.css'

// Multi-backend configuration สำหรับรองรับทั้งเมาส์และทัช
const HTML5toTouch = {
  backends: [
    {
      id: 'html5',
      backend: HTML5Backend,
      transition: MouseTransition,
    },
    {
      id: 'touch',
      backend: TouchBackend,
      options: { 
        enableMouseEvents: true,
        delayTouchStart: 200,
        ignoreContextMenu: true
      },
      preview: true,
      transition: TouchTransition,
    },
  ],
}

function PlayPuzzle() {
  const [isMusicPlaying, setIsMusicPlaying] = useState(true)
  const {
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
  } = usePuzzle()

  // Activity form data
  const [weekNumber, setWeekNumber] = useState('')
  const [learningSubject, setLearningSubject] = useState('')
  const [learningUnit, setLearningUnit] = useState('')
  const [responsibleTeacher, setResponsibleTeacher] = useState('')
  const [testerName, setTesterName] = useState('')
  const [savedActivities, setSavedActivities] = useState<any[]>([])
  const [showActivityList, setShowActivityList] = useState(false)
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null)
  
  // Evaluation states
  const [showEvaluation, setShowEvaluation] = useState(false)
  const [puzzleCompletedImage, setPuzzleCompletedImage] = useState<string | null>(null)
  const [evaluation, setEvaluation] = useState({
    attention: 5,
    carefulness: 5,
    neatness: 5,
    completeness: 5
  })

  // เล่นเพลง background เมื่อเริ่มเกม
  useEffect(() => {
    if (started) {
      audioManager.playBackgroundMusic()
    } else {
      audioManager.pauseBackgroundMusic()
    }

    // Cleanup: หยุดเพลงเมื่อออกจากหน้านี้
    return () => {
      audioManager.pauseBackgroundMusic()
    }
  }, [started])

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await handleImageUpload(file, undefined)
    }
  }

  const handleMusicToggle = () => {
    const isPlaying = audioManager.toggleBackgroundMusic()
    setIsMusicPlaying(isPlaying)
    audioManager.playClick()
  }

  const handleSaveActivity = () => {
    // ถ้าอยู่ในโหมดแก้ไข ให้ใช้ handleUpdateActivity แทน
    if (editingActivityId) {
      handleUpdateActivity()
      return
    }

    if (!imageUrl) {
      alert('กรุณาเลือกรูปก่อนบันทึก')
      return
    }
    if (!weekNumber) {
      alert('กรุณากรอกสัปดาห์ที่')
      return
    }

    const newActivity = {
      id: Date.now(),
      weekNumber,
      learningSubject,
      learningUnit,
      responsibleTeacher,
      testerName,
      imageUrl,
      difficulty,
      selectedConfig: selectedConfig || null,
    }

    const updated = [...savedActivities, newActivity]
    setSavedActivities(updated)
    localStorage.setItem('puzzleActivities', JSON.stringify(updated))
    alert('บันทึกกิจกรรมสำเร็จ!')
    audioManager.playClick()
  }

  const handleLoadActivity = (activity: any) => {
    setWeekNumber(activity.weekNumber || '')
    setLearningSubject(activity.learningSubject || '')
    setLearningUnit(activity.learningUnit || '')
    setResponsibleTeacher(activity.responsibleTeacher || '')
    setTesterName(activity.testerName || '')
    setDifficulty(activity.difficulty || 'easy')
    
    // โหลดรูปภาพ - ถ้ามี selectedConfig ให้ใช้ config แทน
    if (activity.selectedConfig) {
      handleConfigSelect(activity.selectedConfig)
    } else if (activity.imageUrl) {
      handleImageUpload(null, activity.imageUrl)
    }
    
    setShowActivityList(false)
    audioManager.playClick()
  }

  const handleDeleteActivity = (activityId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('ต้องการลบกิจกรรมนี้?')) return
    
    const updated = savedActivities.filter(a => a.id !== activityId)
    setSavedActivities(updated)
    localStorage.setItem('puzzleActivities', JSON.stringify(updated))
    audioManager.playClick()
  }

  const handleEditActivity = (activity: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingActivityId(activity.id)
    handleLoadActivity(activity)
  }

  const handleUpdateActivity = () => {
    if (!editingActivityId) return
    if (!imageUrl) {
      alert('กรุณาเลือกรูปก่อนบันทึก')
      return
    }
    if (!weekNumber) {
      alert('กรุณากรอกสัปดาห์ที่')
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
        imageUrl,
        difficulty,
        selectedConfig: selectedConfig || null,
      } : a
    )

    setSavedActivities(updated)
    localStorage.setItem('puzzleActivities', JSON.stringify(updated))
    setEditingActivityId(null)
    alert('อัปเดตกิจกรรมสำเร็จ!')
    audioManager.playSuccess()
  }

  const handleOpenEvaluation = () => {
    if (!imageUrl) {
      alert('กรุณาเลือกรูปภาพก่อนประเมิน')
      return
    }
    setPuzzleCompletedImage(imageUrl)
    setShowEvaluation(true)
    audioManager.playClick()
  }

  const handlePuzzleComplete = async () => {
    try {
      // จับภาพหน้าจอของจิ๊กซอว์ที่สมบูรณ์ (เฉพาะกระดาน)
      const puzzleGrid = document.querySelector('.puzzle-grid')
      if (puzzleGrid) {
        const canvas = await html2canvas(puzzleGrid as HTMLElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        })
        const imageData = canvas.toDataURL('image/png')
        setPuzzleCompletedImage(imageData)
      } else {
        // ถ้าไม่สามารถจับภาพได้ ใช้รูปต้นฉบับแทน
        setPuzzleCompletedImage(imageUrl)
      }
    } catch (error) {
      console.error('Error capturing puzzle screenshot:', error)
      // ถ้าเกิดข้อผิดพลาด ใช้รูปต้นฉบับแทน
      setPuzzleCompletedImage(imageUrl)
    }
  }

  const handleOpenEvaluationFromGame = async () => {
    // ถ้ายังไม่มีภาพ ให้จับภาพก่อน
    if (!puzzleCompletedImage) {
      await handlePuzzleComplete()
    }
    setShowEvaluation(true)
    audioManager.playClick()
  }

  const handleExportPDF = async () => {
    if (!puzzleCompletedImage) return

    try {
      // คำนวณคะแนนรวม
      const totalScore = evaluation.attention + evaluation.carefulness + 
                        evaluation.neatness + evaluation.completeness
      const averageScore = (totalScore / 4).toFixed(1)

      // สร้าง HTML template
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
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 18px; border-radius: 12px; text-align: center; margin-bottom: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
          <h1 style="color: white; margin: 0 0 6px 0; font-size: 26px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">🧩 แบบประเมินกิจกรรมจิ๊กซอว์</h1>
          <p style="color: white; margin: 0; font-size: 13px; opacity: 0.95;">Puzzle Activity Evaluation Report</p>
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
            <p style="margin: 4px 0; color: #495057; font-size: 12px;"><strong>ระดับความยาก:</strong> ${difficulty === 'easy' ? 'ง่าย' : difficulty === 'medium' ? 'ปานกลาง' : 'ยาก'}</p>
          </div>

          <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; border: 2px solid #e9ecef;">
            <h2 style="color: #667eea; margin: 0 0 10px 0; font-size: 15px; border-bottom: 2px solid #667eea; padding-bottom: 6px;">📊 การประเมิน</h2>
            ${[
              { label: 'ความสนใจ', score: evaluation.attention },
              { label: 'ความรอบคอบ', score: evaluation.carefulness },
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
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 12px; border-radius: 10px; margin-top: 12px; text-align: center; box-shadow: 0 3px 10px rgba(102,126,234,0.3);">
              <span style="color: white; font-size: 13px; font-weight: 600;">คะแนนเฉลี่ย: </span>
              <span style="color: white; font-size: 24px; font-weight: 700; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">${averageScore}/5</span>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 15px;">
          <h2 style="color: #667eea; margin: 0 0 10px 0; font-size: 16px; border-bottom: 2px solid #667eea; padding-bottom: 6px;">🖼️ ภาพกิจกรรม</h2>
          <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 12px; border: 2px solid #e9ecef;">
            <img src="${puzzleCompletedImage}" style="max-width: 100%; max-height: 400px; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
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

      // แปลง HTML เป็นรูปภาพ
      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })

      document.body.removeChild(reportElement)

      // สร้าง PDF
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pdfWidth
      const imgHeight = (canvas.height * pdfWidth) / canvas.width
      
      if (imgHeight > pdfHeight) {
        let heightLeft = imgHeight
        let position = 0
        
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pdfHeight
        
        while (heightLeft > 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
          heightLeft -= pdfHeight
        }
      } else {
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      }

      const fileName = `แบบประเมินจิ๊กซอว์-สัปดาห์${weekNumber || 'X'}-${Date.now()}.pdf`
      pdf.save(fileName)

      audioManager.playSuccess()
      alert('ส่งออก PDF เรียบร้อย! 🎉')
      setShowEvaluation(false)
      
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

  // Load activities from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('puzzleActivities')
    if (saved) {
      try {
        setSavedActivities(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to load activities:', e)
      }
    }
  }, [])

  if (started && imageUrl) {
    return (
      <DndProvider backend={MultiBackend} options={HTML5toTouch}>
        <div className="puzzle-page">
          <div className="puzzle-header">
            <h1>🧩 จิ๊กซอว์</h1>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="music-toggle-btn"
                onClick={handleMusicToggle}
                title={isMusicPlaying ? 'ปิดเพลง' : 'เปิดเพลง'}
                style={{
                  padding: '10px 15px',
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: '2px solid #667eea',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  transition: 'all 0.3s ease'
                }}
              >
                {isMusicPlaying ? '🔊' : '🔇'}
              </button>
              <button className="back-btn" onClick={() => setStarted(false)}>
                ← เริ่มใหม่
              </button>
            </div>
          </div>
          <PuzzleBoard 
            key={`${imageUrl}-${difficulty}`} 
            imageUrl={imageUrl} 
            difficulty={difficulty}
            onComplete={handlePuzzleComplete}
            onEvaluate={handleOpenEvaluationFromGame}
          />
          
          <div className="mascot">
            <div className="mascot-avatar">🦊</div>
            <div className="mascot-speech">ต่อให้สำเร็จนะ!</div>
          </div>
        </div>

        {/* Evaluation Modal - แสดงทั้งตอนเล่นและหน้า setup */}
        {showEvaluation && (
          <div className="evaluation-modal">
            <div className="evaluation-content">
              <h2 style={{ color: '#667eea', marginBottom: '24px', textAlign: 'center', fontSize: '24px' }}>
                ประเมินผลกิจกรรม
              </h2>
              
              <div className="evaluation-grid">
                <div className="evaluation-item">
                  <label>👀 ความสนใจ</label>
                  <div className="score-selector">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        className={`score-btn ${evaluation.attention === score ? 'active' : ''}`}
                        onClick={() => setEvaluation({...evaluation, attention: score})}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="evaluation-item">
                  <label>🧩 ความรอบคอบ</label>
                  <div className="score-selector">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        className={`score-btn ${evaluation.carefulness === score ? 'active' : ''}`}
                        onClick={() => setEvaluation({...evaluation, carefulness: score})}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="evaluation-item">
                  <label>✨ ความเรียบร้อย</label>
                  <div className="score-selector">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        className={`score-btn ${evaluation.neatness === score ? 'active' : ''}`}
                        onClick={() => setEvaluation({...evaluation, neatness: score})}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="evaluation-item">
                  <label>✅ ความสมบูรณ์</label>
                  <div className="score-selector">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        className={`score-btn ${evaluation.completeness === score ? 'active' : ''}`}
                        onClick={() => setEvaluation({...evaluation, completeness: score})}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="average-score">
                <span>คะแนนเฉลี่ย: </span>
                <span className="score-value">
                  {((evaluation.attention + evaluation.carefulness + evaluation.neatness + evaluation.completeness) / 4).toFixed(1)}/5
                </span>
              </div>

              <div className="evaluation-actions">
                <button 
                  className="btn-export-pdf"
                  onClick={handleExportPDF}
                >
                  📄 ส่งออก PDF
                </button>
                <button 
                  className="btn-close-eval"
                  onClick={() => setShowEvaluation(false)}
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}
      </DndProvider>
    )
  }

  // Loading Overlay
  if (isLoading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <div className="puzzle-setup">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast ${toast.type}`} onClick={clearToast}>
          {toast.message}
        </div>
      )}

      <div className="setup-header">
        <h1>🧩 เกมจิ๊กซอว์</h1>
        <button className="back-btn" onClick={() => window.history.back()}>
          ← กลับ
        </button>
      </div>

      <div className="setup-container">
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

        {puzzleConfigs.length > 0 && (
          <div className="setup-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>📦 เลือกชุดจิ๊กซอว์จากครู</h2>
              <span style={{ color: '#999', fontSize: '0.9rem' }}>👆 เลื่อนดูรูปเพิ่ม →</span>
            </div>
            <div className="config-list">
              {puzzleConfigs.map(config => (
                <div 
                  key={config.id} 
                  className={`config-item ${selectedConfig === config.id ? 'selected' : ''}`}
                  onClick={() => handleConfigSelect(config.id)}
                >
                  <img src={config.imageUrl} alt={config.name} />
                  <div className="config-info">
                    <h3>{config.name}</h3>
                    <span className="difficulty-badge">{config.difficulty === 'easy' ? 'ง่าย' : config.difficulty === 'medium' ? 'ปานกลาง' : 'ยาก'}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="divider">หรือ</div>
          </div>
        )}
        
        <div className="setup-card">
          <h2>1. เลือกรูปภาพ</h2>
          <div className="upload-area">
            <input
              type="file"
              accept="image/*"
              onChange={onFileChange}
              id="puzzle-upload"
              className="file-input-hidden"
              disabled={isLoading}
            />
            <label 
              htmlFor="puzzle-upload" 
              className={`upload-label ${isLoading ? 'loading' : ''} ${error ? 'error' : ''}`}
            >
              {imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt="Preview" 
                  className={`preview-image ${isLoading ? 'loading' : ''}`}
                  loading="lazy"
                />
              ) : (
                <div className="upload-placeholder">
                  <span className="upload-icon">📸</span>
                  <p>คลิกเพื่ออัปโหลดรูป</p>
                  <p style={{ fontSize: '0.9rem', color: '#999', marginTop: '8px' }}>
                    JPG, PNG, GIF หรือ WEBP (สูงสุด 10MB)
                  </p>
                </div>
              )}
            </label>
            {error && (
              <p style={{ color: '#ef4444', marginTop: '10px', textAlign: 'center' }}>
                ⚠️ {error}
              </p>
            )}
          </div>
        </div>

        <div className="setup-card">
          <h2>2. เลือกระดับความยาก</h2>
          <div className="difficulty-buttons">
            <button
              className={`difficulty-btn ${difficulty === 'easy' ? 'active' : ''}`}
              onClick={() => setDifficulty('easy')}
              disabled={isLoading}
              aria-label="เลือกระดับง่าย"
            >
              <div className="difficulty-icon">😊</div>
              <div className="difficulty-name">ง่าย</div>
              <div className="difficulty-desc">9 ชิ้น (3×3)</div>
            </button>
            
            <button
              className={`difficulty-btn ${difficulty === 'medium' ? 'active' : ''}`}
              onClick={() => setDifficulty('medium')}
              disabled={isLoading}
              aria-label="เลือกระดับปานกลาง"
            >
              <div className="difficulty-icon">🤔</div>
              <div className="difficulty-name">ปานกลาง</div>
              <div className="difficulty-desc">16 ชิ้น (4×4)</div>
            </button>
            
            <button
              className={`difficulty-btn ${difficulty === 'hard' ? 'active' : ''}`}
              onClick={() => setDifficulty('hard')}
              disabled={isLoading}
              aria-label="เลือกระดับยาก"
            >
              <div className="difficulty-icon">🤯</div>
              <div className="difficulty-name">ยาก</div>
              <div className="difficulty-desc">25 ชิ้น (5×5)</div>
            </button>
          </div>
        </div>

        {/* Action Buttons - 3 buttons */}
        <div className="action-buttons">
          <button 
            className={`action-btn start-btn ${isLoading ? 'loading' : ''}`}
            onClick={handleStart}
            disabled={isLoading}
            aria-label="เริ่มเล่นเกมจิ๊กซอว์"
          >
            {isLoading ? 'กำลังโหลด...' : 'เริ่มกิจกรรม'}
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
                    {activity.imageUrl && (
                      <div className="activity-thumbnail">
                        <img src={activity.imageUrl} alt={`สัปดาห์ ${activity.weekNumber}`} />
                      </div>
                    )}
                    <div className="activity-info">
                      <h3>สัปดาห์ที่ {activity.weekNumber}</h3>
                      <p><strong>สาระ:</strong> {activity.learningSubject || '-'}</p>
                      <p><strong>หน่วย:</strong> {activity.learningUnit || '-'}</p>
                      <p><strong>ครู:</strong> {activity.responsibleTeacher || '-'}</p>
                      <p><strong>ผู้ทดสอบ:</strong> {activity.testerName || '-'}</p>
                      <p><strong>ระดับ:</strong> {activity.difficulty === 'easy' ? 'ง่าย' : activity.difficulty === 'medium' ? 'ปานกลาง' : 'ยาก'}</p>
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

      <div className="mascot">
        <div className="mascot-avatar">🦊</div>
        <div className="mascot-speech">ต่อจิ๊กซอว์สนุกนะ!</div>
      </div>
    </div>
  )
}

export default PlayPuzzle
