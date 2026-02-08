import { useMemo } from 'react'

interface ParticleData {
  x: number
  y: number
  size: number
  speed: number
  delay: number
  opacity: number
}

export function Particles({ progress }: { progress: number }) {
  const isNeonZone = progress < 0.25
  const isPlazaZone = progress >= 0.25 && progress < 0.5
  const isRainZone = progress >= 0.5 && progress < 0.75
  const isNatureZone = progress >= 0.75
  const blizzardIntensity = isNatureZone ? Math.min(1, (progress - 0.75) / 0.25) : 0

  const neonSparks = useMemo<ParticleData[]>(() => (
    Array.from({ length: 28 }, () => ({
      x: Math.random() * 100,
      y: 15 + Math.random() * 70,
      size: 1 + Math.random() * 2,
      speed: 2.8 + Math.random() * 3.2,
      delay: Math.random() * 3,
      opacity: 0.25 + Math.random() * 0.45,
    }))
  ), [])

  const embers = useMemo<ParticleData[]>(() => (
    Array.from({ length: 34 }, () => ({
      x: Math.random() * 100,
      y: 40 + Math.random() * 55,
      size: 1.5 + Math.random() * 3,
      speed: 3 + Math.random() * 3.5,
      delay: Math.random() * 2.5,
      opacity: 0.25 + Math.random() * 0.3,
    }))
  ), [])

  const rainDrops = useMemo<ParticleData[]>(() => (
    Array.from({ length: 72 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2,
      speed: 0.45 + Math.random() * 0.95,
      delay: Math.random() * 2,
      opacity: 0.22 + Math.random() * 0.45,
    }))
  ), [])

  const snowflakes = useMemo<ParticleData[]>(() => (
    Array.from({ length: 170 }, () => ({
      x: Math.random() * 120 - 10,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      speed: 1 + Math.random() * 2,
      delay: Math.random() * 4,
      opacity: 0.5 + Math.random() * 0.5,
    }))
  ), [])

  const fireflies = useMemo<ParticleData[]>(() => (
    Array.from({ length: 18 }, () => ({
      x: Math.random() * 100,
      y: 20 + Math.random() * 60,
      size: 2 + Math.random() * 3,
      speed: 3 + Math.random() * 5,
      delay: Math.random() * 3,
      opacity: 0.25 + Math.random() * 0.45,
    }))
  ), [])

  const dustMotes = useMemo<ParticleData[]>(() => (
    Array.from({ length: 24 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 80,
      size: 2 + Math.random() * 2,
      speed: 4 + Math.random() * 6,
      delay: Math.random() * 5,
      opacity: 0.12 + Math.random() * 0.22,
    }))
  ), [])

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {isNeonZone && neonSparks.map((spark, i) => (
        <div
          key={`spark-${i}`}
          style={{
            position: 'absolute',
            left: `${spark.x}%`,
            top: `${spark.y}%`,
            width: `${spark.size}px`,
            height: `${spark.size}px`,
            borderRadius: '50%',
            background: `rgba(140, 185, 255, ${spark.opacity})`,
            boxShadow: '0 0 10px rgba(140, 185, 255, 0.75)',
            animation: `sparkDrift ${spark.speed}s ease-in-out ${spark.delay}s infinite alternate`,
          }}
        />
      ))}

      {isPlazaZone && embers.map((ember, i) => (
        <div
          key={`ember-${i}`}
          style={{
            position: 'absolute',
            left: `${ember.x}%`,
            bottom: '-10%',
            width: `${ember.size}px`,
            height: `${ember.size}px`,
            borderRadius: '50%',
            background: `rgba(255, 205, 120, ${ember.opacity})`,
            boxShadow: '0 0 10px rgba(255, 185, 90, 0.7)',
            animation: `emberRise ${ember.speed}s ease-out ${ember.delay}s infinite`,
          }}
        />
      ))}

      {isRainZone && rainDrops.map((drop, i) => (
        <div
          key={`rain-${i}`}
          style={{
            position: 'absolute',
            left: `${drop.x}%`,
            top: '-5%',
            width: `${drop.size}px`,
            height: `${drop.size * 8}px`,
            background: `rgba(150, 200, 255, ${drop.opacity})`,
            borderRadius: '50%',
            animation: `rainFall ${drop.speed}s linear ${drop.delay}s infinite`,
          }}
        />
      ))}

      {isNatureZone && (
        <>
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
          {fireflies.map((fly, i) => (
            <div
              key={`firefly-${i}`}
              style={{
                position: 'absolute',
                left: `${fly.x}%`,
                top: `${fly.y}%`,
                width: `${fly.size}px`,
                height: `${fly.size}px`,
                borderRadius: '50%',
                background: `rgba(215, 250, 210, ${fly.opacity})`,
                boxShadow: '0 0 14px rgba(215, 250, 210, 0.9)',
                animation: `fireflyFloat ${fly.speed}s ease-in-out ${fly.delay}s infinite alternate`,
              }}
            />
          ))}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `rgba(235, 245, 255, ${0.04 + blizzardIntensity * 0.15})`,
            pointerEvents: 'none',
          }} />
        </>
      )}

      {!isNatureZone && !isRainZone && dustMotes.map((mote, i) => (
        <div
          key={`dust-${i}`}
          style={{
            position: 'absolute',
            left: `${mote.x}%`,
            top: `${mote.y}%`,
            width: `${mote.size}px`,
            height: `${mote.size}px`,
            background: `rgba(150, 200, 255, ${mote.opacity})`,
            borderRadius: '50%',
            animation: `dustFloat ${mote.speed}s ease-in-out ${mote.delay}s infinite alternate`,
          }}
        />
      ))}
    </div>
  )
}
