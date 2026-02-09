import { create } from 'zustand'

export type GamePhase = 'splash' | 'exploring' | 'photo-mode' | 'ending' | 'reward'
export type ZoneId = 'neon-alley' | 'open-plaza' | 'rain-corridor' | 'nature-finale'

interface GameState {
  phase: GamePhase
  currentZone: ZoneId
  previousZone: ZoneId | null
  capturedPhotos: string[]
  worldX: number
  walking: boolean
  direction: 1 | -1
  jumping: boolean
  jumpY: number
  jumpCount: number
  maxJumps: number
  kicking: boolean
  photoSpotNearby: boolean
  endingTriggered: boolean
  collectedBills: Set<number>
  soundMuted: boolean
  cameraShake: number
  zoneAnnouncement: string | null
  assetsReady: boolean

  setPhase: (phase: GamePhase) => void
  setCurrentZone: (zone: ZoneId) => void
  addCapturedPhoto: (dataUrl: string) => void
  setWorldX: (x: number) => void
  setWalking: (walking: boolean) => void
  setDirection: (dir: 1 | -1) => void
  setJumping: (jumping: boolean) => void
  setJumpY: (y: number) => void
  setJumpCount: (count: number) => void
  setPhotoSpotNearby: (nearby: boolean) => void
  setKicking: (kicking: boolean) => void
  triggerEnding: () => void
  collectBill: (index: number) => void
  toggleSound: () => void
  triggerCameraShake: (intensity: number) => void
  showZoneAnnouncement: (name: string) => void
  clearZoneAnnouncement: () => void
  setAssetsReady: (ready: boolean) => void
  reset: () => void
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'splash',
  currentZone: 'neon-alley',
  previousZone: null,
  capturedPhotos: [],
  worldX: 0,
  walking: false,
  direction: 1,
  jumping: false,
  jumpY: 0,
  jumpCount: 0,
  maxJumps: 2,
  photoSpotNearby: false,
  kicking: false,
  endingTriggered: false,
  collectedBills: new Set<number>(),
  soundMuted: false,
  cameraShake: 0,
  zoneAnnouncement: null,
  assetsReady: false,

  setPhase: (phase) => set({ phase }),
  setCurrentZone: (zone) =>
    set((state) => ({
      currentZone: zone,
      previousZone: state.currentZone !== zone ? state.currentZone : state.previousZone,
    })),
  addCapturedPhoto: (dataUrl) =>
    set((state) => ({ capturedPhotos: [...state.capturedPhotos, dataUrl] })),
  setWorldX: (x) => set({ worldX: x }),
  setWalking: (walking) => set({ walking }),
  setDirection: (dir) => set({ direction: dir }),
  setJumping: (jumping) => set({ jumping }),
  setJumpY: (y) => set({ jumpY: y }),
  setJumpCount: (count) => set({ jumpCount: count }),
  setPhotoSpotNearby: (nearby) => set({ photoSpotNearby: nearby }),
  setKicking: (kicking) => set({ kicking }),
  triggerEnding: () => set({ endingTriggered: true, phase: 'ending' }),
  collectBill: (index) =>
    set((state) => {
      const next = new Set(state.collectedBills)
      next.add(index)
      return { collectedBills: next }
    }),
  toggleSound: () => set((state) => ({ soundMuted: !state.soundMuted })),
  triggerCameraShake: (intensity) => set({ cameraShake: intensity }),
  showZoneAnnouncement: (name) => set({ zoneAnnouncement: name }),
  clearZoneAnnouncement: () => set({ zoneAnnouncement: null }),
  setAssetsReady: (ready) => set({ assetsReady: ready }),
  reset: () =>
    set({
      phase: 'exploring',
      currentZone: 'neon-alley',
      previousZone: null,
      capturedPhotos: [],
      worldX: 0,
      walking: false,
      direction: 1,
      jumping: false,
      jumpY: 0,
      jumpCount: 0,
      photoSpotNearby: false,
      kicking: false,
      endingTriggered: false,
      collectedBills: new Set<number>(),
      cameraShake: 0,
      zoneAnnouncement: null,
    }),
}))
