// IOI Histogram analysis — finding the true periodicity
const d = require('./live_audio_dump.json')

// Simulate exact tracker kick detection (MIN_INTERVAL=300ms)
const EH = 24
let hist = new Float32Array(EH), hp = 0, hc = 0, hs = 0, prev = 0, lkt = 0, kc = 0, pe = 0
const kts = []

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
        lkt = f.timestampMs
      }
    }
  }
  pe *= 0.995
}

console.log('Detected kicks:', kts.length)

// Compute ALL inter-kick intervals (not just consecutive)
// This is the key insight: look at interval-1, interval-2, interval-3, etc.
// The true beat period will show up as peaks in the multi-lag histogram

// Lag-1 intervals (consecutive)
const lag1 = []
for (let i = 1; i < kts.length; i++) lag1.push(kts[i] - kts[i - 1])

// Lag-2 intervals (skip 1)
const lag2 = []
for (let i = 2; i < kts.length; i++) lag2.push(kts[i] - kts[i - 2])

// Lag-3 intervals (skip 2)
const lag3 = []
for (let i = 3; i < kts.length; i++) lag3.push(kts[i] - kts[i - 3])

// Lag-4 intervals (skip 3)
const lag4 = []
for (let i = 4; i < kts.length; i++) lag4.push(kts[i] - kts[i - 4])

function medianBPM(intervals) {
  if (intervals.length === 0) return 'N/A'
  // Filter to reasonable range
  const valid = intervals.filter(i => i >= 300 && i <= 1500)
  if (valid.length === 0) return 'N/A'
  const sorted = [...valid].sort((a, b) => a - b)
  const med = sorted[Math.floor(sorted.length / 2)]
  return `${med.toFixed(0)}ms = ${Math.round(60000 / med)} BPM (${valid.length} values)`
}

console.log('')
console.log('Lag-1 (consecutive):', medianBPM(lag1))
console.log('Lag-2 (skip 1):    ', medianBPM(lag2))
console.log('Lag-3 (skip 2):    ', medianBPM(lag3))
console.log('Lag-4 (skip 3):    ', medianBPM(lag4))

// IOI Histogram with 10ms bins for all lags combined
console.log('')
console.log('=== IOI HISTOGRAM (all lags, 10ms bins) ===')
const allIntervals = [...lag1, ...lag2, ...lag3, ...lag4].filter(i => i >= 300 && i <= 1500)
const bins = {}
allIntervals.forEach(i => {
  const bin = Math.round(i / 10) * 10
  bins[bin] = (bins[bin] || 0) + 1
})
const sortedBins = Object.entries(bins).sort((a, b) => b[1] - a[1])
console.log('Top 20 bins:')
sortedBins.slice(0, 20).forEach(([ms, count]) => {
  const bpm = Math.round(60000 / parseInt(ms))
  const bar = '█'.repeat(Math.min(count, 60))
  console.log(`  ${ms}ms (${bpm} BPM): ${bar} (${count})`)
})

// Specifically check for 476ms bin (= 126 BPM)
console.log('')
console.log('=== Specific BPM targets ===')
;[126, 92, 185, 161, 130].forEach(bpm => {
  const targetMs = Math.round(60000 / bpm)
  const tolerance = 20 // ±20ms
  const count = allIntervals.filter(i => Math.abs(i - targetMs) <= tolerance).length
  console.log(`  ${bpm} BPM (${targetMs}ms ±${tolerance}ms): ${count} hits`)
})
