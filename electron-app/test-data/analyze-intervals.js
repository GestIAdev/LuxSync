// Quick analysis script — intervals at different groupings
const d = require('./live_audio_dump.json')

const EH = 24
let hist = new Float32Array(EH), hp = 0, hc = 0, hs = 0, prev = 0, lkt = 0, kc = 0, pe = 0
const kts = []
const energies = []

for (const f of d) {
  const e = f.needle
  if (hc >= EH) { hs -= hist[hp] } else { hc++ }
  hist[hp] = e; hs += e; hp = (hp + 1) % EH
  const avg = hc > 0 ? hs / hc : 0
  const dl = e - prev; prev = e
  if (avg > 0 && e > avg * 1.6 && dl > 0.008) {
    const gap = f.timestampMs - lkt
    if (gap >= 300 || lkt === 0) {
      let pass = true
      if (kc >= 6 && pe > 0 && e < pe * 0.65) pass = false
      if (pass) {
        kc++; pe = Math.max(e, pe)
        kts.push(f.timestampMs)
        energies.push(e)
        lkt = f.timestampMs
      }
    }
  }
  pe *= 0.995
}

const ai = []
for (let i = 1; i < kts.length; i++) ai.push(kts[i] - kts[i - 1])

console.log('Kicks:', kts.length)
console.log('')

// Single intervals
const si = [...ai].sort((a, b) => a - b)
console.log('Single intervals median:', si[Math.floor(si.length / 2)].toFixed(0) + 'ms =', Math.round(60000 / si[Math.floor(si.length / 2)]), 'BPM')

// Pair-summed
const pi = []
for (let i = 0; i < ai.length - 1; i++) pi.push(ai[i] + ai[i + 1])
const ps = [...pi].sort((a, b) => a - b)
console.log('All overlapping pairs median:', ps[Math.floor(ps.length / 2)].toFixed(0) + 'ms =', Math.round(60000 / ps[Math.floor(ps.length / 2)]), 'BPM')

// Triple-summed
const ti = []
for (let i = 0; i < ai.length - 2; i++) ti.push(ai[i] + ai[i + 1] + ai[i + 2])
const ts = [...ti].sort((a, b) => a - b)
console.log('All overlapping triples median:', ts[Math.floor(ts.length / 2)].toFixed(0) + 'ms =', Math.round(60000 / ts[Math.floor(ts.length / 2)]), 'BPM')

// Energy alternation analysis
console.log('')
console.log('=== Energy alternation ===')
const evenE = [], oddE = []
for (let i = 0; i < energies.length; i++) {
  if (i % 2 === 0) evenE.push(energies[i])
  else oddE.push(energies[i])
}
const medEven = [...evenE].sort((a, b) => a - b)[Math.floor(evenE.length / 2)]
const medOdd = [...oddE].sort((a, b) => a - b)[Math.floor(oddE.length / 2)]
console.log('Even kicks median energy:', medEven.toFixed(4))
console.log('Odd kicks median energy:', medOdd.toFixed(4))
console.log('Ratio:', (medEven / medOdd).toFixed(3))
console.log('→ If ratio >> 1.5, clear strong/weak alternation (eighth notes)')

// BPM histogram of singles
console.log('')
console.log('=== BPM histogram (single intervals) ===')
const bh = {}
ai.forEach(g => { const bpm = Math.round(60000 / g); bh[bpm] = (bh[bpm] || 0) + 1 })
Object.entries(bh).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + k + ' BPM: x' + v))
