// World total width (in viewport widths)
export const WORLD_WIDTH = 12 // 12x screen widths total

// Zone definitions along the X axis (as fraction of WORLD_WIDTH)
// Blizzard zone gets 40% of the world for a longer finale
export const ZONES = {
  'neon-alley': { start: 0, end: 0.20 },
  'open-plaza': { start: 0.20, end: 0.40 },
  'rain-corridor': { start: 0.40, end: 0.60 },
  'nature-finale': { start: 0.60, end: 1 },
} as const

// Zone background images
export const ZONE_BACKGROUNDS = {
  'neon-alley': '/backgrounds/neon-alley.jpg',
  'open-plaza': '/backgrounds/open-plaza.jpg',
  'rain-corridor': '/backgrounds/rain-corridor.jpg',
  'nature-finale': '/backgrounds/nature-finale.jpg',
} as const

// Fallback panoramic (original)
export const FALLBACK_PANORAMIC = '/backgrounds/panoramic-city.jpg'

// Photo spot positions (as fraction of WORLD_WIDTH)
export const PHOTO_SPOTS = [
  { x: 0.10, zone: 'neon-alley' as const },
  { x: 0.30, zone: 'open-plaza' as const },
  { x: 0.50, zone: 'rain-corridor' as const },
  { x: 0.80, zone: 'nature-finale' as const },
]

// Ending trigger position (fraction of total)
export const ENDING_TRIGGER = 0.98

// Character sprite sheets
export const CHARACTER = {
  walk: '/avatars/sprite-walk.png',
  idle: '/avatars/sprite-idle.png',
  jump: '/avatars/sprite-jump.png',
  static: '/avatars/character.png',
  frames: 9,       // 9 frames per sheet
  columns: 3,      // 3x3 grid
  rows: 3,
}

// Movement
export const MOVEMENT = {
  speed: 0.002, // fraction of world per frame at 60fps
}

// Zone atmospheres — gradient backgrounds
export const ZONE_ATMOSPHERES = {
  'neon-alley': {
    sky: '#0a0818',
    ground: '#1a1530',
    accent: '#8a40ff',
  },
  'open-plaza': {
    sky: '#1a1408',
    ground: '#2a2010',
    accent: '#ffaa40',
  },
  'rain-corridor': {
    sky: '#060e18',
    ground: '#101820',
    accent: '#4090cc',
  },
  'nature-finale': {
    sky: '#0a1a20',
    ground: '#1a2a30',
    accent: '#80d0ff',
  },
} as const

// Zone tint overlays (stronger than before for visible differentiation)
export const ZONE_TINTS = {
  'neon-alley': 'rgba(130, 60, 255, 0.15)',
  'open-plaza': 'rgba(255, 180, 80, 0.12)',
  'rain-corridor': 'rgba(60, 140, 220, 0.18)',
  'nature-finale': 'rgba(160, 210, 255, 0.22)',
} as const

// Zone display names
export const ZONE_LABELS = {
  'neon-alley': 'NEON ALLEY',
  'open-plaza': 'GOLDEN PLAZA',
  'rain-corridor': 'RAIN CORRIDOR',
  'nature-finale': 'BLIZZARD ZONE',
} as const

// Parallax layer speeds (multiplier relative to world scroll)
export const PARALLAX = {
  farBackground: 0.2,
  midBackground: 0.5,
  nearBackground: 0.8,
  ground: 1.0,
  foreground: 1.2,
}

// Zone crossfade blend width (fraction of world)
export const ZONE_BLEND_WIDTH = 0.06
