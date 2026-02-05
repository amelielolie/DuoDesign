import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

// Global master gain for muting
let masterGainNode: GainNode | null = null

export function AmbientMusic() {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const startedRef = useRef(false)
  const soundMuted = useGameStore((s) => s.soundMuted)
  const phase = useGameStore((s) => s.phase)

  // Handle mute/unmute and stop music during ending
  useEffect(() => {
    if (masterGainNode) {
      const shouldMute = soundMuted || phase === 'ending' || phase === 'reward'
      masterGainNode.gain.setTargetAtTime(shouldMute ? 0 : 0.5, masterGainNode.context.currentTime, 0.3)
    }
  }, [soundMuted, phase])

  useEffect(() => {
    const startAudio = () => {
      if (startedRef.current) return
      startedRef.current = true

      // Create AudioContext synchronously in user gesture
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      audioCtxRef.current = ctx

      // iOS requires resume() in same gesture
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      // Create a silent oscillator to fully unlock audio
      const unlockOsc = ctx.createOscillator()
      const unlockGain = ctx.createGain()
      unlockGain.gain.value = 0.001
      unlockOsc.connect(unlockGain)
      unlockGain.connect(ctx.destination)
      unlockOsc.start()
      unlockOsc.stop(ctx.currentTime + 0.1)

      // Start music after unlock
      setTimeout(() => {
        if (ctx.state === 'suspended') {
          ctx.resume().then(() => setupAmbientMusic(ctx))
        } else {
          setupAmbientMusic(ctx)
        }
      }, 150)
    }

    // Use touchstart for iOS (fires before touchend)
    const events = ['touchstart', 'mousedown', 'keydown']

    const handler = () => {
      startAudio()
      // Remove all listeners after first trigger
      events.forEach(e => document.removeEventListener(e, handler))
    }

    events.forEach(e => document.addEventListener(e, handler, { passive: true }))

    return () => {
      events.forEach(e => document.removeEventListener(e, handler))
    }
  }, [])

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close()
      }
    }
  }, [])

  return null
}

function setupAmbientMusic(ctx: AudioContext) {
  const master = ctx.createGain()
  master.gain.value = 0.5
  master.connect(ctx.destination)
  masterGainNode = master // Store reference for muting

  // Reverb
  const convolver = ctx.createConvolver()
  const len = ctx.sampleRate * 2
  const impulse = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5)
    }
  }
  convolver.buffer = impulse

  const dry = ctx.createGain()
  dry.gain.value = 0.6
  const wet = ctx.createGain()
  wet.gain.value = 0.4
  convolver.connect(wet)
  wet.connect(master)
  dry.connect(master)

  // Bass drone
  const bass = ctx.createOscillator()
  bass.type = 'sine'
  bass.frequency.value = 55
  const bassG = ctx.createGain()
  bassG.gain.value = 0.22
  bass.connect(bassG)
  bassG.connect(dry)
  bassG.connect(convolver)
  bass.start()

  // Bass LFO
  const bLfo = ctx.createOscillator()
  bLfo.frequency.value = 0.08
  const bLfoG = ctx.createGain()
  bLfoG.gain.value = 8
  bLfo.connect(bLfoG)
  bLfoG.connect(bass.frequency)
  bLfo.start()

  // Pad chord
  const padFreqs = [110, 130.81, 164.81, 220]
  padFreqs.forEach((freq: number) => {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 400
    const g = ctx.createGain()
    g.gain.value = 0.05
    osc.connect(f)
    f.connect(g)
    g.connect(dry)
    g.connect(convolver)
    osc.start()

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.1 + Math.random() * 0.15
    const lg = ctx.createGain()
    lg.gain.value = 5
    lfo.connect(lg)
    lg.connect(osc.detune)
    lfo.start()
  })

  // Arpeggio
  const notes = [220, 261.63, 329.63, 392, 440, 392, 329.63, 261.63]
  let idx = 0
  const arp = ctx.createOscillator()
  arp.type = 'triangle'
  arp.frequency.value = 220
  const aF = ctx.createBiquadFilter()
  aF.type = 'lowpass'
  aF.frequency.value = 800
  const aG = ctx.createGain()
  aG.gain.value = 0
  arp.connect(aF)
  aF.connect(aG)
  aG.connect(dry)
  aG.connect(convolver)
  arp.start()

  setInterval(() => {
    if (ctx.state !== 'running') return
    const t = ctx.currentTime
    idx = (idx + 1) % notes.length
    arp.frequency.setTargetAtTime(notes[idx], t, 0.02)
    aG.gain.setTargetAtTime(0.08, t, 0.01)
    aG.gain.setTargetAtTime(0, t + 0.15, 0.2)
  }, 600)

  // Noise
  const nBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const nD = nBuf.getChannelData(0)
  for (let i = 0; i < nD.length; i++) nD[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource()
  noise.buffer = nBuf
  noise.loop = true
  const nF = ctx.createBiquadFilter()
  nF.type = 'bandpass'
  nF.frequency.value = 2000
  nF.Q.value = 0.5
  const nG = ctx.createGain()
  nG.gain.value = 0.025
  noise.connect(nF)
  nF.connect(nG)
  nG.connect(dry)
  nG.connect(convolver)
  noise.start()

  // Ethereal whisper voice
  setupWhisperVoice(ctx, dry, convolver)
}

