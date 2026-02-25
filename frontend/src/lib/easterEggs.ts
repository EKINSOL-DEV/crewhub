const KONAMI_CODE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
]
let konamiProgress = 0

export function checkKonamiCode(event: KeyboardEvent): boolean {
  if (event.code === KONAMI_CODE[konamiProgress]) {
    konamiProgress++
    if (konamiProgress === KONAMI_CODE.length) {
      konamiProgress = 0
      return true
    }
  } else {
    konamiProgress = 0
  }
  return false
}

export function resetKonamiCode() {
  konamiProgress = 0
}

const CLICK_MESSAGES = [
  'Hey, that tickles! 😄',
  'Stop poking me! 😅',
  "I'm working here! 😤",
  'Boop! 👆',
  'Hehe! 🤭',
  'Can I help you? 🤨',
  'Again? Really? 🙄',
  'You found me! 🎉',
  "I'm shy! 😳",
  'Wheee! 🎊',
]

export function getClickMessage(): string {
  return CLICK_MESSAGES[Math.floor(Math.random() * CLICK_MESSAGES.length)]
}

export function triggerConfetti(element: HTMLElement) {
  element.classList.add('confetti-burst')
  setTimeout(() => element.classList.remove('confetti-burst'), 1000)
}

export function triggerShake(element: HTMLElement) {
  element.classList.add('shake-animation')
  setTimeout(() => element.classList.remove('shake-animation'), 500)
}

export function triggerDance(elements: HTMLElement[]) {
  elements.forEach((element, index) => {
    setTimeout(() => {
      element.classList.add('dance-animation')
      setTimeout(() => element.classList.remove('dance-animation'), 2000)
    }, index * 100)
  })
}

export function playSound(soundName: string, volume: number = 0.3) {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

  if (soundName === 'click') {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.frequency.value = 800
    gainNode.gain.value = volume
    oscillator.start()
    setTimeout(() => oscillator.stop(), 100)
  } else if (soundName === 'achievement') {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.frequency.value = 523.25
    gainNode.gain.value = volume
    oscillator.start()
    setTimeout(() => {
      oscillator.frequency.value = 659.25
    }, 100)
    setTimeout(() => {
      oscillator.frequency.value = 783.99
    }, 200)
    setTimeout(() => oscillator.stop(), 400)
  } else if (soundName === 'konami') {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.type = 'square'
    oscillator.frequency.value = 440
    gainNode.gain.value = volume * 0.5
    oscillator.start()
    const notes = [440, 494, 523, 587, 659, 698, 784]
    notes.forEach((note, index) => {
      setTimeout(() => {
        oscillator.frequency.value = note
      }, index * 80)
    })
    setTimeout(() => oscillator.stop(), notes.length * 80 + 200)
  }
}
