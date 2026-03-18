[UniversalDMX] 🔄 Output loop started at 30Hz
[UniversalDMX] 🐕 Watchdog started (multi-universe mode)
[IPC 📡] lux:arbiter:setOutputEnabled {
  enabled: false,
  senderUrl: 'http://localhost:5173/',
  senderFrame: { url: 'http://localhost:5173/', name: '', routingId: 1 },
  stack: 'Error\n' +
    '    at C:\\Users\\Raulacate\\Desktop\\Proyectos programacion\\LuxSync\\electron-app\\dist-electron\\main.js:40052:21\n' +
    '    at WebContents.<anonymous> (node:electron/js2c/browser_init:2:77979)\n' +
    '    at WebContents.emit (node:events:517:28)'
}
[IPC 📡] lux:arbiter:setOutputEnabled {
  enabled: false,
  senderUrl: 'http://localhost:5173/',
  senderFrame: { url: 'http://localhost:5173/', name: '', routingId: 1 },
  stack: 'Error\n' +
    '    at C:\\Users\\Raulacate\\Desktop\\Proyectos programacion\\LuxSync\\electron-app\\dist-electron\\main.js:40052:21\n' +
    '    at WebContents.<anonymous> (node:electron/js2c/browser_init:2:77979)\n' +
    '    at WebContents.emit (node:events:517:28)'
}
[Arbiter] 🎯 Entering calibration mode for fixture-1773676074189
[RADAR 1 - ENTRADA] UI mandó control a fixture-1773676074189: {}
[IPC] lux:start - TitanOrchestrator active
[TRACE ARBITER] manualOverride active {
  fixtureId: 'fixture-1773676074189',
  outputEnabled: false,
  source: 'calibration',
  overrideChannels: [ 'pan', 'tilt' ],
  controls: {}
}
[🐟 BABEL FISH] beam 2r (User Copy): RGB(0,0,0) → Color 6 (DMX 65)
[TRACE MAPPER] fixture DMX slice {
  fixtureId: 'fixture-1773688777389',
  universe: 0,
  address: 80,
  range: { start: 72, end: 98 },
  pan: 127,
  tilt: 40,
  speed: 0,
  channelsLen: 18,
  slice: [
    127, 40, 0, 255, 0, 65, 0,
      0,  0, 0,   0, 0,  0, 0,
      0,  0, 0,   0
  ]
}
[IPC] lux:start - TitanOrchestrator active
[TRACE MAPPER] fixture DMX slice {
  fixtureId: 'fixture-1773688777389',
  universe: 0,
  address: 80,
  range: { start: 72, end: 98 },
  pan: 127,
  tilt: 48,
  speed: 0,
  channelsLen: 18,
  slice: [
    127, 48, 0, 255, 0, 65, 0,
      0,  0, 0,   0, 0,  0, 0,
      0,  0, 0,   0
  ]
}
[TRACE ARBITER] manualOverride active {
  fixtureId: 'fixture-1773676074189',
  outputEnabled: false,
  source: 'calibration',
  overrideChannels: [ 'pan', 'tilt' ],
  controls: {}
}
[TRACE MAPPER] fixture DMX slice {
  fixtureId: 'fixture-1773688777389',
  universe: 0,
  address: 80,
  range: { start: 72, end: 98 },
  pan: 127,
  tilt: 97,
  speed: 0,
  channelsLen: 18,
  slice: [
    127, 97, 0, 255, 0, 65, 0,
      0,  0, 0,   0, 0,  0, 0,
      0,  0, 0,   0
  ]
}
[IPC 📡] audioBuffer #1 | titan.running=true | size=8192
[BETA 📡] AUDIO_BUFFER #0 | size=2048
[GOD EAR] 🩻 Generating Blackman-Harris window (4096 samples)
[AdaptiveNorm] 🧬 Instance created - Rolling Peak normalizer active
[TRACE HAL] Nombre del Driver: USBDMXDriverAdapter
[TRACE HAL] ¿Está conectado?: true
[TRACE HAL] ¿Tiene método send?: true
[TRACE MAPPER] fixture DMX slice {
  fixtureId: 'fixture-1773688777389',
  universe: 0,
  address: 80,
  range: { start: 72, end: 98 },
  pan: 127,
  tilt: 128,
  speed: 0,
  channelsLen: 18,
  slice: [
    127, 128, 0, 255, 0, 65, 0,
      0,   0, 0,   0, 0,  0, 0,
      0,   0, 0,   0
  ]
}
[IPC 📡] lux:arbiter:setOutputEnabled {
  enabled: true,
  senderUrl: 'http://localhost:5173/',
  senderFrame: { url: 'http://localhost:5173/', name: '', routingId: 1 },
  stack: 'Error\n' +
    '    at C:\\Users\\Raulacate\\Desktop\\Proyectos programacion\\LuxSync\\electron-app\\dist-electron\\main.js:40052:21\n' +
    '    at WebContents.<anonymous> (node:electron/js2c/browser_init:2:77979)\n' +
    '    at WebContents.emit (node:events:517:28)'
}
[MasterArbiter] 🚦 Output Gate: 🟢 LIVE { prev: false, label: 'IPC:lux:arbiter:setOutputEnabled:LIVE' }
[MasterArbiter] 🚦 Output Gate origin (trimmed):
Error
    at MasterArbiter.setOutputEnabled (C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\dist-electron\main.js:38672:21)
    at MasterArbiter.setOutputEnabledTagged (C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\dist-electron\main.js:38704:10)
    at C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\dist-electron\main.js:40070:18
    at WebContents.<anonymous> (node:electron/js2c/browser_init:2:77979)
    at WebContents.emit (node:events:517:28)
