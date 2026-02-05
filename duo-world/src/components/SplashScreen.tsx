import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { unlockAudioContext } from './AmbientMusic'

export function SplashScreen() {
  const setPhase = useGameStore((s) => s.setPhase)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  const handleStart = () => {
    // Unlock audio context during this user gesture (critical for iOS)
    unlockAudioContext()
    setPhase('exploring')
  }

  return (
    <div
      onClick={handleStart}
      onTouchEnd={(e) => {
        e.preventDefault()
        handleStart()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        zIndex: 100,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{
        fontSize: '2.5rem',
        fontWeight: 700,
        color: '#fff',
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        animation: 'fadeIn 1s ease-out',
      }}>
        DUO
      </div>
      <div style={{
        fontSize: '0.9rem',
        color: '#888',
        marginTop: '0.5rem',
        letterSpacing: '0.2em',
      }}>
        DESIGN
      </div>
      {ready && (
        <div style={{
          marginTop: '3rem',
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.15em',
          animation: 'fadeIn 1s ease-out',
        }}>
          TAP TO ENTER
        </div>
      )}
    </div>
  )
}
