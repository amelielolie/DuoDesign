import { useEffect, useRef, useCallback, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { MOVEMENT, ENDING_TRIGGER } from '../utils/constants'
import { Particles } from './Particles'
import type { ZoneId } from '../store/gameStore'

const PANORAMIC_BG = '/backgrounds/panoramic-city.jpg'

// Generate fixed bill positions across the world
function seededRandom(i: number, seed: number): number {
  const x = Math.sin((i + 1) * 9301 + seed * 49297) * 49271
  return x - Math.floor(x)
}

const BILL_COUNT = 20
const BILL_POSITIONS = Array.from({ length: BILL_COUNT }, (_, i) => ({
  x: 0.12 + (i / BILL_COUNT) * 0.78, // spread across 12%-90% of the world (first bill reachable)
  y: 20 + seededRandom(i, 100) * 35,  // height: 20-55% from bottom
}))

// Frozen bills - each triggers at a worldX and appears at a fixed screen spot
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

export function GameWorld() {
  const phase = useGameStore((s) => s.phase)
  const worldX = useGameStore((s) => s.worldX)
  const setWorldX = useGameStore((s) => s.setWorldX)
  const setWalking = useGameStore((s) => s.setWalking)
  const setDirection = useGameStore((s) => s.setDirection)
  const setJumping = useGameStore((s) => s.setJumping)
  const setJumpY = useGameStore((s) => s.setJumpY)
  const setCurrentZone = useGameStore((s) => s.setCurrentZone)
  const triggerEnding = useGameStore((s) => s.triggerEnding)
  const endingTriggered = useGameStore((s) => s.endingTriggered)
  const walking = useGameStore((s) => s.walking)
  const direction = useGameStore((s) => s.direction)
  const jumping = useGameStore((s) => s.jumping)
  const jumpY = useGameStore((s) => s.jumpY)
  const currentZone = useGameStore((s) => s.currentZone)
  const collectedBills = useGameStore((s) => s.collectedBills)
  const collectBill = useGameStore((s) => s.collectBill)

  const animFrameRef = useRef<number>(0)
  const directionRef = useRef<1 | -1 | 0>(0)
  const worldXRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const jumpPhaseRef = useRef(0)
  const isJumpingRef = useRef(false)
  const touchStartY = useRef(0)
  const [maxScroll, setMaxScroll] = useState(0)
  const [collectEffects, setCollectEffects] = useState<Array<{ id: number; x: number; y: number }>>([])
  const [iceBreakEffects, setIceBreakEffects] = useState<Array<{ id: number; x: number; y: number }>>([])
  const [collectedFrozenBills, setCollectedFrozenBills] = useState<Set<number>>(new Set())
  const [entered, setEntered] = useState(false)
  const effectIdRef = useRef(0)

  worldXRef.current = worldX

  // Character entrance animation
  useEffect(() => {
    if (phase === 'exploring' && !entered) {
      const timer = setTimeout(() => setEntered(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [phase, entered])

  // Determine current zone and trigger ending
  useEffect(() => {
    let zone: ZoneId = 'neon-alley'
    if (worldX >= 0.75) zone = 'nature-finale'
    else if (worldX >= 0.5) zone = 'rain-corridor'
    else if (worldX >= 0.25) zone = 'open-plaza'
    setCurrentZone(zone)

    if (worldX >= ENDING_TRIGGER && !endingTriggered) {
      triggerEnding()
    }
  }, [worldX, setCurrentZone, endingTriggered, triggerEnding])

  // Bill collision detection
  useEffect(() => {
    if (maxScroll === 0) return
    const factor = maxScroll / window.innerWidth * 100 + 100
    BILL_POSITIONS.forEach((bill, i) => {
      if (collectedBills.has(i)) return
      // Bill's screen position (%)
      const billScreenX = (bill.x - worldX) * factor
      // Character is at left: 38%, width ~25% of screen
      // Check if bill is within character's horizontal range
      if (Math.abs(billScreenX - 45) < 15) {
        // Vertical: character bottom 12% (+jumpY), height ~28%
        const charBottom = 12 + (jumpY / window.innerHeight) * 100
        const charTop = charBottom + 28
        if (bill.y >= charBottom - 5 && bill.y <= charTop + 5) {
          collectBill(i)
          const id = effectIdRef.current++
          setCollectEffects((prev) => [...prev, { id, x: billScreenX, y: bill.y }])
          setTimeout(() => {
            setCollectEffects((prev) => prev.filter((e) => e.id !== id))
          }, 800)
        }
      }
    })
  }, [worldX, jumpY, collectedBills, collectBill, maxScroll])

  // Frozen bill collision detection - screen-relative positioning
  useEffect(() => {
    if (worldX < 0.72) return
    FROZEN_BILLS.forEach((bill, i) => {
      if (collectedFrozenBills.has(i)) return
      // Bill is active when player is within 0.05 past its trigger point
      const dist = worldX - bill.trigger
      if (dist >= -0.01 && dist < 0.05) {
        // Bill sits at ~45% screen (right where character walks through it)
        const charBottom = 12 + (jumpY / window.innerHeight) * 100
        const charTop = charBottom + 28
        if (bill.y >= charBottom - 10 && bill.y <= charTop + 10) {
          setCollectedFrozenBills(prev => new Set([...prev, i]))
          collectBill(100 + i)
          const id = effectIdRef.current++
          setIceBreakEffects(prev => [...prev, { id, x: 45, y: bill.y }])
          setTimeout(() => {
            setIceBreakEffects(prev => prev.filter(e => e.id !== id))
          }, 1000)
        }
      }
    })
  }, [worldX, jumpY, collectedFrozenBills, collectBill])

  // Animation loop
  const animate = useCallback(() => {
    if (directionRef.current !== 0) {
      const delta = MOVEMENT.speed * directionRef.current
      const newX = Math.max(0, Math.min(worldXRef.current + delta, 1))
      setWorldX(newX)
    }

    if (isJumpingRef.current) {
      jumpPhaseRef.current += 0.06
      if (jumpPhaseRef.current >= Math.PI) {
        jumpPhaseRef.current = 0
        isJumpingRef.current = false
        setJumping(false)
        setJumpY(0)
      } else {
        const y = Math.sin(jumpPhaseRef.current) * 100
        setJumpY(y)
      }
    }

    animFrameRef.current = requestAnimationFrame(animate)
  }, [setWorldX, setJumping, setJumpY])

  useEffect(() => {
    if (phase !== 'exploring') return
    animFrameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [phase, animate])

  // Touch controls
  const isTouchingRef = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (phase !== 'exploring') return
    isTouchingRef.current = true
    const screenMid = window.innerWidth / 2
    const dir = e.clientX > screenMid ? 1 : -1
    directionRef.current = dir as 1 | -1
    setDirection(dir as 1 | -1)
    setWalking(true)
    touchStartY.current = e.clientY
  }, [phase, setWalking, setDirection])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isTouchingRef.current || phase !== 'exploring') return
    const screenMid = window.innerWidth / 2
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
      if (deltaY > 50 && !isJumpingRef.current) {
        isJumpingRef.current = true
        jumpPhaseRef.current = 0
        setJumping(true)
      }
    }
    directionRef.current = 0
    setWalking(false)
    touchStartY.current = 0
  }, [setWalking, setJumping])

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
        setDirection(1)
        setWalking(true)
      } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        directionRef.current = -1
        setDirection(-1)
        setWalking(true)
      } else if ((e.key === ' ' || e.key === 'ArrowUp') && !isJumpingRef.current) {
        isJumpingRef.current = true
        jumpPhaseRef.current = 0
        setJumping(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowRight', 'd', 'ArrowLeft', 'a'].includes(e.key)) {
        directionRef.current = 0
        setWalking(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [phase, setWalking, setDirection, setJumping])

  // Measure the panoramic strip width for scrolling
  useEffect(() => {
    const measure = () => {
      if (stripRef.current) {
        const stripWidth = stripRef.current.scrollWidth
        const viewWidth = window.innerWidth
        setMaxScroll(Math.max(0, stripWidth - viewWidth))
      }
    }
    measure()
    window.addEventListener('resize', measure)
    // Re-measure after images load
    const timer = setTimeout(measure, 500)
    return () => {
      window.removeEventListener('resize', measure)
      clearTimeout(timer)
    }
  }, [phase])

  if (phase !== 'exploring' && phase !== 'photo-mode') return null

  const scrollX = worldX * maxScroll

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
        background: '#0a1520',
      }}
    >
      {/* Panoramic city background */}
      <div
        ref={stripRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          transform: `translateX(-${scrollX}px)`,
          willChange: 'transform',
        }}
      >
        <img
          src={PANORAMIC_BG}
          alt=""
          draggable={false}
          style={{
            height: '100%',
            width: 'auto',
            display: 'block',
            pointerEvents: 'none',
            WebkitTouchCallout: 'none',
            userSelect: 'none',
          }}
          onLoad={() => {
            if (stripRef.current) {
              setMaxScroll(Math.max(0, stripRef.current.scrollWidth - window.innerWidth))
            }
          }}
        />
      </div>

      {/* Subtle vignette overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.35) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Dollar bills to collect */}
      {BILL_POSITIONS.map((bill, i) => {
        if (collectedBills.has(i)) return null
        // Position relative to viewport based on worldX
        const screenX = (bill.x - worldX) * (maxScroll / window.innerWidth * 100 + 100)
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
              border: '1px solid rgba(46, 204, 64, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 700,
              color: '#0a3d0a',
              boxShadow: '0 0 10px rgba(46, 204, 64, 0.4)',
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

      {/* Frozen dollar bills in blizzard zone - screen-relative */}
      {worldX >= 0.72 && FROZEN_BILLS.map((bill, i) => {
        if (collectedFrozenBills.has(i)) return null
        // Show bill from 0.04 before trigger to 0.06 after (wider window)
        const dist = worldX - bill.trigger
        if (dist < -0.04 || dist > 0.06) return null
        // Bill appears ahead at 75% and moves left to 25% as player walks through
        const screenX = 75 - (dist + 0.04) * (50 / 0.10)
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
              border: '2px solid rgba(173, 216, 230, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 900,
              color: '#1a5f7a',
              boxShadow: '0 0 20px rgba(173, 216, 230, 0.9), inset 0 0 10px rgba(255,255,255,0.6)',
              animation: 'frozenFloat 2s ease-in-out infinite',
              zIndex: 9,
              pointerEvents: 'none',
            }}
          >
            <span style={{ textShadow: '0 0 4px rgba(255,255,255,0.9)' }}>$</span>
            {/* Ice crystals */}
            <div style={{
              position: 'absolute',
              top: '-5px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '8px',
              height: '8px',
              background: 'rgba(255,255,255,0.95)',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            }} />
            <div style={{
              position: 'absolute',
              bottom: '-4px',
              right: '4px',
              width: '5px',
              height: '5px',
              background: 'rgba(200,230,255,0.95)',
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
          {/* Ice shatter burst */}
          <div style={{
            width: '80px',
            height: '80px',
            position: 'relative',
            transform: 'translate(-50%, 50%)',
          }}>
            {/* Ice shards flying out */}
            {[...Array(12)].map((_, i) => {
              const angle = i * 30
              const rad = (angle * Math.PI) / 180
              const dist = 40 + Math.random() * 30
              const endX = Math.cos(rad) * dist
              const endY = Math.sin(rad) * dist
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '5px',
                    height: '12px',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(173, 216, 230, 0.9))',
                    clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
                    animation: `iceShardFly${i} 0.7s ease-out forwards`,
                    opacity: 0.95,
                  }}
                >
                  <style>{`
                    @keyframes iceShardFly${i} {
                      0% { transform: translate(-50%, -50%) rotate(${angle}deg) scale(1); opacity: 1; }
                      100% { transform: translate(calc(-50% + ${endX}px), calc(-50% + ${endY}px)) rotate(${angle + 180}deg) scale(0.2); opacity: 0; }
                    }
                  `}</style>
                </div>
              )
            })}
            {/* Central flash */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.95), rgba(173,216,230,0.6) 40%, transparent 70%)',
              animation: 'iceFlash 0.5s ease-out forwards',
            }} />
          </div>
          {/* Floating +$ text (icy) */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#7dd3fc',
            fontSize: '1.4rem',
            fontWeight: 900,
            textShadow: '0 0 15px rgba(125, 211, 252, 0.9), 0 0 5px #fff',
            animation: 'collectText 0.8s ease-out forwards',
          }}>
            +$
          </div>
        </div>
      ))}

      {/* Collect effects — flash + floating +1 */}
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
          {/* Flash burst */}
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(46, 204, 64, 0.8), rgba(46, 204, 64, 0) 70%)',
            animation: 'collectFlash 0.6s ease-out forwards',
            transform: 'translate(-50%, 50%)',
          }} />
          {/* Floating +$ text */}
          <div style={{
            position: 'absolute',
            top: '-10px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#2ecc40',
            fontSize: '1.2rem',
            fontWeight: 900,
            textShadow: '0 0 10px rgba(46, 204, 64, 0.8)',
            animation: 'collectText 0.8s ease-out forwards',
          }}>
            +$
          </div>
        </div>
      ))}

      {/* Bill counter */}
      <div style={{
        position: 'absolute',
        top: '3%',
        right: '5%',
        color: '#2ecc40',
        fontSize: '1.1rem',
        fontWeight: 900,
        zIndex: 20,
        textShadow: '0 0 10px rgba(46, 204, 64, 0.6)',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        background: 'rgba(0,0,0,0.4)',
        padding: '4px 10px',
        borderRadius: '20px',
        border: '1px solid rgba(46, 204, 64, 0.3)',
      }}>
        <span style={{ fontSize: '1.2rem' }}>$</span>
        {collectedBills.size}
      </div>

      {/* Character — larger to match city scale */}
      <div style={{
        position: 'absolute',
        bottom: `${12 + (jumpY / window.innerHeight) * 100}%`,
        left: '38%',
        width: '45vw',
        maxWidth: '280px',
        aspectRatio: '1 / 1.3',
        backgroundImage: jumping
          ? 'url(/avatars/sprite-jump-clean.png)'
          : walking
            ? 'url(/avatars/sprite-walk-clean.png)'
            : 'url(/avatars/sprite-idle-clean.png)',
        backgroundSize: '300% 300%',
        backgroundPosition: (!walking && !jumping) ? '0% 0%' : undefined,
        animation: !entered
          ? 'characterEnter 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards'
          : (walking || jumping) ? 'spriteWalk 0.8s steps(1) infinite' : undefined,
        transform: entered ? (direction === -1 ? 'scaleX(-1)' : undefined) : undefined,
        // CSS variable for entrance animation direction
        ...(!entered ? { '--char-dir': direction === -1 ? -1 : 1 } as React.CSSProperties : {}),
        filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.6))',
        zIndex: 10,
      }} />

      {/* Particles overlay */}
      <Particles progress={worldX} />

      {/* Controls instruction */}
      {worldX < 0.02 && (
        <div style={{
          position: 'absolute',
          bottom: '5%',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(200, 220, 255, 0.7)',
          fontSize: '0.65rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          animation: 'pulse 2s ease-in-out infinite',
          textAlign: 'center',
          lineHeight: 1.8,
          whiteSpace: 'nowrap',
          zIndex: 20,
        }}>
          <div>HOLD RIGHT TO WALK</div>
          <div style={{ opacity: 0.6 }}>SWIPE UP TO JUMP</div>
        </div>
      )}

      {/* Zone name */}
      <div style={{
        position: 'absolute',
        top: '6%',
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#ffffff',
        fontSize: '0.6rem',
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        opacity: 0.35,
        zIndex: 20,
      }}>
        {currentZone === 'nature-finale' ? 'blizzard zone' : currentZone.replace('-', ' ')}
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'absolute',
        top: '3.5%',
        left: '10%',
        width: '80%',
        height: '2px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '1px',
        zIndex: 20,
      }}>
        <div style={{
          width: `${worldX * 100}%`,
          height: '100%',
          background: 'rgba(150, 200, 255, 0.5)',
          borderRadius: '1px',
          transition: 'width 0.1s linear',
        }} />
      </div>
    </div>
  )
}
