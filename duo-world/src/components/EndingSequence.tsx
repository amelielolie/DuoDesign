import { useState, useEffect, useCallback, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

const VIDEO_SOURCES = [
  '/DUO_VIDEO.mp4?v=4',
  '/DUO_VIDEO.mp4',
]
const MAX_AUTO_RETRIES = 3

const createVideoUrl = (source: string) => {
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const blobVideoUrlRef = useRef<string | null>(null)
  const retryTimerRef = useRef<number | null>(null)
  const isIOS = isIOSDevice()

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
    setVideoUrl(createVideoUrl(VIDEO_SOURCES[0]))
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
  }, [phase, clearRetryTimer, resetVideoUiState])

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
    video.load()

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
      setVideoSourceIndex(VIDEO_SOURCES.length)
      setVideoUrl(objectUrl)
      setRangeProbeStatus('ok')
      return true
    } catch {
      return false
    } finally {
      setIsPreparingFallback(false)
    }
  }, [isPreparingFallback])

  const retryVideo = useCallback(async () => {
    resetVideoUiState()
    setRangeProbeStatus('idle')
    if (videoSourceIndex < VIDEO_SOURCES.length - 1) {
      const next = videoSourceIndex + 1
      setVideoSourceIndex(next)
      setVideoUrl(createVideoUrl(VIDEO_SOURCES[next]))
      return
    }

    if (blobVideoUrlRef.current) {
      setVideoSourceIndex(VIDEO_SOURCES.length)
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
  }, [prepareBlobFallback, resetVideoUiState, videoSourceIndex])

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
    const sourceIndex = Math.min(videoSourceIndex, VIDEO_SOURCES.length - 1)
    window.location.href = VIDEO_SOURCES[sourceIndex]
  }, [videoSourceIndex])

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
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#000',
          }}>
            <div style={{ position: 'relative', width: '100%', maxHeight: '85%', display: 'flex', justifyContent: 'center' }}>
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
                    maxHeight: '85vh',
                    aspectRatio: '3 / 4',
                    objectFit: 'contain',
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
            </div>

            {/* Play button — shows if autoplay didn't fire in 1.5s (iPhone) */}
            {showPlayButton && !videoStarted && !videoError && (
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
                  animation: 'fadeIn 0.4s ease',
                }}
              >
                PLAY VIDEO
              </button>
            )}

            {rangeProbeStatus === 'failed' && !videoStarted && (
              <div style={{
                marginTop: '0.55rem',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.58rem',
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
              }}>
                weak network/media response detected
              </div>
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
                  Video failed ({videoErrorLabel}).
                </div>
                <div style={{
                  marginTop: '0.35rem',
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: '0.58rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  source {videoSourceIndex >= VIDEO_SOURCES.length ? 'blob fallback' : `${videoSourceIndex + 1}/${VIDEO_SOURCES.length}`} · range {rangeProbeStatus} · auto-retry {autoRetryCount}/{MAX_AUTO_RETRIES}
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
                    {isPreparingFallback ? 'PREPARING…' : 'RETRY'}
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
    </>
  )
}
