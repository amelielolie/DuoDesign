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
  const isRainZone = progress >= 0.5 && progress < 0.75
  const isNatureZone = progress >= 0.75

  // Blizzard intensity increases from 0.75 to 1.0
  const blizzardIntensity = isNatureZone ? Math.min(1, (progress - 0.75) / 0.25) : 0

  const rainDrops = useMemo<ParticleData[]>(() => {
    return Array.from({ length: 60 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2,
      speed: 0.5 + Math.random() * 1,
      delay: Math.random() * 2,
      opacity: 0.2 + Math.random() * 0.4,
    }))
  }, [])

  // Blizzard snow - optimized for mobile
  const snowflakes = useMemo<ParticleData[]>(() => {
    return Array.from({ length: 150 }, () => ({
      x: Math.random() * 120 - 10,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      speed: 1 + Math.random() * 2,
      delay: Math.random() * 4,
      opacity: 0.5 + Math.random() * 0.5,
    }))
  }, [])

  const dustMotes = useMemo<ParticleData[]>(() => {
    return Array.from({ length: 20 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 80,
      size: 2 + Math.random() * 2,
      speed: 4 + Math.random() * 6,
      delay: Math.random() * 5,
      opacity: 0.15 + Math.random() * 0.2,
    }))
  }, [])

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {/* Rain in rain corridor */}
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

      {/* Blizzard in nature finale */}
      {isNatureZone && snowflakes.map((flake, i) => (
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

      {/* Blizzard fog overlay - gets thicker towards end */}
      {isNatureZone && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `rgba(255, 255, 255, ${0.05 + blizzardIntensity * 0.15})`,
          pointerEvents: 'none',
        }} />
      )}

      {/* Dust motes in urban zones */}
      {!isNatureZone && dustMotes.map((mote, i) => (
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
