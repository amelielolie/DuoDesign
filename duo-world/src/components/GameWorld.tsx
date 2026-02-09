import { useEffect, useRef, useCallback, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import {
  MOVEMENT, ENDING_TRIGGER, PHOTO_SPOTS, ZONE_BLEND_WIDTH,
  ZONE_BACKGROUNDS, FALLBACK_PANORAMIC, ZONE_TINTS, ZONE_LABELS,
} from '../utils/constants'
import { Particles } from './Particles'
import type { ZoneId } from '../store/gameStore'

// Zone background paths in order
const ZONE_ORDER: ZoneId[] = ['neon-alley', 'open-plaza', 'rain-corridor', 'nature-finale']
const ZONE_BOUNDARIES = [0, 0.25, 0.5, 0.75, 1.0]

function getZoneBgOpacity(progress: number, zoneIdx: number): number {
  const start = ZONE_BOUNDARIES[zoneIdx]
  const end = ZONE_BOUNDARIES[zoneIdx + 1]
  const blend = ZONE_BLEND_WIDTH
  if (progress < start - blend || progress > end + blend) return 0
  if (progress >= start + blend && progress <= end - blend) return 1
  if (progress < start + blend) {
    return Math.max(0, Math.min(1, (progress - (start - blend)) / (blend * 2)))
  }
  return Math.max(0, Math.min(1, ((end + blend) - progress) / (blend * 2)))
}

// Generate fixed bill positions across the world
function seededRandom(i: number, seed: number): number {
  const x = Math.sin((i + 1) * 9301 + seed * 49297) * 49271
  return x - Math.floor(x)
}

const BILL_COUNT = 20
const BILL_POSITIONS = Array.from({ length: BILL_COUNT }, (_, i) => ({
  x: 0.12 + (i / BILL_COUNT) * 0.78,
  y: 20 + seededRandom(i, 100) * 35,
}))

const FROZEN_BILLS = [
  { trigger: 0.76, y: 28 },
  { trigger: 0.79, y: 42 },
  { trigger: 0.82, y: 25 },
  { trigger: 0.84, y: 38 },
  { trigger: 0.87, y: 32 },
  { trigger: 0.89, y: 45 },
  { trigger: 0.91, y: 22 },
  { trigger: 0.93, y: 35 },
]

let videoPreloaded = false
function preloadEndingVideo() {
  if (videoPreloaded) return
  videoPreloaded = true
  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.as = 'video'
  link.href = '/DUO_VIDEO.mp4?v=4'
  document.head.appendChild(link)
}

const HORIZONTAL_ACCEL_SMOOTHING = 0.2
const HORIZONTAL_DECAY = 0.82
const FIRST_JUMP_VELOCITY = 18
const DOUBLE_JUMP_VELOCITY = 15
const GRAVITY = 1.55
const VERTICAL_DAMPING = 0.985
const CAMERA_LERP = 0.12
const PHOTO_SPOT_THRESHOLD = 0.02
const STREAK_TIMEOUT_MS = 1600
const TARGET_FPS = 60

export function GameWorld() {
  const phase = useGameStore((s) => s.phase)
  const worldX = useGameStore((s) => s.worldX)
  const setWorldX = useGameStore((s) => s.setWorldX)
  const setWalking = useGameStore((s) => s.setWalking)
  const setDirection = useGameStore((s) => s.setDirection)
  const setJumping = useGameStore((s) => s.setJumping)
  const setJumpY = useGameStore((s) => s.setJumpY)
  const setJumpCount = useGameStore((s) => s.setJumpCount)
  const setPhotoSpotNearby = useGameStore((s) => s.setPhotoSpotNearby)
  const setCurrentZone = useGameStore((s) => s.setCurrentZone)
  const triggerEnding = useGameStore((s) => s.triggerEnding)
  const endingTriggered = useGameStore((s) => s.endingTriggered)
  const walking = useGameStore((s) => s.walking)
  const direction = useGameStore((s) => s.direction)
  const jumping = useGameStore((s) => s.jumping)
  const jumpY = useGameStore((s) => s.jumpY)
  const jumpCount = useGameStore((s) => s.jumpCount)
  const maxJumps = useGameStore((s) => s.maxJumps)
  const currentZone = useGameStore((s) => s.currentZone)
  const collectedBills = useGameStore((s) => s.collectedBills)
  const collectBill = useGameStore((s) => s.collectBill)
  const kicking = useGameStore((s) => s.kicking)
  const setKicking = useGameStore((s) => s.setKicking)
  const cameraShake = useGameStore((s) => s.cameraShake)
  const triggerCameraShake = useGameStore((s) => s.triggerCameraShake)
  const zoneAnnouncement = useGameStore((s) => s.zoneAnnouncement)
  const showZoneAnnouncement = useGameStore((s) => s.showZoneAnnouncement)
  const clearZoneAnnouncement = useGameStore((s) => s.clearZoneAnnouncement)

  const animFrameRef = useRef<number>(0)
  const directionRef = useRef<1 | -1 | 0>(0)
  const worldXRef = useRef(0)
  const displayWorldXRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const velocityRef = useRef(0)
  const jumpVelocityRef = useRef(0)
  const jumpYRef = useRef(0)
  const isJumpingRef = useRef(false)
  const jumpCountRef = useRef(0)
  const walkingRef = useRef(false)
  const streakRef = useRef(0)
  const lastCollectAtRef = useRef(0)
  const touchStartY = useRef(0)
  const kickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFrameTimeRef = useRef(0)
  const lastZoneRef = useRef<ZoneId>('neon-alley')
  const windowSizeRef = useRef({ w: window.innerWidth, h: window.innerHeight })
  const [maxScroll, setMaxScroll] = useState(0)
  const [displayWorldX, setDisplayWorldX] = useState(0)
  const [streak, setStreak] = useState(0)
  const [collectEffects, setCollectEffects] = useState<Array<{ id: number; x: number; y: number }>>([])
  const [iceBreakEffects, setIceBreakEffects] = useState<Array<{ id: number; x: number; y: number }>>([])
  const [collectedFrozenBills, setCollectedFrozenBills] = useState<Set<number>>(new Set())
  const [entered, setEntered] = useState(false)
  const [landingDust, setLandingDust] = useState<Array<{ id: number; x: number }>>([])
  const [zoneBgErrors, setZoneBgErrors] = useState<Set<number>>(new Set())
  const effectIdRef = useRef(0)
  const stripRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null])

  worldXRef.current = worldX
  displayWorldXRef.current = displayWorldX
  jumpYRef.current = jumpY
  jumpCountRef.current = jumpCount

  // Cache window dimensions
  useEffect(() => {
    const handleResize = () => {
      windowSizeRef.current = { w: window.innerWidth, h: window.innerHeight }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Character entrance animation
  useEffect(() => {
    if (phase === 'exploring' && !entered) {
      const timer = setTimeout(() => setEntered(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [phase, entered])

  // Determine current zone, trigger ending, zone announcements
  useEffect(() => {
    let zone: ZoneId = 'neon-alley'
    if (worldX >= 0.75) zone = 'nature-finale'
    else if (worldX >= 0.5) zone = 'rain-corridor'
    else if (worldX >= 0.25) zone = 'open-plaza'
    setCurrentZone(zone)

    // Zone announcement on zone change
    if (zone !== lastZoneRef.current && worldX > 0.01) {
      lastZoneRef.current = zone
      showZoneAnnouncement(ZONE_LABELS[zone])
      setTimeout(() => clearZoneAnnouncement(), 2500)
    }

    if (worldX >= 0.70) preloadEndingVideo()
    if (worldX >= ENDING_TRIGGER && !endingTriggered) triggerEnding()
  }, [worldX, setCurrentZone, endingTriggered, triggerEnding, showZoneAnnouncement, clearZoneAnnouncement])

  useEffect(() => {
    if (phase === 'exploring' && worldX < 0.001) {
      setDisplayWorldX(0)
      displayWorldXRef.current = 0
      streakRef.current = 0
      setStreak(0)
      lastZoneRef.current = 'neon-alley'
    }
  }, [phase, worldX])

  useEffect(() => {
    if (phase !== 'exploring') {
      setPhotoSpotNearby(false)
      return
    }
    const nearSpot = PHOTO_SPOTS.some((spot) => (
      Math.abs(worldX - spot.x) <= PHOTO_SPOT_THRESHOLD
    ))
    setPhotoSpotNearby(nearSpot)
  }, [phase, worldX, setPhotoSpotNearby])

  // Camera shake decay
  useEffect(() => {
    if (cameraShake <= 0) return
    const timer = setTimeout(() => triggerCameraShake(0), 200)
    return () => clearTimeout(timer)
  }, [cameraShake, triggerCameraShake])

  const triggerHaptic = useCallback((pattern: number | number[]) => {
    if (!('vibrate' in navigator)) return
    navigator.vibrate(pattern)
  }, [])

  const registerCollect = useCallback((icy: boolean) => {
    const now = Date.now()
    const comboActive = now - lastCollectAtRef.current < STREAK_TIMEOUT_MS
    const nextStreak = comboActive ? streakRef.current + 1 : 1
    lastCollectAtRef.current = now
    streakRef.current = nextStreak
    setStreak(nextStreak)
    triggerHaptic(icy ? [12, 26, 14] : 16)
    triggerCameraShake(icy ? 2 : 1)
  }, [triggerHaptic, triggerCameraShake])

  useEffect(() => {
    if (streak === 0) return
    const timer = setTimeout(() => {
      if (Date.now() - lastCollectAtRef.current >= STREAK_TIMEOUT_MS) {
        streakRef.current = 0
        setStreak(0)
      }
    }, STREAK_TIMEOUT_MS + 120)
    return () => clearTimeout(timer)
  }, [streak, worldX])

  // Bill collision detection
  useEffect(() => {
    if (maxScroll === 0) return
    const winW = windowSizeRef.current.w
    const winH = windowSizeRef.current.h
    const factor = maxScroll / winW * 100 + 100
    BILL_POSITIONS.forEach((bill, i) => {
      if (collectedBills.has(i)) return
      const billScreenX = (bill.x - worldX) * factor
      if (Math.abs(billScreenX - 45) < 15) {
        const charBottom = 12 + (jumpY / winH) * 100
        const charTop = charBottom + 28
        if (bill.y >= charBottom - 5 && bill.y <= charTop + 5) {
          collectBill(i)
          registerCollect(false)
          const id = effectIdRef.current++
          setCollectEffects((prev) => [...prev, { id, x: billScreenX, y: bill.y }])
          setTimeout(() => {
            setCollectEffects((prev) => prev.filter((e) => e.id !== id))
          }, 800)
        }
      }
    })
  }, [worldX, jumpY, collectedBills, collectBill, registerCollect, maxScroll])

  // Frozen bill collision
  useEffect(() => {
    if (worldX < 0.72) return
    const winH = windowSizeRef.current.h
    FROZEN_BILLS.forEach((bill, i) => {
      if (collectedFrozenBills.has(i)) return
      const dist = worldX - bill.trigger
      if (dist >= -0.03 && dist < 0.03) {
        const charBottom = 12 + (jumpY / winH) * 100
        const charTop = charBottom + 28
        if (bill.y >= charBottom - 10 && bill.y <= charTop + 10) {
          setCollectedFrozenBills(prev => new Set([...prev, i]))
          collectBill(100 + i)
          registerCollect(true)
          const id = effectIdRef.current++
          setIceBreakEffects(prev => [...prev, { id, x: 45, y: bill.y }])
          setTimeout(() => {
            setIceBreakEffects(prev => prev.filter(e => e.id !== id))
          }, 1000)
        }
      }
    })
  }, [worldX, jumpY, collectedFrozenBills, collectBill, registerCollect])

  const triggerJump = useCallback(() => {
    if (jumpCountRef.current >= maxJumps) return
    const isDoubleJump = jumpCountRef.current > 0
    const boost = isDoubleJump ? DOUBLE_JUMP_VELOCITY : FIRST_JUMP_VELOCITY
    isJumpingRef.current = true
    jumpVelocityRef.current = boost
    setJumping(true)
    const nextJumpCount = jumpCountRef.current + 1
    jumpCountRef.current = nextJumpCount
    setJumpCount(nextJumpCount)
    triggerHaptic(isDoubleJump ? [10, 18, 12] : 10)
  }, [maxJumps, setJumping, setJumpCount, triggerHaptic])

  const triggerKick = useCallback(() => {
    if (kicking || jumping) return
    setKicking(true)
    triggerHaptic([8, 20, 12])
    triggerCameraShake(1)
    if (kickTimerRef.current) clearTimeout(kickTimerRef.current)
    kickTimerRef.current = setTimeout(() => {
      setKicking(false)
      kickTimerRef.current = null
    }, 700)
  }, [kicking, jumping, setKicking, triggerHaptic, triggerCameraShake])

  // Landing dust effect
  const spawnLandingDust = useCallback(() => {
    const particles = Array.from({ length: 5 }, (_, i) => ({
      id: effectIdRef.current++,
      x: -20 + i * 10,
    }))
    setLandingDust(particles)
    triggerCameraShake(1)
    setTimeout(() => setLandingDust([]), 500)
  }, [triggerCameraShake])

  // Animation loop with frame-rate independence
  const animate = useCallback((timestamp: number) => {
    const deltaMs = lastFrameTimeRef.current > 0 ? timestamp - lastFrameTimeRef.current : 16.67
    lastFrameTimeRef.current = timestamp
    const dtFactor = Math.min(deltaMs / (1000 / TARGET_FPS), 3) // cap at 3x to prevent spiral

    if (directionRef.current !== 0) {
      const targetVelocity = MOVEMENT.speed * directionRef.current
      velocityRef.current += (targetVelocity - velocityRef.current) * HORIZONTAL_ACCEL_SMOOTHING * dtFactor
    } else {
      velocityRef.current *= Math.pow(HORIZONTAL_DECAY, dtFactor)
      if (Math.abs(velocityRef.current) < 0.00001) {
        velocityRef.current = 0
      }
    }

    if (velocityRef.current !== 0) {
      const newX = Math.max(0, Math.min(worldXRef.current + velocityRef.current * dtFactor, 1))
      if (newX === 0 || newX === 1) velocityRef.current = 0
      setWorldX(newX)
    }

    if (isJumpingRef.current) {
      const nextJumpY = jumpYRef.current + jumpVelocityRef.current * dtFactor
      jumpVelocityRef.current = (jumpVelocityRef.current - GRAVITY * dtFactor) * Math.pow(VERTICAL_DAMPING, dtFactor)

      if (nextJumpY <= 0 && jumpVelocityRef.current <= 0) {
        const wasHigh = jumpYRef.current > 30
        isJumpingRef.current = false
        jumpVelocityRef.current = 0
        jumpYRef.current = 0
        jumpCountRef.current = 0
        setJumping(false)
        setJumpY(0)
        setJumpCount(0)
        if (wasHigh) spawnLandingDust()
      } else {
        jumpYRef.current = Math.max(0, nextJumpY)
        setJumpY(jumpYRef.current)
      }
    }

    const targetDisplayX = worldXRef.current
    const nextDisplayX = displayWorldXRef.current + (targetDisplayX - displayWorldXRef.current) * CAMERA_LERP * dtFactor
    if (Math.abs(nextDisplayX - displayWorldXRef.current) > 0.00001) {
      displayWorldXRef.current = nextDisplayX
      setDisplayWorldX(nextDisplayX)
    }

    const moving = Math.abs(velocityRef.current) > 0.00008
    if (moving !== walkingRef.current) {
      walkingRef.current = moving
      setWalking(moving)
    }

    animFrameRef.current = requestAnimationFrame(animate)
  }, [setWorldX, setJumping, setJumpY, setJumpCount, setWalking, spawnLandingDust])

  useEffect(() => {
    if (phase !== 'exploring') return
    lastFrameTimeRef.current = 0
    animFrameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [phase, animate])

  // Touch controls
  const isTouchingRef = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (phase !== 'exploring') return
    isTouchingRef.current = true
    const screenMid = windowSizeRef.current.w / 2
    const dir = e.clientX > screenMid ? 1 : -1
    directionRef.current = dir as 1 | -1
    velocityRef.current *= 0.7
    setDirection(dir as 1 | -1)
    setWalking(true)
    touchStartY.current = e.clientY
  }, [phase, setWalking, setDirection])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isTouchingRef.current || phase !== 'exploring') return
    const screenMid = windowSizeRef.current.w / 2
    const dir = e.clientX > screenMid ? 1 : -1
    if (dir !== directionRef.current) {
      directionRef.current = dir as 1 | -1
      setDirection(dir as 1 | -1)
    }
  }, [phase, setDirection])

  const handlePointerUp = useCallback((e: React.PointerEvent | PointerEvent) => {
    isTouchingRef.current = false
    if (touchStartY.current > 0 && 'clientY' in e) {
      const deltaY = touchStartY.current - e.clientY
      if (deltaY > 50) triggerJump()
      else if (deltaY < -50) triggerKick()
    }
    directionRef.current = 0
    touchStartY.current = 0
  }, [triggerJump, triggerKick])

  useEffect(() => {
    const handler = (e: PointerEvent) => handlePointerUp(e)
    window.addEventListener('pointerup', handler)
    window.addEventListener('pointercancel', handler)
    return () => {
      window.removeEventListener('pointerup', handler)
      window.removeEventListener('pointercancel', handler)
    }
  }, [handlePointerUp])

  // Keyboard controls
  useEffect(() => {
    if (phase !== 'exploring') return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'd') {
        directionRef.current = 1
        velocityRef.current *= 0.7
        setDirection(1)
        setWalking(true)
      } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        directionRef.current = -1
        velocityRef.current *= 0.7
        setDirection(-1)
        setWalking(true)
      } else if (e.key === ' ' || e.key === 'ArrowUp') {
        triggerJump()
      } else if (e.key === 'ArrowDown' || e.key === 's') {
        triggerKick()
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowRight', 'd', 'ArrowLeft', 'a'].includes(e.key)) {
        directionRef.current = 0
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [phase, setWalking, setDirection, triggerJump, triggerKick])

  // Measure background strip width
  useEffect(() => {
    const measure = () => {
      // Find the first successfully loaded strip
      for (const strip of stripRefs.current) {
        if (strip && strip.scrollWidth > windowSizeRef.current.w) {
          setMaxScroll(Math.max(0, strip.scrollWidth - windowSizeRef.current.w))
          return
        }
      }
      // Fallback measure
      setMaxScroll(windowSizeRef.current.w * 3)
    }
    measure()
    window.addEventListener('resize', measure)
    const timer = setTimeout(measure, 500)
    return () => {
      window.removeEventListener('resize', measure)
      clearTimeout(timer)
    }
  }, [phase])

  if (phase !== 'exploring' && phase !== 'photo-mode') return null

  const scrollX = displayWorldX * maxScroll
  const parallaxFactor = maxScroll / windowSizeRef.current.w * 100 + 100
  const shakeClass = cameraShake === 2 ? 'shakeMedium' : cameraShake === 1 ? 'shakeSmall' : ''

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        background: '#0a0a0a',
        animation: shakeClass ? `${shakeClass} 0.15s ease-in-out` : undefined,
      }}
    >
      {/* Zone-specific panoramic backgrounds with crossfade */}
      {ZONE_ORDER.map((zone, idx) => {
        const opacity = getZoneBgOpacity(displayWorldX, idx)
        if (opacity <= 0 && !zoneBgErrors.has(idx)) return null
        return (
          <div
            key={zone}
            ref={(el) => { stripRefs.current[idx] = el }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              transform: `translateX(-${scrollX}px)`,
              willChange: 'transform',
              opacity: zoneBgErrors.has(idx) ? 0 : opacity,
              transition: 'opacity 0.3s ease',
            }}
          >
            <img
              src={ZONE_BACKGROUNDS[zone]}
              alt=""
              draggable={false}
              style={{
                height: '100%',
                width: 'auto',
                display: 'block',
                pointerEvents: 'none',
                WebkitTouchCallout: 'none',
                userSelect: 'none',
                minWidth: `${windowSizeRef.current.w * 4}px`,
              }}
              onError={() => setZoneBgErrors(prev => new Set([...prev, idx]))}
              onLoad={() => {
                const strip = stripRefs.current[idx]
                if (strip) {
                  setMaxScroll(prev => Math.max(prev, strip.scrollWidth - windowSizeRef.current.w))
                }
              }}
            />
          </div>
        )
      })}

      {/* Fallback panoramic (always visible behind zone backgrounds) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          transform: `translateX(-${scrollX}px)`,
          willChange: 'transform',
          zIndex: 0,
        }}
      >
        <img
          src={FALLBACK_PANORAMIC}
          alt=""
          draggable={false}
          style={{
            height: '100%',
            width: 'auto',
            display: 'block',
            pointerEvents: 'none',
            minWidth: `${windowSizeRef.current.w * 4}px`,
          }}
          onLoad={(e) => {
            const img = e.currentTarget
            const parent = img.parentElement
            if (parent) {
              setMaxScroll(prev => Math.max(prev, parent.scrollWidth - windowSizeRef.current.w))
            }
          }}
        />
      </div>

      {/* Vignette overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.45) 100%)',
        pointerEvents: 'none',
        zIndex: 3,
      }} />

      {/* Zone color grade */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: ZONE_TINTS[currentZone],
        mixBlendMode: 'screen',
        transition: 'background 1.5s ease',
        pointerEvents: 'none',
        zIndex: 4,
      }} />

      {/* Photo spot markers */}
      {PHOTO_SPOTS.map((spot, i) => {
        const screenX = (spot.x - displayWorldX) * parallaxFactor
        if (screenX < -10 || screenX > 110) return null
        const nearby = Math.abs(worldX - spot.x) <= PHOTO_SPOT_THRESHOLD
        return (
          <div
            key={`spot-${i}`}
            style={{
              position: 'absolute',
              left: `${screenX}%`,
              bottom: '10%',
              transform: 'translateX(-50%)',
              width: nearby ? '42px' : '30px',
              height: nearby ? '42px' : '30px',
              borderRadius: '50%',
              border: nearby ? '2px solid rgba(255,255,255,0.9)' : '1px solid rgba(255,255,255,0.5)',
              background: nearby
                ? 'radial-gradient(circle, rgba(255,255,255,0.35), rgba(120,190,255,0.06))'
                : 'radial-gradient(circle, rgba(255,255,255,0.15), transparent)',
              boxShadow: nearby
                ? '0 0 30px rgba(170, 210, 255, 0.8), 0 0 60px rgba(170, 210, 255, 0.3)'
                : '0 0 16px rgba(120, 190, 255, 0.35)',
              animation: nearby ? 'photoSpotPulse 1s ease-in-out infinite' : 'photoSpotPulse 2.2s ease-in-out infinite',
              pointerEvents: 'none',
              zIndex: 9,
            }}
          />
        )
      })}

      {/* Dollar bills */}
      {BILL_POSITIONS.map((bill, i) => {
        if (collectedBills.has(i)) return null
        const screenX = (bill.x - displayWorldX) * parallaxFactor
        if (screenX < -10 || screenX > 110) return null
        return (
          <div
            key={`bill-${i}`}
            style={{
              position: 'absolute',
              bottom: `${bill.y}%`,
              left: `${screenX}%`,
              width: '28px',
              height: '16px',
              background: 'linear-gradient(135deg, #1a6b1a, #2ecc40, #1a6b1a)',
              borderRadius: '2px',
              border: '1px solid rgba(46, 204, 64, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 700,
              color: '#0a3d0a',
              animation: 'billFloat 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`,
              zIndex: 8,
              pointerEvents: 'none',
            }}
          >
            $
          </div>
        )
      })}

      {/* Frozen dollar bills */}
      {worldX >= 0.72 && FROZEN_BILLS.map((bill, i) => {
        if (collectedFrozenBills.has(i)) return null
        const dist = displayWorldX - bill.trigger
        if (dist < -0.05 || dist > 0.05) return null
        const screenX = 75 - (dist + 0.05) * (50 / 0.10)
        return (
          <div
            key={`frozen-${i}`}
            style={{
              position: 'absolute',
              bottom: `${bill.y}%`,
              left: `${screenX}%`,
              width: '36px',
              height: '22px',
              background: 'linear-gradient(135deg, #a8d8ea, #caf0f8, #90e0ef)',
              borderRadius: '3px',
              border: '2px solid rgba(173, 216, 230, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 900,
              color: '#1a5f7a',
              animation: 'frozenFloat 2s ease-in-out infinite',
              zIndex: 9,
              pointerEvents: 'none',
            }}
          >
            <span style={{ textShadow: '0 0 4px rgba(255,255,255,0.8)' }}>$</span>
            <div style={{
              position: 'absolute',
              top: '-5px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '8px',
              height: '8px',
              background: 'rgba(255,255,255,0.9)',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            }} />
          </div>
        )
      })}

      {/* Ice break effects */}
      {iceBreakEffects.map((effect) => (
        <div
          key={`ice-${effect.id}`}
          style={{
            position: 'absolute',
            bottom: `${effect.y}%`,
            left: `${effect.x}%`,
            zIndex: 30,
            pointerEvents: 'none',
          }}
        >
          <div style={{
            width: '60px',
            height: '60px',
            position: 'relative',
            transform: 'translate(-50%, 50%)',
          }}>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.9), rgba(173,216,230,0.5) 40%, transparent 70%)',
              animation: 'iceFlash 0.5s ease-out forwards',
            }} />
          </div>
          <div style={{
            position: 'absolute',
            top: '-20px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#7dd3fc',
            fontSize: '1.4rem',
            fontWeight: 900,
            textShadow: '0 0 12px rgba(125, 211, 252, 0.8)',
            animation: 'collectText 0.8s ease-out forwards',
          }}>
            +$
          </div>
        </div>
      ))}

      {/* Collect effects */}
      {collectEffects.map((effect) => (
        <div
          key={effect.id}
          style={{
            position: 'absolute',
            bottom: `${effect.y}%`,
            left: `${effect.x}%`,
            zIndex: 30,
            pointerEvents: 'none',
          }}
        >
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(46, 204, 64, 0.7), transparent 70%)',
            animation: 'collectFlash 0.6s ease-out forwards',
            transform: 'translate(-50%, 50%)',
          }} />
          <div style={{
            position: 'absolute',
            top: '-10px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#2ecc40',
            fontSize: '1.2rem',
            fontWeight: 900,
            textShadow: '0 0 8px rgba(46, 204, 64, 0.7)',
            animation: 'collectText 0.8s ease-out forwards',
          }}>
            +$
          </div>
        </div>
      ))}

      {/* === HUD === */}
      {/* Top bar with unified layout */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: 'env(safe-area-inset-top, 12px) 16px 0',
        zIndex: 20,
        animation: 'hudSlideIn 0.6s ease-out',
      }}>
        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: '3px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '2px',
          marginTop: '8px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${worldX * 100}%`,
            height: '100%',
            background: 'linear-gradient(90deg, rgba(130,60,255,0.7), rgba(255,180,80,0.7), rgba(60,140,220,0.7), rgba(160,210,255,0.7))',
            backgroundSize: '400% 100%',
            backgroundPosition: `${worldX * 100}% 0`,
            borderRadius: '2px',
            transition: 'width 0.1s linear',
          }} />
        </div>

        {/* Zone indicator dots on progress bar */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '0px',
          marginTop: '-5px',
        }}>
          {[0.25, 0.5, 0.75].map((pos) => (
            <div key={pos} style={{
              position: 'absolute',
              left: `${pos * 100}%`,
              top: '0',
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: worldX >= pos ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)',
              transform: 'translate(-50%, -1px)',
            }} />
          ))}
        </div>

        {/* HUD row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '12px',
        }}>
          {/* Jump indicator */}
          <div style={{
            display: 'flex',
            gap: '5px',
            alignItems: 'center',
            padding: '5px 10px',
            borderRadius: '16px',
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
              <polyline points="18,15 12,9 6,15" />
            </svg>
            {Array.from({ length: maxJumps }, (_, i) => (
              <span
                key={`jump-${i}`}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: i < jumpCount ? 'rgba(255,255,255,0.15)' : 'rgba(180,225,255,0.85)',
                  transition: 'all 0.2s ease',
                  display: 'inline-block',
                }}
              />
            ))}
          </div>

          {/* Zone name */}
          <div style={{
            fontSize: '0.55rem',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
            textIndent: '0.25em',
          }}>
            {ZONE_LABELS[currentZone]}
          </div>

          {/* Bill counter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 10px',
            borderRadius: '16px',
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            border: '1px solid rgba(46, 204, 64, 0.2)',
          }}>
            <span style={{
              color: '#2ecc40',
              fontSize: '0.9rem',
              fontWeight: 800,
            }}>$</span>
            <span style={{
              color: '#2ecc40',
              fontSize: '0.85rem',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {collectedBills.size}
            </span>
          </div>
        </div>
      </div>

      {/* Combo streak */}
      {streak > 1 && (
        <div style={{
          position: 'absolute',
          top: '14%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 24,
          color: '#c7f0ff',
          fontSize: '0.7rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontWeight: 700,
          textShadow: '0 0 16px rgba(130,210,255,0.8)',
          animation: 'pulse 1.2s ease-in-out infinite',
        }}>
          Flow x{streak}
        </div>
      )}

      {/* Zone announcement */}
      {zoneAnnouncement && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 25,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          animation: 'zoneAnnounceIn 2.5s ease-in-out forwards',
          pointerEvents: 'none',
        }}>
          <div style={{
            height: '1px',
            background: 'rgba(255,255,255,0.4)',
            animation: 'zoneLineExpand 2.5s ease-in-out forwards',
          }} />
          <div style={{
            fontSize: 'clamp(1.2rem, 5vw, 2rem)',
            fontWeight: 200,
            color: 'rgba(255,255,255,0.85)',
            letterSpacing: '0.35em',
            textIndent: '0.35em',
            textTransform: 'uppercase',
          }}>
            {zoneAnnouncement}
          </div>
          <div style={{
            height: '1px',
            background: 'rgba(255,255,255,0.4)',
            animation: 'zoneLineExpand 2.5s ease-in-out forwards',
          }} />
        </div>
      )}

      {/* Character */}
      <div style={{
        position: 'absolute',
        bottom: `${12 + (jumpY / windowSizeRef.current.h) * 100}%`,
        left: '38%',
        width: '45vw',
        maxWidth: '280px',
        aspectRatio: '1 / 1.3',
        backgroundImage: kicking
          ? 'url(/avatars/sprite-kick-clean.png)'
          : jumping
            ? 'url(/avatars/sprite-jump-clean.png)'
            : walking
              ? 'url(/avatars/sprite-walk-clean.png)'
              : 'url(/avatars/sprite-idle-clean.png)',
        backgroundSize: '300% 300%',
        backgroundPosition: (!walking && !jumping && !kicking) ? '0% 0%' : undefined,
        animation: !entered
          ? 'characterEnter 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards'
          : kicking
            ? 'spriteKick 0.7s steps(1) forwards'
            : (walking || jumping) ? 'spriteWalk 0.8s steps(1) infinite' : undefined,
        transform: entered ? (direction === -1 ? 'scaleX(-1)' : undefined) : undefined,
        ...(!entered ? { '--char-dir': direction === -1 ? -1 : 1 } as React.CSSProperties : {}),
        filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.7))',
        zIndex: 10,
      }} />

      {/* Landing dust particles */}
      {landingDust.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            bottom: '12%',
            left: '45%',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'rgba(200, 200, 200, 0.5)',
            ['--dx' as string]: `${p.x}px`,
            animation: 'landingDust 0.4s ease-out forwards',
            zIndex: 11,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Particles overlay */}
      <Particles progress={displayWorldX} />

      {/* Controls instruction */}
      {worldX < 0.02 && entered && (
        <div style={{
          position: 'absolute',
          bottom: 'max(5%, calc(env(safe-area-inset-bottom, 0px) + 12px))',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(200, 220, 255, 0.6)',
          fontSize: '0.6rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          animation: 'subtlePulse 2.5s ease-in-out infinite',
          textAlign: 'center',
          lineHeight: 2,
          whiteSpace: 'nowrap',
          zIndex: 20,
        }}>
          <div>TAP RIGHT TO WALK</div>
          <div style={{ opacity: 0.6 }}>SWIPE UP TO JUMP</div>
          <div style={{ opacity: 0.4 }}>SWIPE DOWN TO KICK</div>
        </div>
      )}
    </div>
  )
}
