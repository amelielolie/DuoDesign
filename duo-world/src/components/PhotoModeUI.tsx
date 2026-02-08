import { useCallback, useRef, useState } from 'react'
import { useGameStore, type ZoneId } from '../store/gameStore'

const PANORAMIC_BG = '/backgrounds/panoramic-city.jpg'
const SPRITE_IDLE = '/avatars/sprite-idle-clean.png'
const SPRITE_WALK = '/avatars/sprite-walk-clean.png'
const SPRITE_JUMP = '/avatars/sprite-jump-clean.png'
const SPRITE_COLUMNS = 3
const SPRITE_ROWS = 3
const SPRITE_CYCLE_MS = 800

const ZONE_TINTS: Record<ZoneId, string> = {
  'neon-alley': 'rgba(90, 120, 255, 0.12)',
  'open-plaza': 'rgba(255, 195, 120, 0.09)',
  'rain-corridor': 'rgba(80, 150, 220, 0.14)',
  'nature-finale': 'rgba(180, 220, 255, 0.17)',
}

const ZONE_LABELS: Record<ZoneId, string> = {
  'neon-alley': 'neon alley',
  'open-plaza': 'open plaza',
  'rain-corridor': 'rain corridor',
  'nature-finale': 'blizzard zone',
}

function getCharacterSpriteSource(walking: boolean, jumping: boolean): string {
  if (jumping) return SPRITE_JUMP
  if (walking) return SPRITE_WALK
  return SPRITE_IDLE
}

export function PhotoModeUI() {
  const phase = useGameStore((s) => s.phase)
  const photoSpotNearby = useGameStore((s) => s.photoSpotNearby)
  const setPhase = useGameStore((s) => s.setPhase)
  const addCapturedPhoto = useGameStore((s) => s.addCapturedPhoto)
  const currentZone = useGameStore((s) => s.currentZone)
  const worldX = useGameStore((s) => s.worldX)
  const walking = useGameStore((s) => s.walking)
  const direction = useGameStore((s) => s.direction)
  const jumping = useGameStore((s) => s.jumping)
  const jumpY = useGameStore((s) => s.jumpY)
  const collectedBillCount = useGameStore((s) => s.collectedBills.size)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({})
  const [capturing, setCapturing] = useState(false)

  const loadImage = useCallback(async (src: string): Promise<HTMLImageElement> => {
    const cached = imageCacheRef.current[src]
    if (cached && cached.complete) return cached

    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        imageCacheRef.current[src] = img
        resolve(img)
      }
      img.onerror = () => reject(new Error(`failed to load ${src}`))
      img.src = src
    })
  }, [])

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

  const renderCurrentGameFrame = useCallback(async (): Promise<string> => {
    const canvas = canvasRef.current
    if (!canvas) return ''
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    const viewportWidth = Math.max(1, window.innerWidth)
    const viewportHeight = Math.max(1, window.innerHeight)
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
    const width = Math.round(viewportWidth * dpr)
    const height = Math.round(viewportHeight * dpr)

    canvas.width = width
    canvas.height = height

    try {
      const spriteSource = getCharacterSpriteSource(walking, jumping)
      const [panorama, sprite] = await Promise.all([
        loadImage(PANORAMIC_BG),
        loadImage(spriteSource),
      ])

      const panoramicHeight = height
      const panoramicWidth = (panorama.width / panorama.height) * panoramicHeight
      const maxScroll = Math.max(0, panoramicWidth - width)
      const scrollX = worldX * maxScroll

      ctx.fillStyle = '#080e14'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(panorama, -scrollX, 0, panoramicWidth, panoramicHeight)
      if (panoramicWidth - scrollX < width) {
        ctx.drawImage(panorama, -scrollX + panoramicWidth, 0, panoramicWidth, panoramicHeight)
      }

      ctx.fillStyle = ZONE_TINTS[currentZone]
      ctx.fillRect(0, 0, width, height)

      const vignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.2,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.75,
      )
      vignette.addColorStop(0, 'rgba(0,0,0,0)')
      vignette.addColorStop(1, 'rgba(0,0,0,0.42)')
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, width, height)

      const viewportScale = width / viewportWidth
      const characterWidth = Math.min(width * 0.45, 280 * viewportScale)
      const characterHeight = characterWidth * 1.3
      const characterLeft = width * 0.38
      const characterBottom = (0.12 + (jumpY / viewportHeight)) * height
      const characterTop = height - characterBottom - characterHeight

      const totalFrames = SPRITE_COLUMNS * SPRITE_ROWS
      const frameDuration = SPRITE_CYCLE_MS / totalFrames
      const frameIndex = (walking || jumping)
        ? Math.floor((Date.now() % SPRITE_CYCLE_MS) / frameDuration) % totalFrames
        : 0
      const frameWidth = sprite.width / SPRITE_COLUMNS
      const frameHeight = sprite.height / SPRITE_ROWS
      const sx = (frameIndex % SPRITE_COLUMNS) * frameWidth
      const sy = Math.floor(frameIndex / SPRITE_COLUMNS) * frameHeight

      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.58)'
      ctx.shadowBlur = 26 * viewportScale
      ctx.shadowOffsetY = 6 * viewportScale
      if (direction === -1) {
        ctx.translate(characterLeft + characterWidth, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(sprite, sx, sy, frameWidth, frameHeight, 0, characterTop, characterWidth, characterHeight)
      } else {
        ctx.drawImage(sprite, sx, sy, frameWidth, frameHeight, characterLeft, characterTop, characterWidth, characterHeight)
      }
      ctx.restore()

      const panelHeight = 44 * viewportScale
      const panelWidth = 164 * viewportScale
      ctx.fillStyle = 'rgba(0,0,0,0.42)'
      ctx.fillRect(width - panelWidth - (18 * viewportScale), 18 * viewportScale, panelWidth, panelHeight)
      ctx.fillStyle = '#2ecc40'
      ctx.font = `${Math.max(18, Math.round(22 * viewportScale))}px system-ui`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(`$ ${collectedBillCount}`, width - panelWidth - (8 * viewportScale), 18 * viewportScale + (panelHeight / 2))

      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.textAlign = 'center'
      ctx.font = `${Math.max(12, Math.round(14 * viewportScale))}px system-ui`
      ctx.fillText(ZONE_LABELS[currentZone].toUpperCase(), width / 2, 28 * viewportScale)

      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.textAlign = 'right'
      ctx.font = `${Math.max(10, Math.round(12 * viewportScale))}px system-ui`
      ctx.fillText('DUO WORLD', width - (18 * viewportScale), height - (18 * viewportScale))

      return canvas.toDataURL('image/png')
    } catch {
      return ''
    }
  }, [currentZone, direction, jumping, jumpY, loadImage, walking, worldX, collectedBillCount])

  const capturePhoto = useCallback(async () => {
    if (capturing) return
    setCapturing(true)
    const dataUrl = await renderCurrentGameFrame()
    if (!dataUrl) {
      setCapturing(false)
      return
    }
    addCapturedPhoto(dataUrl)
    await shareOrSave(dataUrl)
    setCapturing(false)
  }, [capturing, renderCurrentGameFrame, addCapturedPhoto, shareOrSave])

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
