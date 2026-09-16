// Retitle Tungsten cell labels — standardize to English, grouped semantics.
// Mutates config.cellLabel + profileMeta.customLabel on every output_dmx node,
// keyed by config.dmxOffset (0-based channel index).
const fs = require('fs')

const LABEL_BY_OFFSET = new Map([
  [0,  'Macros'],          // Custom
  [1,  'Rotation X'],      // X infinite
  [2,  'Main Intensity'],  // Golden dimmer
  [3,  'Main Intensity'],  // Strobe
  [4,  'Main Intensity'],  // Gold 1
  [5,  'Main Intensity'],  // Gold 2
  [6,  'Main Intensity'],  // Gold 3
  [7,  'Wash Intensity'],  // Stainning dimmer
  [8,  'Wash Intensity'],  // Stainning strobe
  [9,  'Wash Color'],      // Stain red
  [10, 'Wash Color'],      // Stain green
  [11, 'Wash Color'],      // Stain blue
  [12, 'Beam Color'],      // Red
  [13, 'Beam Color'],      // Green
  [14, 'Beam Color'],      // Blue
  [15, 'Beam Color'],      // White
  [16, 'Macros'],          // macro gold
  [17, 'Macros'],          // macro stain
  [18, 'Macros'],          // macro beam
  [19, 'Macros'],          // repo
])

const FILES = [
  'C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/fixtures/user-1775343513755-71zc1qeo4.json',
  'C:/Users/Raulacate/AppData/Roaming/luxsync-electron/fixtures/user-1775343513755-71zc1qeo4.json',
]

for (const file of FILES) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'))
  let touched = 0

  for (const node of doc.nodeGraph.nodes) {
    if (node.type !== 'output_dmx') continue
    const off = node.config?.dmxOffset
    const next = LABEL_BY_OFFSET.get(off)
    if (next === undefined) continue
    if (node.config.cellLabel !== next || node.profileMeta?.customLabel !== next) {
      node.config.cellLabel = next
      node.profileMeta = { ...(node.profileMeta ?? {}), customLabel: next }
      touched++
    }
  }

  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n')
  console.log(`${file}: ${touched} nodes retitled`)
}
