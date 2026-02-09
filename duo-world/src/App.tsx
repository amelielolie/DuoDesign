import { useGameStore } from './store/gameStore'
import { SplashScreen } from './components/SplashScreen'
import { GameWorld } from './components/GameWorld'
import { EndingSequence } from './components/EndingSequence'
import { AmbientMusic } from './components/AmbientMusic'
import { PhotoModeUI } from './components/PhotoModeUI'

function SoundButton() {
  const soundMuted = useGameStore((s) => s.soundMuted)
  const toggleSound = useGameStore((s) => s.toggleSound)
  const phase = useGameStore((s) => s.phase)

  if (phase === 'splash' || phase === 'dancing' || phase === 'ending' || phase === 'reward') return null

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        toggleSound()
      }}
      onTouchStart={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: '12px',
        left: '12px',
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: '2px solid rgba(255, 255, 255, 0.4)',
        background: 'rgba(0, 0, 0, 0.5)',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 0,
        outline: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {soundMuted ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      )}
    </button>
  )
}

function App() {
  const phase = useGameStore((s) => s.phase)

  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      overflow: 'hidden',
      position: 'fixed',
      inset: 0,
      background: '#080e14',
    }}>
      {phase === 'splash' && <SplashScreen />}

      <GameWorld />
      <PhotoModeUI />
      <EndingSequence />
      <AmbientMusic />
      <SoundButton />
    </div>
  )
}

export default App