// Soft, breathy female whisper using formant synthesis
function setupWhisperVoice(ctx: AudioContext, dry: GainNode, reverb: ConvolverNode) {
  const breathBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
  const breathData = breathBuf.getChannelData(0)
  for (let i = 0; i < breathData.length; i++) {
    breathData[i] = (Math.random() * 2 - 1) * 0.5
  }

  const vowels = [
    { f1: 800, f2: 1200, f3: 2500 },
    { f1: 350, f2: 800, f3: 2500 },
    { f1: 400, f2: 2000, f3: 2800 },
    { f1: 600, f2: 1000, f3: 2400 },
  ]

  const createWhisperTone = () => {
    if (ctx.state !== 'running') return

    const vowel = vowels[Math.floor(Math.random() * vowels.length)]
    const duration = 2 + Math.random() * 3
    const startTime = ctx.currentTime

    const breath = ctx.createBufferSource()
    breath.buffer = breathBuf
    breath.loop = true

    const formant1 = ctx.createBiquadFilter()
    formant1.type = 'bandpass'
    formant1.frequency.value = vowel.f1
    formant1.Q.value = 5

    const formant2 = ctx.createBiquadFilter()
    formant2.type = 'bandpass'
    formant2.frequency.value = vowel.f2
    formant2.Q.value = 5

    const formant3 = ctx.createBiquadFilter()
    formant3.type = 'bandpass'
    formant3.frequency.value = vowel.f3
    formant3.Q.value = 3

    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 200

    const pitchOsc = ctx.createOscillator()
    pitchOsc.type = 'sine'
    pitchOsc.frequency.value = 220 + Math.random() * 110

    const vibrato = ctx.createOscillator()
    vibrato.frequency.value = 4 + Math.random() * 2
    const vibratoGain = ctx.createGain()
    vibratoGain.gain.value = 3
    vibrato.connect(vibratoGain)
    vibratoGain.connect(pitchOsc.frequency)

    const breathGain = ctx.createGain()
    breathGain.gain.value = 0

    const pitchGain = ctx.createGain()
    pitchGain.gain.value = 0

    const masterGain = ctx.createGain()
    masterGain.gain.value = 0.035

    breath.connect(formant1)
    breath.connect(formant2)
    breath.connect(formant3)
    formant1.connect(highpass)
    formant2.connect(highpass)
    formant3.connect(highpass)
    highpass.connect(breathGain)

    pitchOsc.connect(pitchGain)

    breathGain.connect(masterGain)
    pitchGain.connect(masterGain)
    masterGain.connect(dry)
    masterGain.connect(reverb)

    const fadeIn = 0.8 + Math.random() * 0.5
    const fadeOut = 1 + Math.random() * 0.5

    breathGain.gain.setValueAtTime(0, startTime)
    breathGain.gain.linearRampToValueAtTime(0.7, startTime + fadeIn)
    breathGain.gain.setValueAtTime(0.7, startTime + duration - fadeOut)
    breathGain.gain.linearRampToValueAtTime(0, startTime + duration)

    pitchGain.gain.setValueAtTime(0, startTime)
    pitchGain.gain.linearRampToValueAtTime(0.15, startTime + fadeIn)
    pitchGain.gain.setValueAtTime(0.15, startTime + duration - fadeOut)
    pitchGain.gain.linearRampToValueAtTime(0, startTime + duration)

    breath.start(startTime)
    breath.stop(startTime + duration + 0.1)
    pitchOsc.start(startTime)
    pitchOsc.stop(startTime + duration + 0.1)
    vibrato.start(startTime)
    vibrato.stop(startTime + duration + 0.1)
  }

  const scheduleNext = () => {
    if (ctx.state !== 'running') return
    createWhisperTone()
    setTimeout(scheduleNext, 4000 + Math.random() * 6000)
  }

  setTimeout(scheduleNext, 2000)
}
