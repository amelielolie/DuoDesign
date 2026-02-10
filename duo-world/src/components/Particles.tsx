import { useMemo } from 'react'
import { ZONE_BLEND_WIDTH } from '../utils/constants'

interface ParticleData {
  x: number
  y: number
  size: number
  speed: number
  delay: number
  opacity: number
}

// Calculate zone opacity with crossfade blending
function getZoneOpacity(progress: number, zoneStart: number, zoneEnd: number): number {
  const blend = ZONE_BLEND_WIDTH
  if (progress < zoneStart - blend || progress > zoneEnd + blend) return 0
  if (progress >= zoneStart + blend && progress <= zoneEnd - blend) return 1
  if (progress < zoneStart + blend) {
    return Math.max(0, Math.min(1, (progress - (zoneStart - blend)) / (blend * 2)))
  }
  return Math.max(0, Math.min(1, ((zoneEnd + blend) - progress) / (blend * 2)))
}

const prefersReducedMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Particles({ progress }: { progress: number }) {
  if (prefersReducedMotion) return null
  const neonOpacity = getZoneOpacity(progress, 0, 0.20)
  const plazaOpacity = getZoneOpacity(progress, 0.20, 0.40)
  const rainOpacity = getZoneOpacity(progress, 0.40, 0.60)
  const natureOpacity = getZoneOpacity(progress, 0.60, 1.0)
  const blizzardIntensity = progress >= 0.60 ? Math.min(1, (progress - 0.60) / 0.40) : 0

  const neonSparks = useMemo<ParticleData[]>(() => (
    Array.from({ length: 24 }, () => ({
      x: Math.random() * 100,
      y: 15 + Math.random() * 70,
      size: 1.5 + Math.random() * 2.5,
      speed: 2.8 + Math.random() * 3.2,
      delay: Math.random() * 3,
      opacity: 0.3 + Math.random() * 0.5,
    }))
  ), [])

  const embers = useMemo<ParticleData[]>(() => (
    Array.from({ length: 30 }, () => ({
      x: Math.random() * 100,
      y: 40 + Math.random() * 55,
      size: 2 + Math.random() * 3,
      speed: 3 + Math.random() * 3.5,
      delay: Math.random() * 2.5,
      opacity: 0.3 + Math.random() * 0.35,
    }))
  ), [])

  const rainDrops = useMemo<ParticleData[]>(() => (
    Array.from({ length: 60 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 1.5,
      speed: 0.4 + Math.random() * 0.8,
      delay: Math.random() * 2,
      opacity: 0.25 + Math.random() * 0.4,
    }))
  ), [])

  // Reduced from 170 to 80 for performance
  const snowflakes = useMemo<ParticleData[]>(() => (
    Array.from({ length: 80 }, () => ({
      x: Math.random() * 120 - 10,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      speed: 1.2 + Math.random() * 2.5,
      delay: Math.random() * 4,
      opacity: 0.5 + Math.random() * 0.5,
    }))
  ), [])

  const dustMotes = useMemo<ParticleData[]>(() => (
    Array.from({ length: 20 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 80,
      size: 2 + Math.random() * 2,
      speed: 4 + Math.random() * 6,
      delay: Math.random() * 5,
      opacity: 0.12 + Math.random() * 0.2,
    }))
  ), [])

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {/* Neon sparks - diamond/star shaped */}
      {neonOpacity > 0.05 && (
        <div style={{ opacity: neonOpacity, transition: 'opacity 0.5s ease' }}>
          {neonSparks.map((spark, i) => (
            <div
              key={`spark-${i}`}
              style={{
                position: 'absolute',
                left: `${spark.x}%`,
                top: `${spark.y}%`,
                width: `${spark.size}px`,
                height: `${spark.size}px`,
                background: `rgba(160, 120, 255, ${spark.opacity})`,
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                animation: `sparkDrift ${spark.speed}s ease-in-out ${spark.delay}s infinite alternate`,
              }}
            />
          ))}
        </div>
      )}

      {/* Embers - teardrop/elongated */}
      {plazaOpacity > 0.05 && (
        <div style={{ opacity: plazaOpacity, transition: 'opacity 0.5s ease' }}>
          {embers.map((ember, i) => (
            <div
              key={`ember-${i}`}
              style={{
                position: 'absolute',
                left: `${ember.x}%`,
                bottom: '-10%',
                width: `${ember.size}px`,
                height: `${ember.size * 1.5}px`,
                background: `rgba(255, 200, 100, ${ember.opacity})`,
                borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                animation: `emberRise ${ember.speed}s ease-out ${ember.delay}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* Rain - elongated streaks */}
      {rainOpacity > 0.05 && (
        <div style={{ opacity: rainOpacity, transition: 'opacity 0.5s ease' }}>
          {rainDrops.map((drop, i) => (
            <div
              key={`rain-${i}`}
              style={{
                position: 'absolute',
                left: `${drop.x}%`,
                top: '-5%',
                width: `${drop.size}px`,
                height: `${drop.size * 12}px`,
                background: `linear-gradient(180deg, transparent, rgba(140, 190, 255, ${drop.opacity}), transparent)`,
                borderRadius: '1px',
                animation: `rainFall ${drop.speed}s linear ${drop.delay}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* Snow + blizzard */}
      {natureOpacity > 0.05 && (
        <div style={{ opacity: natureOpacity, transition: 'opacity 0.5s ease' }}>
          {snowflakes.map((flake, i) => (
            <div
              key={`snow-${i}`}
              style={{
                position: 'absolute',
                left: `${flake.x}%`,
                top: '-5%',
                width: `${flake.size}px`,
                height: `${flake.size}px`,
                background: `rgba(255, 255, 255, ${flake.opacity})`,
                borderRadius: '50%',
                animation: `snowStorm ${flake.speed}s linear ${flake.delay}s infinite`,
              }}
            />
          ))}
          {/* Blizzard whiteout overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `rgba(220, 235, 255, ${0.03 + blizzardIntensity * 0.12})`,
            transition: 'background 1s ease',
            pointerEvents: 'none',
          }} />
        </div>
      )}

      {/* Dust motes (ambient, visible in neon + plaza zones) */}
      {(neonOpacity > 0.05 || plazaOpacity > 0.05) && (
        <div style={{ opacity: Math.max(neonOpacity, plazaOpacity) * 0.7, transition: 'opacity 0.5s ease' }}>
          {dustMotes.map((mote, i) => (
            <div
              key={`dust-${i}`}
              style={{
                position: 'absolute',
                left: `${mote.x}%`,
                top: `${mote.y}%`,
                width: `${mote.size}px`,
                height: `${mote.size}px`,
                background: `rgba(180, 200, 255, ${mote.opacity})`,
                borderRadius: '50%',
                animation: `dustFloat ${mote.speed}s ease-in-out ${mote.delay}s infinite alternate`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
