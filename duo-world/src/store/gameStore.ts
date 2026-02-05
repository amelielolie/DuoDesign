import { create } from 'zustand'

export type GamePhase = 'splash' | 'exploring' | 'photo-mode' | 'ending' | 'reward'
export type ZoneId = 'neon-alley' | 'open-plaza' | 'rain-corridor' | 'nature-finale'

interface GameState {
  phase: GamePhase
  currentZone: ZoneId
  capturedPhotos: string[]
  worldX: number
  walking: boolean
  direction: 1 | -1
  jumping: boolean
  jumpY: number
  photoSpotNearby: boolean
  endingTriggered: boolean
  collectedBills: Set<number>
  soundMuted: boolean

  setPhase: (phase: GamePhase) => void
  setCurrentZone: (zone: ZoneId) => void
  addCapturedPhoto: (dataUrl: string) => void
  setWorldX: (x: number) => void
  setWalking: (walking: boolean) => void
  setDirection: (dir: 1 | -1) => void
  setJumping: (jumping: boolean) => void
  setJumpY: (y: number) => void
  setPhotoSpotNearby: (nearby: boolean) => void
  triggerEnding: () => void
  collectBill: (index: number) => void
  toggleSound: () => void
  reset: () => void
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'splash',
  currentZone: 'neon-alley',
  capturedPhotos: [],
  worldX: 0,
  walking: false,
  direction: 1,
  jumping: false,
  jumpY: 0,
  photoSpotNearby: false,
  endingTriggered: false,
  collectedBills: new Set<number>(),
  soundMuted: false,

  setPhase: (phase) => set({ phase }),
  setCurrentZone: (zone) => set({ currentZone: zone }),
  addCapturedPhoto: (dataUrl) =>
    set((state) => ({ capturedPhotos: [...state.capturedPhotos, dataUrl] })),
  setWorldX: (x) => set({ worldX: x }),
  setWalking: (walking) => set({ walking }),
  setDirection: (dir) => set({ direction: dir }),
  setJumping: (jumping) => set({ jumping }),
  setJumpY: (y) => set({ jumpY: y }),
  setPhotoSpotNearby: (nearby) => set({ photoSpotNearby: nearby }),
  triggerEnding: () => set({ endingTriggered: true, phase: 'ending' }),
  collectBill: (index) =>
    set((state) => {
      const next = new Set(state.collectedBills)
      next.add(index)
      return { collectedBills: next }
    }),
  toggleSound: () => set((state) => ({ soundMuted: !state.soundMuted })),
  reset: () =>
    set({
      phase: 'exploring',
      currentZone: 'neon-alley',
      capturedPhotos: [],
      worldX: 0,
      walking: false,
      direction: 1,
      jumping: false,
      jumpY: 0,
      photoSpotNearby: false,
      endingTriggered: false,
      collectedBills: new Set<number>(),
    }),
}))
