import { useState, useEffect, useCallback, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

const DEFAULT_VIDEO_SOURCES = [
  '/DUO_VIDEO.mp4?v=4',
  '/DUO_VIDEO.mp4',
]
const IOS_VIDEO_SOURCES = [
  '/DUO_VIDEO.mp4',
]
const MAX_AUTO_RETRIES = 3

const createVideoUrl = (source: string, cacheBust = true) => {
  if (!cacheBust) return source
  const joiner = source.includes('?') ? '&' : '?'
  return `${source}${joiner}cb=${Date.now()}`
}

function getMediaErrorLabel(code?: number): string {
  switch (code) {
    case 1:
      return 'aborted'
    case 2:
      return 'network'
    case 3:
      return 'decode'
    case 4:
      return 'unsupported'
    default:
      return 'unknown'
  }
}

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function EndingSequence() {
  const phase = useGameStore((s) => s.phase)
  const setPhase = useGameStore((s) => s.setPhase)
  const reset = useGameStore((s) => s.reset)
  const [stage, setStage] = useState<'video' | 'reward'>('video')
  const [cardImage, setCardImage] = useState<string | null>(null)
  const [videoSourceIndex, setVideoSourceIndex] = useState(0)
  // videoUrl is null until the ending phase — prevents premature requests
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoStarted, setVideoStarted] = useState(false)
  const [videoMuted, setVideoMuted] = useState(true)
  const [showPlayButton, setShowPlayButton] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [videoErrorLabel, setVideoErrorLabel] = useState('unknown')
  const [rangeProbeStatus, setRangeProbeStatus] = useState<'idle' | 'ok' | 'failed'>('idle')
  const [autoRetryCount, setAutoRetryCount] = useState(0)
  const [isPreparingFallback, setIsPreparingFallback] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null) // kept for share card generation
  const videoRef = useRef<HTMLVideoElement>(null)
  const blobVideoUrlRef = useRef<string | null>(null)
  const retryTimerRef = useRef<number | null>(null)
  const isIOS = isIOSDevice()
  const activeVideoSources = isIOS ? IOS_VIDEO_SOURCES : DEFAULT_VIDEO_SOURCES
  const shouldCacheBust = !isIOS

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }, [])

  const resetVideoUiState = useCallback(() => {
    setVideoStarted(false)
    setVideoMuted(true)
    setShowPlayButton(false)
    setVideoError(false)
    setVideoErrorLabel('unknown')
  }, [])

  useEffect(() => {
    return () => {
      clearRetryTimer()
      if (blobVideoUrlRef.current) {
        URL.revokeObjectURL(blobVideoUrlRef.current)
        blobVideoUrlRef.current = null
      }
    }
  }, [clearRetryTimer])

  // Create video URL and reset state when entering ending phase.
  // URL is created HERE only — not in useState — so the video element
  // mounts exactly once with the correct src (no double-request).
  useEffect(() => {
    if (phase !== 'ending') return
    setStage('video')
    setVideoSourceIndex(0)
    setVideoUrl(createVideoUrl(activeVideoSources[0], shouldCacheBust))
    resetVideoUiState()
    setRangeProbeStatus('idle')
    setAutoRetryCount(0)
    clearRetryTimer()
    if (blobVideoUrlRef.current) {
      URL.revokeObjectURL(blobVideoUrlRef.current)
      blobVideoUrlRef.current = null
    }

    const cardTimer = setTimeout(() => generateCard(), 1000)
    return () => clearTimeout(cardTimer)
  }, [phase, clearRetryTimer, resetVideoUiState, activeVideoSources, shouldCacheBust])

  // If autoplay doesn't fire within 1.5s, show play button.
  // Short timeout so iPhone users aren't staring at a black screen.
  useEffect(() => {
    if (phase !== 'ending' || !videoUrl || videoStarted) return
    const timer = setTimeout(() => {
      if (!videoStarted) setShowPlayButton(true)
    }, 1500)
    return () => clearTimeout(timer)
  }, [phase, videoUrl, videoStarted])

  useEffect(() => {
    if (phase !== 'ending' || !videoUrl) return
    const video = videoRef.current
    if (!video) return
    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')
    video.setAttribute('x-webkit-airplay', 'allow')
    video.playsInline = true
    video.muted = true
    // Don't call video.load() — the key prop change already triggers a load.
    // Calling it again causes a double-request, especially costly on iOS mobile.

    // On iPhone, muted autoplay is the safest automatic path. If it fails,
    // the explicit play CTA remains available.
    const timer = window.setTimeout(() => {
      void video.play().catch(() => {
        setShowPlayButton(true)
      })
    }, 60)

    return () => window.clearTimeout(timer)
  }, [phase, videoUrl])

  useEffect(() => {
    if (phase !== 'ending' || !videoUrl) return
    if (videoUrl.startsWith('blob:')) {
      setRangeProbeStatus('ok')
      return
    }
    const controller = new AbortController()
    fetch(videoUrl, {
      method: 'GET',
      headers: { Range: 'bytes=0-1023' },
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((res) => {
        if (res.status === 206 || res.status === 200) {
          setRangeProbeStatus('ok')
        } else {
          setRangeProbeStatus('failed')
        }
      })
      .catch(() => setRangeProbeStatus('failed'))
    return () => controller.abort()
  }, [phase, videoUrl])

  const prepareBlobFallback = useCallback(async (): Promise<boolean> => {
    if (isPreparingFallback) return false
    setIsPreparingFallback(true)
    try {
      const response = await fetch('/DUO_VIDEO.mp4', { cache: 'no-store' })
      if (!response.ok) return false
      const fetchedBlob = await response.blob()
      const videoBlob = fetchedBlob.type.startsWith('video/')
        ? fetchedBlob
        : new Blob([fetchedBlob], { type: 'video/mp4' })
      if (blobVideoUrlRef.current) {
        URL.revokeObjectURL(blobVideoUrlRef.current)
      }
      const objectUrl = URL.createObjectURL(videoBlob)
      blobVideoUrlRef.current = objectUrl
      setVideoSourceIndex(activeVideoSources.length)
      setVideoUrl(objectUrl)
      setRangeProbeStatus('ok')
      return true
    } catch {
      return false
    } finally {
      setIsPreparingFallback(false)
    }
  }, [isPreparingFallback, activeVideoSources.length])

  const retryVideo = useCallback(async () => {
    resetVideoUiState()
    setRangeProbeStatus('idle')
    if (videoSourceIndex < activeVideoSources.length - 1) {
      const next = videoSourceIndex + 1
      setVideoSourceIndex(next)
      setVideoUrl(createVideoUrl(activeVideoSources[next], shouldCacheBust))
      return
    }

    if (blobVideoUrlRef.current) {
      setVideoSourceIndex(activeVideoSources.length)
      setVideoUrl(blobVideoUrlRef.current)
      setRangeProbeStatus('ok')
      setShowPlayButton(true)
      return
    }

    const fallbackReady = await prepareBlobFallback()
    if (!fallbackReady) {
      setVideoError(true)
      setVideoErrorLabel('network')
      setShowPlayButton(true)
    }
  }, [prepareBlobFallback, resetVideoUiState, videoSourceIndex, activeVideoSources, shouldCacheBust])

  const markVideoFailure = useCallback((label: string) => {
    setVideoError(true)
    setVideoErrorLabel(label)
    setShowPlayButton(true)
    setAutoRetryCount((previous) => {
      if (previous >= MAX_AUTO_RETRIES) return previous
      clearRetryTimer()
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null
        void retryVideo()
      }, 220)
      return previous + 1
    })
  }, [clearRetryTimer, retryVideo])

  const handlePlay = useCallback(() => {
    const video = videoRef.current
    setVideoMuted(video?.muted ?? true)
  }, [])

  const handlePlaying = useCallback(() => {
    clearRetryTimer()
    setAutoRetryCount(0)
    setVideoStarted(true)
    setShowPlayButton(false)
    setVideoError(false)
    setVideoErrorLabel('unknown')
    const video = videoRef.current
    setVideoMuted(video?.muted ?? true)
  }, [clearRetryTimer])

  const handleUnmute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = false
    setVideoMuted(false)
  }, [])

  // User taps play button (gesture context — works on iOS)
  const handlePlayVideo = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    clearRetryTimer()

    try {
      video.muted = false
      await video.play()
      setVideoStarted(true)
      setVideoMuted(false)
      setShowPlayButton(false)
      setVideoError(false)
      setVideoErrorLabel('unknown')
      setAutoRetryCount(0)
      return
    } catch { /* fall back to muted */ }

    try {
      video.muted = true
      await video.play()
      setVideoStarted(true)
      setVideoMuted(true)
      setShowPlayButton(false)
      setVideoError(false)
      setVideoErrorLabel('unknown')
      setAutoRetryCount(0)
    } catch {
      markVideoFailure(getMediaErrorLabel(video.error?.code))
    }
  }, [clearRetryTimer, markVideoFailure])

  const openNativePlayer = useCallback(() => {
    const sourceIndex = Math.min(videoSourceIndex, activeVideoSources.length - 1)
    window.location.href = activeVideoSources[sourceIndex]
  }, [videoSourceIndex, activeVideoSources])

  const generateCard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 600
    canvas.height = 900

    const grad = ctx.createLinearGradient(0, 0, 0, 900)
    grad.addColorStop(0, '#0a1520')
    grad.addColorStop(0.5, '#0c1825')
    grad.addColorStop(1, '#080e14')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 600, 900)

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const imgH = 650
      const imgW = (img.width / img.height) * imgH
      const imgX = (600 - imgW) / 2
      ctx.drawImage(img, imgX, 150, imgW, imgH)

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
        await navigator.share({ title: 'My Duo World Moment', files: [file] })
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
    clearRetryTimer()
    if (blobVideoUrlRef.current) {
      URL.revokeObjectURL(blobVideoUrlRef.current)
      blobVideoUrlRef.current = null
    }
    setStage('video')
    setCardImage(null)
    setVideoSourceIndex(0)
    setVideoUrl(null)
    setAutoRetryCount(0)
    setVideoErrorLabel('unknown')
    setRangeProbeStatus('idle')
    setIsPreparingFallback(false)
    reset()
  }, [clearRetryTimer, reset])

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
        {stage === 'video' && (
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            background: '#000',
            overflow: 'hidden',
          }}>
            {videoUrl && (
              <video
                key={videoUrl}
                ref={videoRef}
                src={videoUrl}
                autoPlay
                muted
                playsInline
                preload="auto"
                controls={isIOS || videoError}
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                poster="/avatars/look1.png"
                onPlay={handlePlay}
                onPlaying={handlePlaying}
                onCanPlay={() => {
                  setVideoError(false)
                  setVideoErrorLabel('unknown')
                }}
                onError={() => {
                  const code = videoRef.current?.error?.code
                  markVideoFailure(getMediaErrorLabel(code))
                }}
                onStalled={() => {
                  markVideoFailure('network')
                }}
                onWaiting={() => {
                  const video = videoRef.current
                  if (!video || video.currentTime < 0.25) {
                    setShowPlayButton(true)
                  }
                }}
                onPause={() => {
                  const video = videoRef.current
                  if (video && !video.ended && video.currentTime < 0.25) {
                    setShowPlayButton(true)
                  }
                }}
                onEnded={() => {
                  setStage('reward')
                  setPhase('reward')
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            )}

            {/* Tap to unmute — shows when playing muted (iPhone) */}
            {videoStarted && videoMuted && (
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
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
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

            {/* Play button — shows if autoplay didn't fire in 1.5s (iPhone) */}
            {showPlayButton && !videoStarted && !videoError && (
              <button
                onClick={handlePlayVideo}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: '#fff',
                  color: '#0a0a0a',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.7rem 1.4rem',
                  fontSize: '0.7rem',
                  letterSpacing: '0.11em',
                  fontWeight: 700,
                  cursor: 'pointer',
                  animation: 'fadeIn 0.4s ease',
                }}
              >
                PLAY VIDEO
              </button>
            )}

            {rangeProbeStatus === 'failed' && !videoStarted && (
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '16px',
                transform: 'translateX(-50%)',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.58rem',
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
              }}>
                weak network/media response detected
              </div>
            )}

            {videoError && (
              <div style={{
                position: 'absolute',
                left: '50%',
                bottom: '12%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
              }}>
                <div style={{
                  color: 'rgba(255,255,255,0.72)',
                  fontSize: '0.68rem',
                  letterSpacing: '0.05em',
                }}>
                  Video failed ({videoErrorLabel}).
                </div>
                <div style={{
                  marginTop: '0.35rem',
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: '0.58rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  source {videoSourceIndex >= activeVideoSources.length ? 'blob fallback' : `${videoSourceIndex + 1}/${activeVideoSources.length}`} · range {rangeProbeStatus} · auto-retry {autoRetryCount}/{MAX_AUTO_RETRIES}
                </div>
                <div style={{
                  marginTop: '0.55rem',
                  display: 'flex',
                  gap: '0.8rem',
                  alignItems: 'center',
                }}>
                  <button
                    onClick={() => {
                      void retryVideo()
                    }}
                    disabled={isPreparingFallback}
                    style={{
                      background: 'rgba(255,255,255,0.16)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.35)',
                      borderRadius: '999px',
                      padding: '0.48rem 0.95rem',
                      fontSize: '0.62rem',
                      letterSpacing: '0.08em',
                      cursor: 'pointer',
                      opacity: isPreparingFallback ? 0.55 : 1,
                    }}
                  >
                    {isPreparingFallback ? 'PREPARING...' : 'RETRY'}
                  </button>
                  <button
                    onClick={openNativePlayer}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: '0.62rem',
                      letterSpacing: '0.08em',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    OPEN IN NATIVE PLAYER
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setStage('reward')
                setPhase('reward')
              }}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '0.7rem',
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
              SKIP
            </button>
          </div>
        )}

        {stage === 'reward' && (
          <div style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
          }}>
            {/* Atmospheric background — splash hero with blur */}
            <img
              src="/branding/splash-hero.png"
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(8px) brightness(0.35) saturate(0.6)',
                transform: 'scale(1.05)',
                pointerEvents: 'none',
                opacity: 0,
                animation: 'fadeIn 2s ease 0.2s forwards',
              }}
            />
            {/* Dark vignette overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at 50% 40%, rgba(10,10,10,0.3) 0%, rgba(10,10,10,0.85) 100%)',
              pointerEvents: 'none',
            }} />

            {/* Brand mark — mirrors the splash as a bookend */}
            <div style={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.4rem',
              opacity: 0,
              animation: 'rewardBrandReveal 2s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards',
            }}>
              {/* Thin accent line above */}
              <div style={{
                width: '40px',
                height: '1px',
                background: 'rgba(255,255,255,0.3)',
                marginBottom: '1rem',
              }} />

              <div style={{
                fontSize: 'clamp(2.8rem, 9vw, 4.5rem)',
                fontWeight: 200,
                color: '#fff',
                letterSpacing: '0.4em',
                textTransform: 'uppercase',
                textIndent: '0.4em',
              }}>
                DUO
              </div>
              <div style={{
                fontSize: 'clamp(0.65rem, 2.2vw, 0.9rem)',
                color: 'rgba(255,255,255,0.5)',
                letterSpacing: '0.5em',
                fontWeight: 300,
                textIndent: '0.5em',
              }}>
                DESIGN
              </div>

              {/* Thin accent line below */}
              <div style={{
                width: '40px',
                height: '1px',
                background: 'rgba(255,255,255,0.3)',
                marginTop: '1rem',
              }} />
            </div>

            {/* Primary CTA */}
            <a
              href="https://www.duo-designstudio.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                position: 'relative',
                zIndex: 2,
                display: 'block',
                background: '#fff',
                color: '#0a0a0a',
                border: 'none',
                borderRadius: '50px',
                padding: '14px 36px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.12em',
                textDecoration: 'none',
                textAlign: 'center',
                marginTop: '2.5rem',
                opacity: 0,
                animation: 'fadeIn 1s ease 1.5s forwards',
              }}
            >
              CREATE WITH DUO
            </a>

            {/* Secondary actions — subtle, below the fold */}
            <div style={{
              position: 'absolute',
              bottom: 'max(8%, calc(env(safe-area-inset-bottom, 0px) + 24px))',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              zIndex: 2,
              opacity: 0,
              animation: 'fadeIn 0.8s ease 2.5s forwards',
            }}>
              <div style={{ display: 'flex', gap: '24px' }}>
                <button
                  onClick={handleShare}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '50px',
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: '0.7rem',
                    padding: '10px 24px',
                    cursor: 'pointer',
                    letterSpacing: '0.15em',
                  }}
                >
                  SHARE
                </button>
                <button
                  onClick={handleReplay}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '50px',
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: '0.7rem',
                    padding: '10px 24px',
                    cursor: 'pointer',
                    letterSpacing: '0.15em',
                  }}
                >
                  EXPLORE AGAIN
                </button>
              </div>
              <a
                href="https://instagram.com/amelielolie"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '0.65rem',
                  letterSpacing: '0.12em',
                  textDecoration: 'none',
                }}
              >
                @amelielolie
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
