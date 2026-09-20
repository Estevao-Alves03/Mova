// Prévia sintetizada (sem arquivos de áudio): cada som tem uma sequência de notas própria.
const NOTES: Record<string, number[]> = {
  classic_soft: [523, 659],
  crystal_bell: [1047],
  serene_harp: [392, 494, 587],
  pulsing_alert: [880, 880],
  double_bell: [659, 784],
  major_chord: [523, 659, 784],
  soft_gong: [196],
  office_bell: [740, 740],
  warm_notification: [440, 554],
}

let audioContext: AudioContext | undefined

export function canPreview(sound: string) {
  return sound in NOTES && typeof AudioContext !== "undefined"
}

/** Toca uma prévia no volume escolhido (0–100). */
export function previewSound(sound: string, volume: number) {
  if (!canPreview(sound)) return
  audioContext ??= new AudioContext()
  const context = audioContext
  void context.resume()
  const peak = Math.max(0.0001, (volume / 100) * 0.25)
  NOTES[sound].forEach((frequency, index) => {
    const start = context.currentTime + index * 0.22
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = "sine"
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + 0.55)
  })
}