[TRACE ARBITER] manualOverride active {
  fixtureId: 'fixture-1773676074189',
  outputEnabled: true,
  source: 'calibration',
  overrideChannels: [ 'pan', 'tilt' ],
  controls: {}
}
[ARBITER 🎭] In: mood='dreamy' mode='major' → instant=NEUTRAL stable=NEUTRAL dom=100% B/D/N=0/0/60
[DRIFT RADAR] In: 'neutral' -> Act: 'neutral' | Drift: 0° | BaseHue: 120° | FinalHue: 135°
[Harmony 🎵] Initial Key (fallback): F# (60%)
[TRACE HAL] packets {
  statesIn: 2,
  packetsOut: 2,
  universes: [ [ 0, 2 ] ],
  firstPacketUniverse: 0,
  firstPacketPreview24: '0,29,240,58,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0',
  firstNonZeroUniverse: 0,
  firstNonZeroPreview24: '0,29,240,58,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0'
}
[TRACE MAPPER] fixture DMX slice {
  fixtureId: 'fixture-1773688777389',
  universe: 0,
  address: 80,
  range: { start: 72, end: 98 },
  pan: 127,
  tilt: 128,
  speed: 127,
  channelsLen: 18,
  slice: [
    127, 128, 0, 255, 0, 10, 0,
    127,   0, 0,   0, 0,  0, 0,
      0,   0, 0,   0
  ]
}
[KeyStabilizer] 🎵 Initial key detected: F#
[🐟 BABEL FISH] beam 2r (User Copy): RGB(235,78,4) → Red (DMX 10)
[TRACE MAPPER] fixture DMX slice {
  fixtureId: 'fixture-1773688777389',
  universe: 0,
  address: 80,
  range: { start: 72, end: 98 },
  pan: 127,
  tilt: 128,
  speed: 127,
  channelsLen: 18,
  slice: [
    127, 128, 0, 255, 0, 10, 0,
    127,   0, 0,   0, 0,  0, 0,
      0,   0, 0,   0
  ]
}
[INTERVAL] F20 bpm=0 raw=0 conf=0.000 kick=false phase=0.00 needle=0.0000 bassFlux=0.0000 midFlux=0.0000 centroid=10008Hz kicks=0
[TRACE ARBITER] manualOverride active {
  fixtureId: 'fixture-1773676074189',
  outputEnabled: true,
  source: 'calibration',
  overrideChannels: [ 'pan', 'tilt' ],
  controls: {}
}
[TRACE MAPPER] fixture DMX slice {
  fixtureId: 'fixture-1773688777389',
  universe: 0,
  address: 80,
  range: { start: 72, end: 98 },
  pan: 127,
  tilt: 128,
  speed: 127,
  channelsLen: 18,
  slice: [
    127, 128, 0, 255, 0, 50, 0,
    127,   0, 0,   0, 0,  0, 0,
      0,   0, 0,   0
  ]
}
[ARBITER 🎭] In: mood='dreamy' mode='major' → instant=NEUTRAL stable=NEUTRAL dom=100% B/D/N=0/0/90
[DRIFT RADAR] In: 'neutral' -> Act: 'neutral' | Drift: 0° | BaseHue: 180° | FinalHue: 195°
[TRACE MAPPER] fixture DMX slice {
  fixtureId: 'fixture-1773688777389',
  universe: 0,
  address: 80,
  range: { start: 72, end: 98 },
  pan: 127,
  tilt: 128,
  speed: 127,
  channelsLen: 18,
  slice: [
    127, 128, 0, 255, 0, 20, 0,
    127,   0, 0,   0, 0,  0, 0,
      0,   0, 0,   0
  ]
}
[IPC 📡] audioBuffer #33 | titan.running=true | size=8192
[TRACE ARBITER] manualOverride active {
  fixtureId: 'fixture-1773676074189',
  outputEnabled: true,
  source: 'calibration',
  overrideChannels: [ 'pan', 'tilt' ],
  controls: {}
}
[TRACE HAL] Nombre del Driver: USBDMXDriverAdapter
[TRACE HAL] ¿Está conectado?: true
[TRACE HAL] ¿Tiene método send?: true
[TRACE MAPPER] fixture DMX slice {
  fixtureId: 'fixture-1773688777389',
  universe: 0,
  address: 80,
  range: { start: 72, end: 98 },
  pan: 127,
  tilt: 128,
  speed: 127,
  channelsLen: 18,
  slice: [
    127, 128, 0, 255, 0, 20, 0,
    127,   0, 0,   0, 0,  0, 0,
      0,   0, 0,   0
  ]
}
[TRACE MAPPER] fixture DMX slice {
  fixtureId: 'fixture-1773688777389',
  universe: 0,
  address: 80,
  range: { start: 72, end: 98 },
  pan: 127,
  tilt: 128,
  speed: 127,
  channelsLen: 18,
  slice: [
    127, 128, 0, 255, 0, 20, 0,
    127,   0, 0,   0, 0,  0, 0,
      0,   0, 0,   0
  ]
}
[INTERVAL] F40 bpm=0 raw=0 conf=0.000 kick=false phase=0.00 needle=0.0000 bassFlux=0.0000 midFlux=0.0000 centroid=10629Hz kicks=0
[GOD EAR 🩻] SHADOW MODE TELEMETRY:
   Clarity:     0.806 (Rock target: >0.7)
   Flatness:    0.000 (Tonal<0.3, Noise>0.7)
   Centroid:    10564Hz (Bright>2000, Dark<1200)
   CrestFactor: 3.55 (Dynamics)
   Rolloff:     17636Hz (85% energy)
   Latency:     1.41ms
   UltraAir:    0.000 (NEW: 16-22kHz sizzle)
