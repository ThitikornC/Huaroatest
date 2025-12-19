import { useState, useEffect } from 'react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { MouseTransition, TouchTransition } from 'react-dnd-multi-backend'
import { MultiBackend } from 'react-dnd-multi-backend'
import { getCategories, getCategoryItems, Category, CategoryItem } from '../../services/storage'
import { audioManager } from '../../utils/audio'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import './PlayCategory.css'

// Multi-backend configuration
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

interface PlayItem extends CategoryItem {
  placed: boolean
  placedInCategoryId?: string
}

function PlayCategory() {
  const [started, setStarted] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<PlayItem[]>([])
  const [score, setScore] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [isMusicPlaying, setIsMusicPlaying] = useState(true)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  // Activity form data
  const [weekNumber, setWeekNumber] = useState('')
  const [learningSubject, setLearningSubject] = useState('')
  const [learningUnit, setLearningUnit] = useState('')
  const [responsibleTeacher, setResponsibleTeacher] = useState('')
  const [testerName, setTesterName] = useState('')
  const [savedActivities, setSavedActivities] = useState<any[]>([])
  const [showActivityList, setShowActivityList] = useState(false)
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null)

  // Add game data states
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#FF6B9D')
  const [newCategoryBackgroundImage, setNewCategoryBackgroundImage] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('')
  const [newItemImage, setNewItemImage] = useState('')
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Evaluation states
  const [showEvaluation, setShowEvaluation] = useState(false)
  const [evaluation, setEvaluation] = useState({
    understanding: 5,
    accuracy: 5,
    neatness: 5,
    completeness: 5
  })
  const [categoryCompletedImage, setCategoryCompletedImage] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  // Load activities from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('categoryActivities')
    if (saved) {
      try {
        setSavedActivities(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to load activities:', e)
      }
    }
  }, [])

  useEffect(() => {
    if (started) {
      audioManager.playBackgroundMusic()
    } else {
      audioManager.pauseBackgroundMusic()
    }

    return () => {
      audioManager.pauseBackgroundMusic()
    }
  }, [started])

  const loadData = () => {
    const cats = getCategories()
    const allItems = getCategoryItems()
    
    setCategories(cats)
    setItems(allItems.map(item => ({ ...item, placed: false })))
  }

  const handleStart = () => {
    // Shuffle items
    const shuffled = [...items].sort(() => Math.random() - 0.5)
    setItems(shuffled.map(item => ({ ...item, placed: false, placedInCategoryId: undefined })))
    setScore(0)
    setCompleted(false)
    setStarted(true)
    audioManager.playClick()
  }

  const handleDrop = (itemId: string, targetCategoryId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return
    
    // ถ้าวางซ้ำที่เดิม ไม่ทำอะไร
    if (item.placed && item.placedInCategoryId === targetCategoryId) {
      return
    }
    
    // ถ้าเคยวางไว้แล้ว ต้องหักคะแนนเดิมก่อน
    if (item.placed && item.placedInCategoryId) {
      const wasCorrect = item.categoryId === item.placedInCategoryId
      if (wasCorrect) {
        setScore(prev => Math.max(0, prev - 10)) // หักคะแนนที่ได้มา
      } else {
        setScore(prev => prev + 5) // คืนคะแนนที่หักไป
      }
    }

    const isCorrect = item.categoryId === targetCategoryId

    setItems(prevItems => prevItems.map(i => 
      i.id === itemId 
        ? { ...i, placed: true, placedInCategoryId: targetCategoryId } 
        : i
    ))

    if (isCorrect) {
      audioManager.playCorrect()
      setScore(prev => prev + 10)
    } else {
      audioManager.playFail()
      setScore(prev => Math.max(0, prev - 5))
    }

    // Check if all items are placed (after this drop)
    setTimeout(() => {
      setItems(currentItems => {
        const allPlaced = currentItems.every(i => i.placed)
        
        if (allPlaced) {
          const allCorrect = currentItems.every(i => 
            i.placed && i.categoryId === i.placedInCategoryId
          )
          
          if (allCorrect) {
            // จับภาพกระดานก่อนแสดง completion modal
            const captureAndComplete = async () => {
              try {
                const gameBoard = document.querySelector('.game-board')
                if (gameBoard) {
                  const canvas = await html2canvas(gameBoard as HTMLElement, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                  })
                  const imageData = canvas.toDataURL('image/png')
                  setCategoryCompletedImage(imageData)
                }
              } catch (error) {
                console.error('Error capturing screenshot:', error)
              }
              
              // แสดง completion modal หลังจับภาพเสร็จ
              setCompleted(true)
              audioManager.playEndgame()
            }
            
            captureAndComplete()
          }
        }
        
        return currentItems
      })
    }, 500)
  }

  const handleRemove = (itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item || !item.placed) return
    
    // หักคะแนนตามที่วางไว้
    const wasCorrect = item.categoryId === item.placedInCategoryId
    if (wasCorrect) {
      setScore(prev => Math.max(0, prev - 10))
    } else {
      setScore(prev => prev + 5) // คืนคะแนนที่หักไป
    }
    
    setItems(prevItems => prevItems.map(i => 
      i.id === itemId 
        ? { ...i, placed: false, placedInCategoryId: undefined } 
        : i
    ))
    audioManager.playClick()
  }

  const toggleMusic = () => {
    const isPlaying = audioManager.toggleBackgroundMusic()
    setIsMusicPlaying(isPlaying)
    audioManager.playClick()
  }

  const getUnplacedItems = () => {
    return items.filter(i => !i.placed)
  }

  const getItemsInCategory = (categoryId: string) => {
    return items.filter(i => i.placed && i.placedInCategoryId === categoryId)
  }

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || ''
  }

  const getCategoryColor = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.color || '#999'
  }

  const handleSaveActivity = () => {
    // ถ้าอยู่ในโหมดแก้ไข
    if (editingActivityId) {
      handleUpdateActivity()
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
      categories: categories,
      items: items.map(i => ({ ...i, placed: false, placedInCategoryId: undefined })),
      categoriesCount: categories.length,
      itemsCount: items.length,
    }

    const updated = [...savedActivities, newActivity]
    setSavedActivities(updated)
    localStorage.setItem('categoryActivities', JSON.stringify(updated))
    alert('บันทึกกิจกรรมสำเร็จ!')
    audioManager.playClick()
  }

  const handleLoadActivity = (activity: any) => {
    setWeekNumber(activity.weekNumber)
    setLearningSubject(activity.learningSubject)
    setLearningUnit(activity.learningUnit)
    setResponsibleTeacher(activity.responsibleTeacher)
    setTesterName(activity.testerName)
    
    // Load game data
    if (activity.categories && activity.items) {
      setCategories(activity.categories)
      setItems(activity.items)
    }
    
    setShowActivityList(false)
    audioManager.playClick()
  }

  const handleDeleteActivity = (activityId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('ต้องการลบกิจกรรมนี้?')) return
    
    const updated = savedActivities.filter(a => a.id !== activityId)
    setSavedActivities(updated)
    localStorage.setItem('categoryActivities', JSON.stringify(updated))
    audioManager.playClick()
  }

  const handleEditActivity = (activity: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingActivityId(activity.id)
    handleLoadActivity(activity)
  }

  const handleUpdateActivity = () => {
    if (!editingActivityId) return
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
        categories: categories,
        items: items.map(i => ({ ...i, placed: false, placedInCategoryId: undefined })),
        categoriesCount: categories.length,
        itemsCount: items.length,
      } : a
    )

    setSavedActivities(updated)
    localStorage.setItem('categoryActivities', JSON.stringify(updated))
    setEditingActivityId(null)
    alert('อัปเดตกิจกรรมสำเร็จ!')
    audioManager.playClick()
  }

  const handleOpenEvaluation = async () => {
    // ตรวจสอบว่ากรอกข้อมูลครบหรือไม่
    if (!weekNumber) {
      alert('ไม่พบแบบประเมิน\n\nกรุณากรอกข้อมูลกิจกรรม (สัปดาห์ที่) ก่อนทำแบบประเมิน')
      return
    }

    try {
      // สร้าง screenshot ของกระดานเกม
      const gameBoard = document.querySelector('.game-board')
      
      if (gameBoard) {
        const canvas = await html2canvas(gameBoard as HTMLElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        })
        const imageData = canvas.toDataURL('image/png')
        setCategoryCompletedImage(imageData)
      }
      
      setShowEvaluation(true)
      audioManager.playClick()
    } catch (error) {
      console.error('Error capturing screenshot:', error)
      // ยังคงแสดงแบบประเมินแม้จะจับภาพหน้าจอไม่ได้
      setShowEvaluation(true)
      audioManager.playClick()
    }
  }

  const handleExportPDF = async () => {
    // ตรวจสอบว่ากรอกข้อมูลครบหรือไม่
    if (!weekNumber) {
      alert('กรุณากรอกข้อมูลกิจกรรม (สัปดาห์ที่) ก่อนส่งออก PDF')
      return
    }

    try {
      // คำนวณคะแนนรวม
      const totalScore = evaluation.understanding + evaluation.accuracy + 
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
        <div style="background: linear-gradient(135deg, #FF6B9D 0%, #FFC75F 100%); padding: 18px; border-radius: 12px; text-align: center; margin-bottom: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
          <h1 style="color: white; margin: 0 0 6px 0; font-size: 26px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">🗂️ แบบประเมินกิจกรรมจัดหมวดหมู่</h1>
          <p style="color: white; margin: 0; font-size: 13px; opacity: 0.95;">Category Activity Evaluation Report</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; border: 2px solid #e9ecef;">
            <h2 style="color: #FF6B9D; margin: 0 0 10px 0; font-size: 15px; border-bottom: 2px solid #FF6B9D; padding-bottom: 6px;">📋 ข้อมูลกิจกรรม</h2>
            <p style="margin: 4px 0; color: #495057; font-size: 12px;"><strong>สัปดาห์ที่:</strong> ${weekNumber || '-'}</p>
            <p style="margin: 4px 0; color: #495057; font-size: 12px;"><strong>สาระการเรียนรู้:</strong> ${learningSubject || '-'}</p>
            <p style="margin: 4px 0; color: #495057; font-size: 12px;"><strong>หน่วยการเรียนรู้:</strong> ${learningUnit || '-'}</p>
            <p style="margin: 4px 0; color: #495057; font-size: 12px;"><strong>ครูผู้รับผิดชอบ:</strong> ${responsibleTeacher || '-'}</p>
            <p style="margin: 4px 0; color: #495057; font-size: 12px;"><strong>ผู้ทดสอบ:</strong> ${testerName || '-'}</p>
            <p style="margin: 4px 0; color: #495057; font-size: 12px;"><strong>วันที่:</strong> ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p style="margin: 4px 0; color: #495057; font-size: 12px;"><strong>จำนวนหมวดหมู่:</strong> ${categories.length} หมวด</p>
            <p style="margin: 4px 0; color: #495057; font-size: 12px;"><strong>จำนวนรายการ:</strong> ${items.length} รายการ</p>
          </div>

          <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; border: 2px solid #e9ecef;">
            <h2 style="color: #FF6B9D; margin: 0 0 10px 0; font-size: 15px; border-bottom: 2px solid #FF6B9D; padding-bottom: 6px;">การประเมิน</h2>
            ${[
              { label: 'การจัดหมวดหมู่ที่ถูกต้อง', score: evaluation.understanding },
              { label: 'ความเข้าใจเนื้อหา', score: evaluation.accuracy },
              { label: 'ความคล่องแคล่ว', score: evaluation.neatness },
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
          <h2 style="color: #FF6B9D; margin: 0 0 10px 0; font-size: 16px; border-bottom: 2px solid #FF6B9D; padding-bottom: 6px;">🖼️ ภาพกิจกรรม</h2>
          <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 12px; border: 2px solid #e9ecef;">
            ${categoryCompletedImage ? 
              `<img src="${categoryCompletedImage}" style="max-width: 100%; max-height: 400px; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />` : 
              `<p style="color: #6c757d; padding: 40px; margin: 0;">ไม่มีภาพกิจกรรม</p>`
            }
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

      const fileName = `แบบประเมินจัดหมวดหมู่-สัปดาห์${weekNumber || 'X'}-${Date.now()}.pdf`
      pdf.save(fileName)

      audioManager.playSuccess()
      alert('ส่งออก PDF เรียบร้อย! 🎉')
      setShowEvaluation(false)
      
      // รีเซ็ตค่าประเมิน
      setEvaluation({
        understanding: 5,
        accuracy: 5,
        neatness: 5,
        completeness: 5
      })

    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('เกิดข้อผิดพลาดในการส่งออก PDF กรุณาลองใหม่อีกครั้ง')
    }
  }

  const handleAddCategory = () => {
    // ถ้าอยู่ในโหมดแก้ไข
    if (editingCategoryId) {
      handleUpdateCategory()
      return
    }

    if (!newCategoryName.trim()) {
      alert('กรุณากรอกชื่อหมวดหมู่')
      return
    }

    const newCat: Category = {
      id: Date.now().toString(),
      name: newCategoryName.trim(),
      color: newCategoryColor,
      backgroundImage: newCategoryBackgroundImage || undefined,
      order: categories.length, // เพิ่ม order เป็นลำดับถัดไป
    }

    setCategories([...categories, newCat])
    setNewCategoryName('')
    setNewCategoryColor('#FF6B9D')
    setNewCategoryBackgroundImage('')
    setShowAddCategory(false)
    audioManager.playClick()
  }

  const handleEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id)
    setNewCategoryName(cat.name)
    setNewCategoryColor(cat.color)
    setNewCategoryBackgroundImage(cat.backgroundImage || '')
    setShowAddCategory(true)
    audioManager.playClick()
  }

  const handleUpdateCategory = () => {
    if (!editingCategoryId) return
    if (!newCategoryName.trim()) {
      alert('กรุณากรอกชื่อหมวดหมู่')
      return
    }

    setCategories(categories.map(c => 
      c.id === editingCategoryId ? {
        ...c,
        name: newCategoryName.trim(),
        color: newCategoryColor,
        backgroundImage: newCategoryBackgroundImage || undefined,
      } : c
    ))

    setNewCategoryName('')
    setNewCategoryColor('#FF6B9D')
    setNewCategoryBackgroundImage('')
    setEditingCategoryId(null)
    setShowAddCategory(false)
    audioManager.playClick()
  }

  const handleAddItem = () => {
    // ถ้าอยู่ในโหมดแก้ไข
    if (editingItemId) {
      handleUpdateItem()
      return
    }

    if (!newItemName.trim()) {
      alert('กรุณากรอกชื่อรายการ')
      return
    }
    if (!newItemCategory) {
      alert('กรุณาเลือกหมวดหมู่')
      return
    }

    const newItem: PlayItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      categoryId: newItemCategory,
      imageUrl: newItemImage || undefined,
      placed: false,
      order: items.length, // เพิ่ม order เป็นลำดับถัดไป
    }

    setItems([...items, newItem])
    setNewItemName('')
    setNewItemImage('')
    setShowAddItem(false)
    audioManager.playClick()
  }

  const handleEditItem = (item: PlayItem) => {
    setEditingItemId(item.id)
    setNewItemName(item.name)
    setNewItemCategory(item.categoryId)
    setNewItemImage(item.imageUrl || '')
    setShowAddItem(true)
    audioManager.playClick()
  }

  const handleUpdateItem = () => {
    if (!editingItemId) return
    if (!newItemName.trim()) {
      alert('กรุณากรอกชื่อรายการ')
      return
    }
    if (!newItemCategory) {
      alert('กรุณาเลือกหมวดหมู่')
      return
    }

    setItems(items.map(i => 
      i.id === editingItemId ? {
        ...i,
        name: newItemName.trim(),
        categoryId: newItemCategory,
        imageUrl: newItemImage || undefined,
      } : i
    ))

    setNewItemName('')
    setNewItemImage('')
    setNewItemCategory('')
    setEditingItemId(null)
    setShowAddItem(false)
    audioManager.playClick()
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const url = event.target?.result as string
      setNewItemImage(url)
    }
    reader.readAsDataURL(file)
  }

  const handleCategoryBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const url = event.target?.result as string
      setNewCategoryBackgroundImage(url)
    }
    reader.readAsDataURL(file)
  }

  const handleDeleteCategory = (catId: string) => {
    if (!confirm('ต้องการลบหมวดหมู่นี้? รายการที่เกี่ยวข้องจะถูกลบด้วย')) return
    
    setCategories(categories.filter(c => c.id !== catId))
    setItems(items.filter(i => i.categoryId !== catId))
    audioManager.playClick()
  }

  const handleDeleteItem = (itemId: string) => {
    if (!confirm('ต้องการลบรายการนี้?')) return
    
    setItems(items.filter(i => i.id !== itemId))
    audioManager.playClick()
  }

  if (!started) {
    return (
      <div className="category-setup">
        <div className="setup-header">
          <h1>🗂️ เกมจัดหมวดหมู่</h1>
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

          {/* Add Game Data Section */}
          <div className="setup-card">
            <h2>📦 เพิ่มข้อมูลเกม</h2>
            
            {/* Categories Management */}
            <div className="game-data-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>หมวดหมู่ ({categories.length})</h3>
                <button 
                  className="add-data-btn"
                  onClick={() => {
                    if (showAddCategory && editingCategoryId) {
                      setEditingCategoryId(null)
                      setNewCategoryName('')
                      setNewCategoryColor('#FF6B9D')
                      setNewCategoryBackgroundImage('')
                    }
                    setShowAddCategory(!showAddCategory)
                  }}
                >
                  {showAddCategory ? '✕ ยกเลิก' : '+ เพิ่มหมวดหมู่'}
                </button>
              </div>

              {showAddCategory && (
                <div className="add-form">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="ชื่อหมวดหมู่..."
                    className="form-input"
                  />
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: '0.9rem', color: '#666' }}>สี:</label>
                    <input
                      type="color"
                      value={newCategoryColor}
                      onChange={(e) => setNewCategoryColor(e.target.value)}
                      className="color-input"
                    />
                  </div>
                  <div className="image-upload-section">
                    <label className="upload-label-small">
                      {newCategoryBackgroundImage ? (
                        <div className="image-preview-small">
                          <img src={newCategoryBackgroundImage} alt="Preview" />
                          <span className="change-text">คลิกเพื่อเปลี่ยนรูปพื้นหลัง</span>
                        </div>
                      ) : (
                        <div className="upload-placeholder-small">
                          📸 เลือกรูปพื้นหลัง (ไม่บังคับ)
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCategoryBackgroundUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                    {newCategoryBackgroundImage && (
                      <button 
                        onClick={() => setNewCategoryBackgroundImage('')}
                        className="remove-image-btn"
                        type="button"
                      >
                        ✕ ลบรูป
                      </button>
                    )}
                  </div>
                  <button onClick={handleAddCategory} className="confirm-btn">
                    {editingCategoryId ? '✓ อัปเดต' : '✓ เพิ่ศ'}
                  </button>
                </div>
              )}

              <div className="data-list">
                {categories.map(cat => (
                  <div key={cat.id} className="data-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: cat.color }} />
                      {cat.backgroundImage && (
                        <div className="category-thumb">
                          <img src={cat.backgroundImage} alt={cat.name} />
                        </div>
                      )}
                      <span>{cat.name}</span>
                    </div>
                    <div className="item-actions">
                      <button 
                        onClick={() => handleEditCategory(cat)} 
                        className="edit-btn"
                        title="แก้ไขหมวดหมู่"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDeleteCategory(cat.id)} 
                        className="delete-btn"
                        title="ลบหมวดหมู่"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="empty-message">ยังไม่มีหมวดหมู่</p>
                )}
              </div>
            </div>

            {/* Items Management */}
            <div className="game-data-section" style={{ marginTop: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>รายการ ({items.length})</h3>
                <button 
                  className="add-data-btn"
                  onClick={() => {
                    if (showAddItem && editingItemId) {
                      setEditingItemId(null)
                      setNewItemName('')
                      setNewItemImage('')
                      setNewItemCategory('')
                    }
                    setShowAddItem(!showAddItem)
                  }}
                  disabled={categories.length === 0}
                  title={categories.length === 0 ? 'กรุณาเพิ่มหมวดหมู่ก่อน' : ''}
                >
                  {showAddItem ? '✕ ยกเลิก' : '+ เพิ่มรายการ'}
                </button>
              </div>

              {showAddItem && (
                <div className="add-form">
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="ชื่อรายการ..."
                    className="form-input"
                  />
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="form-select"
                  >
                    <option value="">เลือกหมวดหมู่</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <div className="image-upload-wrapper">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      id="item-image-upload"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="item-image-upload" className="upload-image-btn">
                      {newItemImage ? '✓ รูปภาพ' : '📷 เพิ่มรูป'}
                    </label>
                    {newItemImage && (
                      <div className="image-preview-small">
                        <img src={newItemImage} alt="Preview" />
                      </div>
                    )}
                  </div>
                  <button onClick={handleAddItem} className="confirm-btn">
                    {editingItemId ? '✓ อัปเดต' : '✓ เพิ่ม'}
                  </button>
                </div>
              )}

              <div className="data-list">
                {items.map(item => {
                  const cat = categories.find(c => c.id === item.categoryId)
                  return (
                    <div key={item.id} className="data-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {item.imageUrl && (
                          <img 
                            src={item.imageUrl} 
                            alt={item.name}
                            style={{ 
                              width: '40px', 
                              height: '40px', 
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '2px solid #e0e0e0'
                            }}
                          />
                        )}
                        <span>{item.name}</span>
                        {cat && (
                          <span style={{ 
                            fontSize: '0.85rem', 
                            color: '#666',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            backgroundColor: cat.color + '20',
                            border: `1px solid ${cat.color}`
                          }}>
                            {cat.name}
                          </span>
                        )}
                      </div>
                      <div className="item-actions">
                        <button 
                          onClick={() => handleEditItem(item)} 
                          className="edit-btn"
                          title="แก้ไขรายการ"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDeleteItem(item.id)} 
                          className="delete-btn"
                          title="ลบรายการ"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )
                })}
                {items.length === 0 && (
                  <p className="empty-message">ยังไม่มีรายการ</p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons - 3 buttons */}
          <div className="action-buttons">
            <button 
              className="action-btn start-btn-alt"
              onClick={handleStart}
              disabled={categories.length === 0 || items.length === 0}
              title={categories.length === 0 || items.length === 0 ? 'กรุณาเพิ่มข้อมูลหมวดหมู่ก่อน' : 'เริ่มเล่นเกม'}
            >
              🎮 เริ่มกิจกรรม
            </button>
            <button 
              className="action-btn save-btn"
              onClick={handleSaveActivity}
              title={editingActivityId ? "อัปเดตกิจกรรม" : "บันทึกข้อมูลกิจกรรม"}
            >
              {editingActivityId ? '💾 อัปเดตกิจกรรม' : '📌 บันทึกกิจกรรม'}
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
              📂 เลือกกิจกรรม
            </button>
          </div>

          {categories.length === 0 || items.length === 0 ? (
            <div className="setup-card">
              <div className="no-data-message">
                <div className="no-data-icon">📭</div>
                <h2>ยังไม่มีข้อมูล</h2>
                <p>ครูยังไม่ได้สร้างหมวดหมู่และรายการ</p>
                <p>กรุณาแจ้งครูเพื่อเพิ่มข้อมูลในหน้า <strong>จัดการเกมจัดหมวดหมู่</strong></p>
              </div>
            </div>
          ) : (
            <>
              <div className="info-banner">
                พบ {categories.length} หมวดหมู่ และ {items.length} รายการ
              </div>

              <div className="setup-card">
                <h2>วิธีเล่น</h2>
                <div className="instructions">
                  <div className="instruction-item">
                    <span className="step-number">1</span>
                    <p>ดูรายการด้านล่าง</p>
                  </div>
                  <div className="instruction-item">
                    <span className="step-number">2</span>
                    <p>ลากรายการไปวางในหมวดหมู่ที่ถูกต้อง</p>
                  </div>
                  <div className="instruction-item">
                    <span className="step-number">3</span>
                    <p>จัดให้ถูกทุกรายการเพื่อชนะ!</p>
                  </div>
                </div>
              </div>

              <div className="preview-categories">
                <h3>หมวดหมู่ ({categories.length})</h3>
                <div className="preview-grid">
                  {categories.map(cat => (
                    <div 
                      key={cat.id} 
                      className="preview-category-card"
                      style={{ 
                        borderLeftColor: cat.color,
                        backgroundImage: cat.backgroundImage ? `linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url(${cat.backgroundImage})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    >
                      <div 
                        className="preview-color-dot"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span>{cat.name}</span>
                      {cat.backgroundImage && (
                        <span className="has-bg-indicator">🖼️</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="action-buttons">
                <button className="start-btn" onClick={handleStart}>
                  🎮 เริ่มเล่น!
                </button>
              </div>
            </>
          )}
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
                      <div className="activity-info">
                        <h3>สัปดาห์ที่ {activity.weekNumber}</h3>
                        <p><strong>สาระ:</strong> {activity.learningSubject || '-'}</p>
                        <p><strong>หน่วย:</strong> {activity.learningUnit || '-'}</p>
                        <p><strong>ครู:</strong> {activity.responsibleTeacher || '-'}</p>
                        <p><strong>ผู้ทดสอบ:</strong> {activity.testerName || '-'}</p>
                        <p><strong>หมวดหมู่:</strong> {activity.categoriesCount} | <strong>รายการ:</strong> {activity.itemsCount}</p>
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
    <DndProvider backend={MultiBackend} options={HTML5toTouch}>
      <div className="play-category-page">
        <div className="category-game-header">
          <div className="header-left">
            <h1>🗂️ จัดหมวดหมู่</h1>
            {/* score hidden per request */}
          </div>
          <div className="header-actions">
            <button className="music-btn" onClick={toggleMusic}>
              {isMusicPlaying ? '🔊' : '🔇'}
            </button>
            <button className="back-btn" onClick={() => setStarted(false)}>
              ← เริ่มใหม่
            </button>
          </div>
        </div>

        <div className="game-layout">
          {/* Categories Zones */}
          <div className="categories-zones">
            {categories.map(category => (
              <CategoryZone
                key={category.id}
                category={category}
                items={getItemsInCategory(category.id)}
                onDrop={handleDrop}
                onRemove={handleRemove}
                selectedItemId={selectedItemId}
                setSelectedItemId={setSelectedItemId}
              />
            ))}
          </div>

          {/* Items Tray */}
          <div className="items-tray">
            <h3>รายการ ({getUnplacedItems().length}/{items.length})</h3>
            <div className="tray-items">
              {getUnplacedItems().length === 0 ? (
                <p className="tray-empty">วางครบทุกรายการแล้ว!</p>
              ) : (
                getUnplacedItems().map(item => (
                  <DraggableItem
                    key={item.id}
                    item={item}
                    isSelected={selectedItemId === item.id}
                    onSelect={(id) => setSelectedItemId(selectedItemId === id ? null : id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Completion Modal */}
        {completed && (
          <div className="completion-overlay">
            <div className="completion-modal">
              <div className="completion-icon">🎉</div>
              <h2>ยินดีด้วย!</h2>
              {/* completion score hidden per request */}
              <div className="completion-buttons">
                <button className="play-again-btn" onClick={handleStart}>
                  เล่นอีกครั้ง
                </button>
                <button className="evaluate-btn" onClick={handleOpenEvaluation}>
                  ประเมินผล
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Evaluation Modal */}
      <EvaluationModal
        show={showEvaluation}
        onClose={() => setShowEvaluation(false)}
        evaluation={evaluation}
        onEvaluationChange={(field, value) => setEvaluation({...evaluation, [field]: value})}
        onExport={handleExportPDF}
      />
    </DndProvider>
  )
}

// Category Drop Zone Component
interface CategoryZoneProps {
  category: Category
  items: PlayItem[]
  onDrop: (itemId: string, categoryId: string) => void
  onRemove: (itemId: string) => void
  selectedItemId: string | null
  setSelectedItemId: (id: string | null) => void
}

function CategoryZone({ category, items, onDrop, onRemove, selectedItemId, setSelectedItemId }: CategoryZoneProps) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'CATEGORY_ITEM',
    drop: (item: { id: string }) => {
      onDrop(item.id, category.id)
      setSelectedItemId(null)
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  }), [category.id, setSelectedItemId])

  const handleZoneClick = () => {
    if (selectedItemId) {
      onDrop(selectedItemId, category.id)
      setSelectedItemId(null)
    }
  }

  return (
    <div 
      ref={drop}
      className={`category-zone ${isOver && canDrop ? 'drag-over' : ''} ${selectedItemId ? 'tap-target' : ''}`}
      style={{ borderColor: category.color }}
      onClick={handleZoneClick}
    >
      <div 
        className="category-zone-header"
        style={{ backgroundColor: category.color }}
      >
        <h3>{category.name}</h3>
        <span className="item-count">{items.length} รายการ</span>
      </div>
      <div 
        className="category-zone-content"
        style={{ 
          backgroundColor: `${category.color}15`,
          backgroundImage: category.backgroundImage ? `url(${category.backgroundImage})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          position: 'relative'
        }}
      >
        {category.backgroundImage && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            zIndex: 0
          }} />
        )}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {items.length === 0 ? (
            <p className="zone-empty">ลากรายการมาวางที่นี่</p>
          ) : (
            <div className="zone-items">
              {items.map(item => (
                <PlacedItem 
                  key={item.id} 
                  item={item} 
                  categoryColor={category.color}
                  onRemove={onRemove}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Draggable Item Component
interface DraggableItemProps {
  item: PlayItem
  isSelected: boolean
  onSelect: (id: string) => void
}

function DraggableItem({ item, isSelected, onSelect }: DraggableItemProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'CATEGORY_ITEM',
    item: { id: item.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }), [item.id])

  return (
    <div
      ref={drag}
      className={`draggable-item ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(item.id)}
    >
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} />
      ) : (
        <div className="item-no-image">📷</div>
      )}
      <span className="item-name">{item.name}</span>
    </div>
  )
}

// Placed Item Component
interface PlacedItemProps {
  item: PlayItem
  categoryColor: string
  onRemove: (itemId: string) => void
}

function PlacedItem({ item, categoryColor, onRemove }: PlacedItemProps) {
  const isCorrect = item.categoryId === item.placedInCategoryId

  // ทำให้ลากได้อีกครั้ง
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'CATEGORY_ITEM',
    item: { id: item.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }), [item.id])

  return (
    <div 
      ref={drag}
      className={`placed-item ${isCorrect ? 'correct' : 'incorrect'} ${isDragging ? 'dragging' : ''}`}
      title="ลากเพื่อย้าย หรือคลิกเพื่อนำออก"
    >
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} />
      ) : (
        <div className="item-no-image">📷</div>
      )}
      <span className="item-name">{item.name}</span>
      <div className="correctness-indicator">
        {isCorrect ? '✓' : '✗'}
      </div>
      <button 
        className="remove-btn"
        onClick={(e) => {
          e.stopPropagation()
          onRemove(item.id)
        }}
        title="นำออก"
      >
        ✕
      </button>
    </div>
  )
}

// Evaluation Modal Component
function EvaluationModal({ 
  show, 
  onClose, 
  evaluation, 
  onEvaluationChange, 
  onExport 
}: { 
  show: boolean
  onClose: () => void
  evaluation: any
  onEvaluationChange: (field: string, value: number) => void
  onExport: () => void
}) {
  if (!show) return null

  return (
    <div className="evaluation-modal">
      <div className="evaluation-content">
        <h2 style={{ color: '#FF6B9D', marginBottom: '24px', textAlign: 'center', fontSize: '24px' }}>
          ประเมินผลกิจกรรม
        </h2>
        
        <div className="evaluation-grid">
          <div className="evaluation-item">
            <label>การจัดหมวดหมู่ที่ถูกต้อง</label>
            <div className="score-selector">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  className={`score-btn ${evaluation.understanding === score ? 'active' : ''}`}
                  onClick={() => onEvaluationChange('understanding', score)}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>

          <div className="evaluation-item">
            <label>ความเข้าใจเนื้อหา</label>
            <div className="score-selector">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  className={`score-btn ${evaluation.accuracy === score ? 'active' : ''}`}
                  onClick={() => onEvaluationChange('accuracy', score)}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>

          <div className="evaluation-item">
            <label>ความคล่องแคล่ว</label>
            <div className="score-selector">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  className={`score-btn ${evaluation.neatness === score ? 'active' : ''}`}
                  onClick={() => onEvaluationChange('neatness', score)}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>

          <div className="evaluation-item">
            <label>ความสมบูรณ์</label>
            <div className="score-selector">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  className={`score-btn ${evaluation.completeness === score ? 'active' : ''}`}
                  onClick={() => onEvaluationChange('completeness', score)}
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
            {((evaluation.understanding + evaluation.accuracy + evaluation.neatness + evaluation.completeness) / 4).toFixed(1)}/5
          </span>
        </div>

        <div className="evaluation-actions">
          <button className="btn-export-pdf" onClick={onExport}>
            📄 ส่งออก PDF
          </button>
          <button className="btn-close-eval" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}

export default PlayCategory
