/** Deterministische Brand-Verläufe + Initialen für Gruppen-/Kanal-Kacheln (Design-System). */
const GRADIENTS = [
  'linear-gradient(135deg,#5BB8F5,#0F6FBE)',
  'linear-gradient(135deg,#FF8062,#F1572F)',
  'linear-gradient(135deg,#66B0B6,#0A4F57)',
  'linear-gradient(135deg,#7FBCF5,#117D87)',
  'linear-gradient(135deg,#FF9F88,#C7421F)',
]

export function brandGradient(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return GRADIENTS[h % GRADIENTS.length]
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}
