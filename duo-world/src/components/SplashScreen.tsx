import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

export function SplashScreen() {
  const setPhase = useGameStore((s) => s.setPhase)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('exploring')
    }, 2000)
    return () => clearTimeout(timer)
  }, [setPhase])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      zIndex: 100,
    }}>
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
    </div>
  )
}
