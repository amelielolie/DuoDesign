import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { unlockAudioContext } from './AmbientMusic'
import { ZONE_BACKGROUNDS, FALLBACK_PANORAMIC } from '../utils/constants'

const SPLASH_HERO = '/branding/splash-hero.png'

// Player counter - fetches from /api/counter endpoint (serverless function)
// Falls back to localStorage-only tracking if no API is available
const COUNTER_API = '/api/counter'

function usePlayerCount() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    // Track locally regardless of API
    const localKey = 'duo-world-visit-count'
    const localCount = parseInt(localStorage.getItem(localKey) || '0', 10) + 1
    localStorage.setItem(localKey, String(localCount))

    const controller = new AbortController()
    fetch(COUNTER_API, {
      method: 'POST',
      signal: controller.signal,
    })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        if (typeof data?.count === 'number') setCount(data.count)
      })
      .catch(() => {
        // No API available — use local count as fallback
        if (localCount > 1) setCount(localCount)
      })
    return () => controller.abort()
  }, [])

  return count
}

// Preload critical game assets before allowing entry
const PRELOAD_IMAGES = [
  ...Object.values(ZONE_BACKGROUNDS),
  FALLBACK_PANORAMIC,
  '/avatars/sprite-walk-clean.png',
  '/avatars/sprite-idle-clean.png',
  '/avatars/sprite-jump-clean.png',
]

function preloadImages(): Promise<void> {
  return new Promise((resolve) => {
    let loaded = 0
    const total = PRELOAD_IMAGES.length
    const done = () => {
      loaded++
      if (loaded >= total) resolve()
    }
    PRELOAD_IMAGES.forEach((src) => {
      const img = new Image()
      img.onload = done
      img.onerror = done // don't block on missing images
      img.src = src
    })
    // Safety timeout - don't block more than 5 seconds
    setTimeout(resolve, 5000)
  })
}

export function SplashScreen() {
  const setPhase = useGameStore((s) => s.setPhase)
  const setAssetsReady = useGameStore((s) => s.setAssetsReady)
  const [logoReady, setLogoReady] = useState(false)
  const [assetsLoaded, setAssetsLoaded] = useState(false)
  const [starting, setStarting] = useState(false)
  const [showCta, setShowCta] = useState(false)
  const heroRef = useRef<HTMLImageElement>(null)
  const playerCount = usePlayerCount()

  // Show logo with staggered entrance
  useEffect(() => {
    const t1 = setTimeout(() => setLogoReady(true), 400)
    return () => clearTimeout(t1)
  }, [])

  // Preload assets
  useEffect(() => {
    preloadImages().then(() => {
      setAssetsLoaded(true)
      setAssetsReady(true)
    })
  }, [setAssetsReady])

  // Show CTA only after both logo is shown and assets are ready
  useEffect(() => {
    if (logoReady && assetsLoaded) {
      const timer = setTimeout(() => setShowCta(true), 600)
      return () => clearTimeout(timer)
    }
  }, [logoReady, assetsLoaded])

  const handleStart = () => {
    if (starting || !assetsLoaded) return
    setStarting(true)
    unlockAudioContext()
    setPhase('exploring')
  }

  return (
    <div
      onClick={handleStart}
      onPointerUp={handleStart}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        zIndex: 100,
        cursor: assetsLoaded ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent',
        overflow: 'hidden',
      }}
    >
      {/* Atmospheric background - hero image with blur and zoom */}
      <img
        ref={heroRef}
        src={SPLASH_HERO}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          animation: 'splashBgZoom 3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          filter: 'blur(8px) brightness(0.4) saturate(0.7)',
          pointerEvents: 'none',
        }}
      />

      {/* Dark overlay gradient */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 40%, rgba(10,10,10,0.4) 0%, rgba(10,10,10,0.85) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Brand logo text */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.4rem',
      }}>
        {/* Thin accent line above */}
        <div style={{
          width: logoReady ? '40px' : '0px',
          height: '1px',
          background: 'rgba(255,255,255,0.3)',
          transition: 'width 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.3s',
          marginBottom: '1rem',
        }} />

        <div style={{
          fontSize: 'clamp(2.5rem, 8vw, 4rem)',
          fontWeight: 200,
          color: '#fff',
          letterSpacing: '0.4em',
          textTransform: 'uppercase',
          opacity: logoReady ? 1 : 0,
          transform: logoReady ? 'translateY(0)' : 'translateY(15px)',
          transition: 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
          textIndent: '0.4em', // compensate letter-spacing for centering
        }}>
          DUO
        </div>
        <div style={{
          fontSize: 'clamp(0.6rem, 2vw, 0.85rem)',
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.5em',
          fontWeight: 300,
          opacity: logoReady ? 1 : 0,
          transform: logoReady ? 'translateY(0)' : 'translateY(10px)',
          transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1) 0.4s',
          textIndent: '0.5em',
        }}>
          DESIGN
        </div>

        {/* Thin accent line below */}
        <div style={{
          width: logoReady ? '40px' : '0px',
          height: '1px',
          background: 'rgba(255,255,255,0.3)',
          transition: 'width 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.5s',
          marginTop: '1rem',
        }} />
      </div>

      {/* Player counter - social proof */}
      {showCta && playerCount !== null && playerCount > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 'max(22%, calc(env(safe-area-inset-bottom, 0px) + 80px))',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          opacity: 0,
          animation: 'fadeIn 1s ease 0.3s forwards',
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#2ecc40',
            boxShadow: '0 0 6px rgba(46, 204, 64, 0.6)',
            animation: 'subtlePulse 2s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: '0.55rem',
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.1em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {playerCount.toLocaleString()} explorers have visited
          </span>
        </div>
      )}

      {/* Enter CTA */}
      {showCta && (
        <div style={{
          position: 'absolute',
          bottom: 'max(15%, calc(env(safe-area-inset-bottom, 0px) + 40px))',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.8rem',
          animation: 'splashTextSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}>
          <div style={{
            fontSize: '0.65rem',
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.2em',
            animation: 'subtlePulse 2.5s ease-in-out infinite',
          }}>
            TAP TO ENTER
          </div>
        </div>
      )}

      {/* Loading indicator (before assets ready) */}
      {!assetsLoaded && logoReady && (
        <div style={{
          position: 'absolute',
          bottom: 'max(15%, calc(env(safe-area-inset-bottom, 0px) + 40px))',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '0.55rem',
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.15em',
        }}>
          LOADING...
        </div>
      )}
    </div>
  )
}
