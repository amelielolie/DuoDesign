// World total width (in viewport widths)
export const WORLD_WIDTH = 8 // 8x screen widths total

// Zone definitions along the X axis (as fraction of WORLD_WIDTH)
export const ZONES = {
  'neon-alley': { start: 0, end: 0.25 },
  'open-plaza': { start: 0.25, end: 0.5 },
  'rain-corridor': { start: 0.5, end: 0.75 },
  'nature-finale': { start: 0.75, end: 1 },
} as const

// Photo spot positions (as fraction of WORLD_WIDTH)
export const PHOTO_SPOTS = [
  { x: 0.12, zone: 'neon-alley' as const },
  { x: 0.37, zone: 'open-plaza' as const },
  { x: 0.62, zone: 'rain-corridor' as const },
  { x: 0.87, zone: 'nature-finale' as const },
]

// Ending trigger position (fraction of total)
export const ENDING_TRIGGER = 0.95

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
  speed: 0.003, // fraction of world per frame
}

// Zone atmospheres — gradient backgrounds
export const ZONE_ATMOSPHERES = {
  'neon-alley': {
    sky: '#0a1520',
    ground: '#1a2530',
    accent: '#3a6090',
  },
  'open-plaza': {
    sky: '#0c1825',
    ground: '#1c2835',
    accent: '#4a7aaa',
  },
  'rain-corridor': {
    sky: '#081018',
    ground: '#151f28',
    accent: '#2a5070',
  },
  'nature-finale': {
    sky: '#0a1a15',
    ground: '#1a2a22',
    accent: '#4a8a6a',
  },
} as const

// Parallax layer speeds (multiplier relative to world scroll)
export const PARALLAX = {
  farBackground: 0.2,
  midBackground: 0.5,
  nearBackground: 0.8,
  ground: 1.0,
  foreground: 1.2,
}
