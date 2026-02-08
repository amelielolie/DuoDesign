import { useCallback, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'

export function PhotoModeUI() {
  const phase = useGameStore((s) => s.phase)
  const photoSpotNearby = useGameStore((s) => s.photoSpotNearby)
  const setPhase = useGameStore((s) => s.setPhase)
  const addCapturedPhoto = useGameStore((s) => s.addCapturedPhoto)
  const currentZone = useGameStore((s) => s.currentZone)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [capturing, setCapturing] = useState(false)

  const downloadImage = useCallback((dataUrl: string) => {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = 'duo-world-photo.png'
    link.click()
  }, [])

  const shareOrSave = useCallback(async (dataUrl: string) => {
    const blob = await (await fetch(dataUrl)).blob()
    const file = new File([blob], 'duo-world-photo.png', { type: 'image/png' })
    const canShareFiles = navigator.canShare ? navigator.canShare({ files: [file] }) : false

    if (navigator.share && canShareFiles) {
      try {
        await navigator.share({
          title: 'My Duo World Look',
          text: 'Check out my look in Duo World!',
          files: [file],
        })
      } catch {
        downloadImage(dataUrl)
      }
      return
    }

    downloadImage(dataUrl)
  }, [downloadImage])

  const generateShareCard = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current
      if (!canvas) {
        resolve('')
        return
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve('')
        return
      }

      canvas.width = 600
      canvas.height = 900

      const gradients: Record<string, [string, string]> = {
        'neon-alley': ['#0a1520', '#2a3545'],
        'open-plaza': ['#0c1825', '#2a3a4a'],
        'rain-corridor': ['#081018', '#1a2a35'],
        'nature-finale': ['#0a1a15', '#2a3a2a'],
      }
      const [c1, c2] = gradients[currentZone] || gradients['neon-alley']
      const grad = ctx.createLinearGradient(0, 0, 0, 900)
      grad.addColorStop(0, c1)
      grad.addColorStop(1, c2)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 600, 900)

      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const imgH = 650
        const imgW = (img.width / img.height) * imgH
        const imgX = (600 - imgW) / 2
        ctx.drawImage(img, imgX, 150, imgW, imgH)

        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.font = '600 14px system-ui'
        ctx.textAlign = 'right'
        ctx.fillText('DUO DESIGN', 570, 870)

        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.font = '300 11px system-ui'
        ctx.textAlign = 'left'
        ctx.fillText(currentZone.replace('-', ' ').toUpperCase(), 30, 870)

        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => resolve('')
      img.src = '/avatars/character.png'
    })
  }, [currentZone])

  const capturePhoto = useCallback(async () => {
    if (capturing) return
    setCapturing(true)
    const dataUrl = await generateShareCard()
    if (!dataUrl) {
      setCapturing(false)
      return
    }
    addCapturedPhoto(dataUrl)
    await shareOrSave(dataUrl)
    setCapturing(false)
  }, [capturing, generateShareCard, addCapturedPhoto, shareOrSave])

  const enterPhotoMode = useCallback(() => {
    setPhase('photo-mode')
  }, [setPhase])

  const exitPhotoMode = useCallback(() => {
    setPhase('exploring')
  }, [setPhase])

  if (phase === 'exploring' && photoSpotNearby) {
    return (
      <>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <button
          onClick={enterPhotoMode}
          style={{
            position: 'fixed',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            background: 'rgba(255,255,255,0.14)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(180, 220, 255, 0.5)',
            borderRadius: '50px',
            padding: '12px 24px',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.14em',
            cursor: 'pointer',
            textTransform: 'uppercase',
            boxShadow: '0 0 20px rgba(160, 220, 255, 0.45)',
            animation: 'pulse 1.6s infinite',
          }}
        >
          Capture Duo Moment
        </button>
      </>
    )
  }

  if (phase === 'photo-mode') {
    return (
      <>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div style={{
          position: 'fixed',
          bottom: '40px',
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          color: 'rgba(255,255,255,0.75)',
          fontSize: '0.65rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          textAlign: 'center',
          zIndex: 30,
        }}>
          <div>Photo Mode Active</div>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '20px',
          }}>
            <button
              onClick={exitPhotoMode}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%',
                width: '50px',
                height: '50px',
                color: '#fff',
                fontSize: '0.62rem',
                letterSpacing: '0.08em',
                cursor: 'pointer',
              }}
            >
              EXIT
            </button>
            <button
              onClick={capturePhoto}
              disabled={capturing}
              style={{
                background: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '70px',
                height: '70px',
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(255,255,255,0.3)',
                opacity: capturing ? 0.6 : 1,
                transition: 'opacity 0.2s ease',
              }}
            />
            <div style={{ width: '50px' }} />
          </div>
        </div>
      </>
    )
  }

  return null
}