[TRACE ARBITER] manualOverride active {
  fixtureId: 'fixture-1773676074189',
  outputEnabled: true,
  source: 'calibration',
  overrideChannels: [ 'pan', 'tilt' ],
  controls: {}
}
[TRACE MAPPER] fixture DMX slice {
  fixtureId: 'fixture-1773688777389',
  universe: 0,
  address: 80,
  range: { start: 72, end: 98 },
  pan: 127,
  tilt: 128,
  speed: 127,
  channelsLen: 18,
  slice: [
    127, 128, 0, 255, 0, 20, 0,
    127,   0, 0,   0, 0,  0, 0,
      0,   0, 0,   0
  ]
}
[ARBITER 🎭] In: mood='dreamy' mode='major' → instant=NEUTRAL stable=NEUTRAL dom=100% B/D/N=0/0/134
[DRIFT RADAR] In: 'neutral' -> Act: 'neutral' | Drift: 0° | BaseHue: 180° | FinalHue: 195°
[TRACE HAL] packets {
  statesIn: 2,
  packetsOut: 2,
  universes: [ [ 0, 2 ] ],
  firstPacketUniverse: 0,
  firstPacketPreview24: '0,56,196,250,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0',
  firstNonZeroUniverse: 0,
  firstNonZeroPreview24: '0,56,196,250,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0'
}
[🐟 BABEL FISH] beam 2r (User Copy): RGB(230,255,0) → Yellow (DMX 20)
[Harmony ⚠️] Freq 11940Hz fuera de rango musical
[TRACE MAPPER] fixture DMX slice {
  fixtureId: 'fixture-1773688777389',
  universe: 0,
  address: 80,
  range: { start: 72, end: 98 },
  pan: 127,
  tilt: 128,
  speed: 127,
  channelsLen: 18,
  slice: [
    127, 128, 0, 255, 0, 20, 0,
    127,   0, 0,   0, 0,  0, 0,
      0,   0, 0,   0
  ]
}
[IPC 📡] lux:arbiter:setOutputEnabled {
  enabled: false,
  senderUrl: 'http://localhost:5173/',
  senderFrame: { url: 'http://localhost:5173/', name: '', routingId: 1 },
  stack: 'Error\n' +
    '    at C:\\Users\\Raulacate\\Desktop\\Proyectos programacion\\LuxSync\\electron-app\\dist-electron\\main.js:40052:21\n' +
    '    at WebContents.<anonymous> (node:electron/js2c/browser_init:2:77979)\n' +
    '    at WebContents.emit (node:events:517:28)'
}
[MasterArbiter] 🚦 Output Gate: 🔴 ARMED { prev: true, label: 'IPC:lux:arbiter:setOutputEnabled:ARMED' }
[MasterArbiter] 🚦 Output Gate origin (trimmed):
Error
    at MasterArbiter.setOutputEnabled (C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\dist-electron\main.js:38672:21)
    at MasterArbiter.setOutputEnabledTagged (C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\dist-electron\main.js:38704:10)
    at C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\dist-electron\main.js:40070:18
    at WebContents.<anonymous> (node:electron/js2c/browser_init:2:77979)
    at WebContents.emit (node:events:517:28)
[TRACE MAPPER] fixture DMX slice {
  fixtureId: 'fixture-1773688777389',
  universe: 0,
  address: 80,
  range: { start: 72, end: 98 },
  pan: 127,
  tilt: 128,
  speed: 0,
  channelsLen: 18,
  slice: [
    127, 128, 0, 255, 0, 65, 0,
      0,   0, 0,   0, 0,  0, 0,
      0,   0, 0,   0
  ]