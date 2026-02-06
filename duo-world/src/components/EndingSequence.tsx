import { useState, useEffect, useCallback, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

const VIDEO_VERSION = '4'
const createVideoUrl = () => `/DUO_VIDEO.mp4?v=${VIDEO_VERSION}&cb=${Date.now()}`

function getMediaErrorLabel(errorCode?: number): string {
  switch (errorCode) {
    case 1:
      return 'aborted'
    case 2:
      return 'network'
    case 3:
      return 'decode'
    case 4:
      return 'unsupported-format'
    default:
      return 'unknown'
  }
}

export function EndingSequence() {
  const phase = useGameStore((s) => s.phase)
  const setPhase = useGameStore((s) => s.setPhase)
  const reset = useGameStore((s) => s.reset)
  const [stage, setStage] = useState<'video' | 'reward'>('video')
  const [cardImage, setCardImage] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState(createVideoUrl)
  const [videoStarted, setVideoStarted] = useState(false)
  const [videoMuted, setVideoMuted] = useState(true)
  const [autoplayFailed, setAutoplayFailed] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [videoErrorLabel, setVideoErrorLabel] = useState<string>('unknown')
  const [videoBuffering, setVideoBuffering] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasAttemptedUnmute = useRef(false)

  // Reset state when entering the ending phase
  useEffect(() => {
    if (phase !== 'ending') return
    setStage('video')
    setVideoUrl(createVideoUrl())
    setVideoStarted(false)
    setVideoMuted(true)
    setAutoplayFailed(false)
    setVideoError(false)
    setVideoErrorLabel('unknown')
    setVideoBuffering(false)
    hasAttemptedUnmute.current = false

    // Generate share card while video plays
    const cardTimer = setTimeout(() => generateCard(), 1000)

    return () => {
      clearTimeout(cardTimer)
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current)
      if (autoplayTimerRef.current) clearTimeout(autoplayTimerRef.current)
    }
  }, [phase])

  // Reload video when URL changes and attempt autoplay.
  // Strategy: autoplay muted (works everywhere), then try to unmute.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')
    video.muted = true
    video.load()

    hasAttemptedUnmute.current = false

    // After load, try autoplay
    const attemptAutoplay = async () => {
      try {
        // Try unmuted first (works on desktop)
        video.muted = false
        await video.play()
        setVideoStarted(true)
        setVideoMuted(false)
        setAutoplayFailed(false)
        return
      } catch {
        // Desktop unmuted autoplay blocked — try muted
      }

      try {
        video.muted = true
        await video.play()
        setVideoStarted(true)
        setVideoMuted(true)
        setAutoplayFailed(false)
      } catch {
        // Even muted autoplay failed — show play button
        setAutoplayFailed(true)
      }
    }

    // Wait for enough data to play
    const onCanPlay = () => {
      video.removeEventListener('canplay', onCanPlay)
      attemptAutoplay()
    }

    // If video already has enough data, play immediately
    if (video.readyState >= 3) {
      attemptAutoplay()
    } else {
      video.addEventListener('canplay', onCanPlay)
      // Safety timeout: if canplay never fires in 4s, show play button
      autoplayTimerRef.current = setTimeout(() => {
        video.removeEventListener('canplay', onCanPlay)
        if (!videoRef.current?.paused) return // already playing
        setAutoplayFailed(true)
      }, 4000)
    }

    return () => {
      video.removeEventListener('canplay', onCanPlay)
      if (autoplayTimerRef.current) clearTimeout(autoplayTimerRef.current)
    }
  }, [videoUrl])

  // Tap anywhere on the video to unmute (iOS requires user gesture to unmute)
  const handleUnmute = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.muted) return
    video.muted = false
    setVideoMuted(false)
  }, [])

  // Fallback play button handler — only shows if autoplay completely failed
  const handlePlayVideo = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    setVideoBuffering(true)

    try {
      video.muted = false
      await video.play()
      setVideoStarted(true)
      setVideoMuted(false)
      setAutoplayFailed(false)
      return
    } catch {
      // Fall back to muted
    }

    try {
      video.muted = true
      await video.play()
      setVideoStarted(true)
      setVideoMuted(true)
      setAutoplayFailed(false)
    } catch {
      const errorCode = video.error?.code
      setVideoError(true)
      setVideoErrorLabel(getMediaErrorLabel(errorCode))
      setVideoBuffering(false)
    }
  }, [])

  const retryVideo = useCallback(() => {
    setVideoUrl(createVideoUrl())
    setVideoStarted(false)
    setVideoMuted(true)
    setAutoplayFailed(false)
    setVideoError(false)
    setVideoErrorLabel('unknown')
    setVideoBuffering(false)
  }, [])

  const generateCard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 600
    canvas.height = 900

    // Dark gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, 900)
    grad.addColorStop(0, '#0a1520')
    grad.addColorStop(0.5, '#0c1825')
    grad.addColorStop(1, '#080e14')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 600, 900)

    // Load avatar
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const imgH = 650
      const imgW = (img.width / img.height) * imgH
      const imgX = (600 - imgW) / 2
      ctx.drawImage(img, imgX, 150, imgW, imgH)

      // Brand
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.font = '700 18px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('DUO DESIGN', 300, 860)

      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.font = '300 11px system-ui'
      ctx.fillText('DUO WORLD', 300, 880)

      setCardImage(canvas.toDataURL('image/png'))
    }
    img.src = '/avatars/character.png'
  }, [])

  const handleShare = useCallback(async () => {
    if (!cardImage) return
    const blob = await (await fetch(cardImage)).blob()
    const file = new File([blob], 'duo-world-moment.png', { type: 'image/png' })

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Duo World Moment',
          files: [file],
        })
      } catch {
        downloadImage()
      }
    } else {
      downloadImage()
    }
  }, [cardImage])

  const downloadImage = useCallback(() => {
    if (!cardImage) return
    const link = document.createElement('a')
    link.href = cardImage
    link.download = 'duo-world-moment.png'
    link.click()
  }, [cardImage])

  const handleReplay = useCallback(() => {
    setStage('video')
    setCardImage(null)
    reset()
  }, [reset])

  if (phase !== 'ending' && phase !== 'reward') return null

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#080e14',
        animation: 'fadeIn 1s ease',
      }}>
        {/* Brand video stage */}
        {stage === 'video' && (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#000',
          }}>
            <div style={{ position: 'relative', width: '100%', maxHeight: '85%', display: 'flex', justifyContent: 'center' }}>
              <video
                ref={videoRef}
                playsInline
                preload="auto"
                onPlay={() => {
                  setVideoStarted(true)
                  setVideoBuffering(false)
                  setAutoplayFailed(false)
                }}
                onCanPlay={() => {
                  setVideoError(false)
                  setVideoErrorLabel('unknown')
                  setVideoBuffering(false)
                }}
                onWaiting={() => {
                  setVideoBuffering(true)
                }}
                onPlaying={() => {
                  setVideoBuffering(false)
                }}
                onError={() => {
                  const errorCode = videoRef.current?.error?.code
                  setVideoError(true)
                  setVideoErrorLabel(getMediaErrorLabel(errorCode))
                  setVideoBuffering(false)
                }}
                onStalled={() => {
                  if (stallTimerRef.current) clearTimeout(stallTimerRef.current)
                  setVideoBuffering(true)
                  stallTimerRef.current = setTimeout(() => {
                    const video = videoRef.current
                    if (video && video.readyState < 3 && !video.paused) {
                      setVideoError(true)
                      setVideoErrorLabel('network')
                    }
                    setVideoBuffering(false)
                  }, 8000)
                }}
                onEnded={() => {
                  setStage('reward')
                  setPhase('reward')
                }}
                style={{
                  width: '100%',
                  maxHeight: '85vh',
                  aspectRatio: '3 / 4',
                  objectFit: 'contain',
                }}
              >
                <source src={videoUrl} type="video/mp4" />
              </video>

              {/* Tap to unmute overlay — shows when autoplaying muted (iPhone) */}
              {videoStarted && videoMuted && !videoError && (
                <div
                  onClick={handleUnmute}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    paddingBottom: '12%',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    background: 'rgba(0,0,0,0.55)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    borderRadius: '999px',
                    padding: '0.5rem 1.1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    animation: 'fadeIn 0.5s ease',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.5-.34 2.18" />
                    </svg>
                    <span style={{
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                    }}>
                      TAP TO UNMUTE
                    </span>
                  </div>
                </div>
              )}

              {/* Buffering spinner overlay */}
              {videoBuffering && videoStarted && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.35)',
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid rgba(255,255,255,0.2)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'videoSpin 0.8s linear infinite',
                  }} />
                </div>
              )}
            </div>

            {/* Fallback play button — only if autoplay completely failed */}
            {autoplayFailed && !videoStarted && !videoError && (
              <button
                onClick={handlePlayVideo}
                style={{
                  marginTop: '1rem',
                  background: '#fff',
                  color: '#0a0a0a',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.7rem 1.4rem',
                  fontSize: '0.7rem',
                  letterSpacing: '0.11em',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {videoBuffering ? 'LOADING...' : 'PLAY VIDEO'}
              </button>
            )}

            {videoError && (
              <>
                <div style={{
                  marginTop: '0.8rem',
                  color: 'rgba(255,255,255,0.72)',
                  fontSize: '0.68rem',
                  letterSpacing: '0.05em',
                  textAlign: 'center',
                }}>
                  Video playback failed ({videoErrorLabel}).
                </div>
                <div style={{
                  marginTop: '0.55rem',
                  display: 'flex',
                  gap: '0.6rem',
                  alignItems: 'center',
                }}>
                  <button
                    onClick={retryVideo}
                    style={{
                      background: 'rgba(255,255,255,0.16)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.35)',
                      borderRadius: '999px',
                      padding: '0.48rem 0.95rem',
                      fontSize: '0.62rem',
                      letterSpacing: '0.08em',
                      cursor: 'pointer',
                    }}
                  >
                    RETRY
                  </button>
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: '0.62rem',
                      letterSpacing: '0.08em',
                      textDecoration: 'underline',
                    }}
                  >
                    OPEN IN NATIVE PLAYER
                  </a>
                </div>
              </>
            )}

            <button
              onClick={() => {
                setStage('reward')
                setPhase('reward')
              }}
              style={{
                marginTop: '1rem',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.4)',
                fontSize: '0.7rem',
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
              SKIP
            </button>
          </div>
        )}

        {/* Reward stage */}
        {stage === 'reward' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '2rem',
            animation: 'fadeIn 1s ease',
          }}>
            {cardImage && (
              <div style={{
                width: '220px',
                height: '330px',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                marginBottom: '2rem',
              }}>
                <img
                  src={cardImage}
                  alt="Your Duo World moment"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '16px', marginBottom: '2rem' }}>
              <button
                onClick={handleShare}
                style={{
                  background: '#fff',
                  color: '#0a0a0a',
                  border: 'none',
                  borderRadius: '50px',
                  padding: '14px 28px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                }}
              >
                SHARE
              </button>
              <button
                onClick={downloadImage}
                style={{
                  background: 'transparent',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '50px',
                  padding: '14px 28px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                }}
              >
                SAVE
              </button>
            </div>

            <a
              href="https://duodesign.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                background: 'linear-gradient(135deg, #2ecc40, #1a8a2a)',
                color: '#fff',
                border: 'none',
                borderRadius: '50px',
                padding: '14px 28px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.05em',
                textDecoration: 'none',
                textAlign: 'center',
                marginBottom: '1.5rem',
              }}
            >
              CREATE WITH DUO
            </a>

            <button
              onClick={handleReplay}
              style={{
                background: 'none',
                border: 'none',
                color: '#5a7a8a',
                fontSize: '0.8rem',
                cursor: 'pointer',
                letterSpacing: '0.1em',
                marginBottom: '2rem',
              }}
            >
              REPLAY
            </button>

            {/* Artist credit */}
            <a
              href="https://instagram.com/amelielolie"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'rgba(255,255,255,0.35)',
                fontSize: '0.65rem',
                letterSpacing: '0.08em',
                textDecoration: 'none',
              }}
            >
              AI Experience @amelielolie
            </a>
          </div>
        )}
      </div>

      <style>{`
        @keyframes videoSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
