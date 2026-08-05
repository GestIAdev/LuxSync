EFFECT TRIGGER PIPELINE & UI GATING AUDIT
Modo: READ-ONLY forensic audit — No se modificó código. Fecha: 2026-08-05 Auditor: Lead Systems Architect

1. TRIGGER PIPELINE MAP
1.1 Arquitectura General
Todos los triggers de efectos convergen en un único punto de entrada: EffectManager.trigger() (src/core/effects/EffectManager.ts:382). La excepción son los clips custom de Hephaestus (.lfx v2.1+), que bypassan EffectManager y van directo a HephaestusRuntime.play() / playFromClip().



┌─────────────────────────────────────────────────────────────────────┐
│                     INPUT VECTORS (4 sources)                       │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│  MIDI Pads   │  Keyboard    │  Selene IA   │  Chronos Timecoder    │
│  (useMidiLearn)│(KeyActionDispatcher)│(Consciousness)│(TimelineEngine)│
└──────┬───────┴──────┬───────┴──────┬───────┴───────────┬───────────┘
       │              │              │                   │
       ▼              ▼              ▼                   ▼
  window.lux.    window.lux.   ConsciousnessOutput   chronos:triggerFX
  forceStrike()  forceStrike() .effectDecision       (IPC handler)
       │              │              │                   │
       └──────┬───────┴──────┬───────┘                   │
              ▼              ▼                           │
     IPC 'lux:forceStrike'   │                           │
              │              │                           │
              ▼              │                           │
  TitanOrchestrator.         │                           │
  forceStrikeNextFrame()     │                           │
              │              │                           │
              ▼              │                           │
  TitanEngine.               │                           │
  manualStrikePending ───────┤                           │
              │              │                           │
              ▼              ▼                           │
     EffectManager.trigger() ◄───────────────────────────┘
              │                                        │
              ▼                                        ▼
  SeleneHephBridge.route()                    chronos:triggerHeph
     ├─ HIT → playHook()                     (IPC handler)
     │       → HephaestusRuntime.play()              │
     └─ MISS → legacy path                          ▼
              → EffectManager legacy          HephaestusRuntime.play()
                                                   │
                                                   ▼
                                          HephaestusRuntime.tick()
                                                   │
                                                   ▼
                                          TickEngine (per-frame)
                                                   │
                                          ═════════════════
                                          🔒 DJ_FOUNDER GATE
                                          ═════════════════
                                                   │
                                      ┌────────────┴────────────┐
                                      ▼                         ▼
                              FULL_SUITE:               DJ_FOUNDER:
                              Apply Heph outputs         DISCARD all outputs
                              to fixtureStates           (silently dropped)
1.2 Vector 1: MIDI Pads
Path: useMidiLearn.ts:217 → window.lux.forceStrike() → IPC lux:forceStrike → TitanOrchestrator.forceStrikeNextFrame() → TitanEngine.manualStrikePending → EffectManager.trigger()

[useMidiLearn.ts:210-219](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hooks/useMidiLearn.ts:209:0-218:999)



typescript
// 'fx-strobe_storm' → 'strobe_storm'
const effectId = controlId.slice(3)
const intensity = 1.0  // WAVE 3303: manual pad trigger = FULL POWER
window.lux.forceStrike({ effect: effectId, intensity })
Source tag: 'manual' (default en forceStrikeNextFrame)

Tier gate interaction: EffectManager.trigger() → SeleneHephBridge.route() → si HIT, playHook() → HephaestusRuntime.play() → tick() produce outputs → TickEngine line 754 descarta si DJ_FOUNDER.

1.3 Vector 2: Keyboard (KeyForge Cortex)
Path: useKeyboardCortex.ts → KeyActionDispatcher.dispatchAction() → window.lux.forceStrike() → mismo path que MIDI

[KeyActionDispatcher.ts:515-521](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/keyforge/KeyActionDispatcher.ts:514:0-520:999)



typescript
// ── fx-* → forceStrike (effect trigger) ──
if (actionId.startsWith('fx-')) {
  if (payload.phase === 'release') return true
  const effectId = actionId.slice(3)
  lux?.forceStrike?.({ effect: effectId, intensity: payload.intensity, scope: payload.scope })
  return true
}
Source tag: 'manual' (mismo path que MIDI)

Tier gate interaction: Idéntico a MIDI — converge en EffectManager → SeleneHephBridge → HephaestusRuntime → TickEngine gate.

1.4 Vector 3: Selene IA (Neural Command)
Path: TitanEngine.ts:1132-1151 → EffectManager.trigger() con source: consciousnessOutput.source

[TitanEngine.ts:1131-1151](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/TitanEngine.ts:1130:0-1150:999)



typescript
else if (consciousnessOutput.effectDecision) {
  const { effectType, intensity, reason, confidence } = consciousnessOutput.effectDecision
  if (confidence > 0.6) {
    this.effectManager.trigger({
      effectType,
      intensity,
      source: consciousnessOutput.source,  // 'hunt|dream|prediction|...'
      reason,
      musicalContext: { zScore, bpm, energy, vibeId, beatPhase, inDrop },
    })
  }
}
Source tag: Variable — consciousnessOutput.source (ej: 'hunt_strike', 'dream', 'prediction')

Tier gate interaction: EffectManager.trigger() → SeleneHephBridge.route() (EffectManager.ts:475) → si HIT, playHook() → HephaestusRuntime.play() → tick() → TickEngine gate descarta si DJ_FOUNDER.

⚠️ CRÍTICO: Selene IA es la fuente más afectada por el gate de DJ_FOUNDER. La consciencia de Selene decide disparar un efecto → el bridge lo rutea a Hephaestus → el runtime lo evalúa → pero los outputs son descartados en TickEngine:754. El trabajo computacional se hace pero el resultado nunca llega a DMX.

1.5 Vector 4: Chronos (Timecoder)
Chronos tiene dos paths distintos:

Path A — FX Clips estándar: ChronosIPCBridge → IPC chronos:triggerFX → TitanOrchestrator.forceStrikeNextFrame({ source: 'chronos' }) → EffectManager.trigger({ source: 'chronos' }) → SeleneHephBridge → HephaestusRuntime

[IPCHandlers.ts:368-375](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/IPCHandlers.ts:367:0-374:999)

Path B — Heph Diamond Clips (custom .lfx): ChronosIPCBridge → IPC chronos:triggerFX → bypass EffectManager → HephaestusRuntime.playFromClip() directo

[IPCHandlers.ts:357-365](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/IPCHandlers.ts:356:0-364:999)



typescript
if (config.effectId === 'heph-custom' && hephClip) {
  const runtime = getHephaestusRuntime()
  const instanceId = runtime.playFromClip(hephClip, { ... })
  return { success: true, instanceId }
}
Path C — Heph File Clips (from disk): ChronosIPCBridge → IPC chronos:triggerHeph → HephaestusRuntime.play(filePath) directo

[IPCHandlers.ts:417-422](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/IPCHandlers.ts:416:0-421:999)

Path D — TimelineEngine (backend, sin IPC): TimelineEngine.triggerHephClip() → HephaestusRuntime.playFromClip() directo

[TimelineEngine.ts:413-434](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/engine/TimelineEngine.ts:412:0-433:999)

Source tag: 'chronos' (bypassa Shield y cooldown en EffectManager)

Tier gate interaction: Paths B, C, D bypassan EffectManager pero NO bypassan el TickEngine gate. HephaestusRuntime.tick() produce outputs, pero TickEngine:754 los descarta si DJ_FOUNDER.

2. DJ_FOUNDER TIER INTERCEPTION POINTS
2.1 Gate Primario — TickEngine.ts:754 (Post-HAL DMX Merge)
[TickEngine.ts:748-754](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts:747:0-753:999)



typescript
const hephRuntime = getHephaestusRuntime()
const hephOutputs = hephRuntime.tick(now) // ⚡ WAVE 3050: unified timestamp
 
// 🔒 WAVE 2490: THE TIER SEPARATION PROTOCOL — Hephaestus DMX Gate
// DJ_FOUNDER: Hephaestus runtime ticks are silently discarded.
// The engine runs but its output never reaches fixtures.
if (hephOutputs.length > 0 && this._licenseTier !== 'DJ_FOUNDER') {
  // ... apply Heph outputs to fixtureStates ...
}
Qué hace: Si _licenseTier === 'DJ_FOUNDER', el bloque entero de aplicación de Hephaestus outputs a fixtureStates se skipa. Los outputs se calculan (HephaestusRuntime.tick() corre) pero se descartan.

2.2 Gate Secundario — TickEngine.ts:1187 (Aether L3+ Adapter)
[TickEngine.ts:1183-1191](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts:1182:0-1190:999)



typescript
// STEP 5: Hephaestus L3+ Diamond Data bridge
if (hephOutputs.length > 0 && this._licenseTier !== 'DJ_FOUNDER') {
  this._hephaestusAetherAdapter.ingest(hephOutputs, aetherArbiter)
} else {
  this._hephaestusAetherAdapter.clear(aetherArbiter)
}
Qué hace: El adapter L3+ (para fixtures en NodeGraph con clips custom) también se gatea. Si DJ_FOUNDER, se llama clear() en lugar de ingest().

2.3 No Hay Gate en EffectManager ni SeleneHephBridge
Importante: No existe ningún check de _licenseTier en:

EffectManager.trigger() — todos los sources pasan
SeleneHephBridge.route() — el bridge rutea sin importar el tier
HephaestusRuntime.play() / playFromClip() — el runtime ejecuta clips sin importar el tier
TitanEngine.forceStrikeNextFrame() — el queue no se filtra
El gate es exclusivamente post-cómputo en TickEngine. Esto significa que para DJ_FOUNDER:

Selene IA decide disparar un efecto ✅
EffectManager lo procesa ✅
SeleneHephBridge lo rutea a Hephaestus ✅
HephaestusRuntime.play() carga el clip ✅
HephaestusRuntime.tick() evalúa las curvas Bezier ✅
TickEngine descarta los outputs ❌
Para bypassar el gate solo para Selene: El punto de modificación sería TickEngine.ts:754 y 1187. Se necesitaría distinguir el source del output (¿vino de Selene IA vs Chronos vs MIDI manual?). Actualmente hephOutputs no carrea metadata de source — es un array de HephFixtureOutput sin trazabilidad de origen.

3. FRONTEND UI GATING AUDIT
3.1 License Store — Tab Access Control
[licenseStore.ts:20-21](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/stores/licenseStore.ts:19:0-20:999)



typescript
/** Tabs restringidos para DJ_FOUNDER */
const DJ_FOUNDER_RESTRICTED_TABS = new Set(['chronos', 'hephaestus'])
[licenseStore.ts:64-68](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/stores/licenseStore.ts:63:0-67:999)



typescript
isTabAllowed: (tabId: string) => {
  const { tier } = get()
  if (tier === 'FULL_SUITE') return true
  return !DJ_FOUNDER_RESTRICTED_TABS.has(tabId)
},
Tabs restringidos para DJ_FOUNDER:

chronos — 🔒 locked
hephaestus — 🔒 locked
Tabs accesibles para DJ_FOUNDER (todos los demás):

dashboard ✅
live ✅
calibration ✅
constructor ✅
forge ✅
keyforge ✅
nexus ✅
core ✅
theia ✅
3.2 Sidebar.tsx — Tab Lock Rendering
[Sidebar.tsx:80-99](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/layout/Sidebar.tsx:79:0-98:999)



typescript
const NavTab: React.FC<NavTabProps> = ({ tab, isActive, onClick, variant, locked }) => {
  return (
    <button
      className={`nav-tab ${variant} ${isActive ? 'active' : ''} ${locked ? 'locked' : ''}`}
      onClick={locked ? undefined : onClick}
      title={locked ? `🔒 ${tab.label} — Requiere Full Suite` : `${tab.description} (${tab.shortcut})`}
      style={{ '--tab-color': locked ? '#444' : TAB_COLORS[tab.id] } as React.CSSProperties}
      disabled={locked}
    >
      {locked && <span className="nav-lock">🔒</span>}
    </button>
  )
}
Comportamiento locked:

onClick se setea a undefined (no navega)
disabled={locked} (botón deshabilitado)
Aparece icono 🔒
Color se fuerza a #444 (gris)
Tooltip: "🔒 CHRONOS — Requiere Full Suite"
Renderizado:

STAGE_TABS (dashboard, live, calibration, chronos) — locked={!isTabAllowed(tab.id)}
TOOL_TABS (constructor, forge, keyforge, hephaestus, nexus, core, theia) — locked={!isTabAllowed(tab.id)}
3.3 ContentArea.tsx — View Rendering Gate
[ContentArea.tsx:122-154](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/layout/ContentArea.tsx:121:0-153:999)



typescript
const renderView = () => {
  switch (renderedTab) {
    case 'dashboard':  return <DashboardView />
    case 'constructor': return <ErebusShell />
    case 'live':       return <LiveStageView />
    case 'calibration': return <CalibrationView />
    case 'forge':      return <ForgeView />
    case 'keyforge':   return <KeyForgeView />
    case 'chronos':
      return isTabAllowed('chronos') ? <ChronosStudio /> : <UpgradeGate featureName="CHRONOS STUDIO" />
    case 'hephaestus':
      return isTabAllowed('hephaestus') ? <HephaestusView /> : <UpgradeGate featureName="HEPHAESTUS STUDIO" />
    case 'nexus':      return <VisualPatcher />
    case 'core':       return <NeuralCommandView />
    case 'theia':      return <TheiaEngineView />
    default:           return <DashboardView />
  }
}
Gate pattern: Solo chronos y hephaestus tienen check isTabAllowed(). Si el tab está restringido, se renderiza <UpgradeGate> en lugar del componente real. Todos los demás tabs se renderizan sin check.

3.4 Verificación de THEIA
THEIA es completamente accesible para DJ_FOUNDER:

Check	Estado
DJ_FOUNDER_RESTRICTED_TABS incluye theia?	❌ No — no está en el Set
isTabAllowed('theia') para DJ_FOUNDER	✅ true (no está en el Set restringido)
ContentArea gatea theia?	❌ No — se renderiza directamente sin check
Sidebar marca theia como locked?	❌ No — locked={false}
navigationStore incluye theia en tabs?	✅ Sí — `ToolId = '...
THEIA no tiene ningún gate de tier. Es accesible tanto para DJ_FOUNDER como para FULL_SUITE.

4. MATRIZ DE ACCESO POR TIER
Tab	Tipo	DJ_FOUNDER	FULL_SUITE	Gate Location
dashboard	stage	✅	✅	None
live	stage	✅	✅	None
calibration	stage	✅	✅	None
chronos	stage	🔒 locked	✅	licenseStore + ContentArea:143
constructor	tool	✅	✅	None
forge	tool	✅	✅	None
keyforge	tool	✅	✅	None
hephaestus	tool	🔒 locked	✅	licenseStore + ContentArea:145
nexus	tool	✅	✅	None
core	tool	✅	✅	None
theia	tool	✅	✅	None
5. HALLAZGOS CRÍTICOS PARA FUTURO REFACTOR
5.1 El Gate de DJ_FOUNDER es Post-Cómputo (Wasteful)
El gate en TickEngine.ts:754 descarta outputs después de que HephaestusRuntime.tick() ya evaluó todas las curvas Bezier. Para DJ_FOUNDER, este cómputo es wasted CPU. Si se quiere optimizar, se podría gatear en HephaestusRuntime.play() / playFromClip() (no cargar el clip si DJ_FOUNDER).

5.2 No Hay Trazabilidad de Source en HephFixtureOutput
HephFixtureOutput no incluye metadata de source (midi/keyboard/selene/chronos). Para bypassar el gate solo para Selene, se necesitaría:

Opción A: Añadir campo source a HephFixtureOutput y propagarlo desde play() / playFromClip()
Opción B: Mantener un map de instanceId → source en HephaestusRuntime
Opción C: Gatear en SeleneHephBridge.route() en lugar de TickEngine (no llamar playHook si DJ_FOUNDER y source === 'selene')
5.3 Chronos Tiene 4 Paths Distintos a Hephaestus
Los 4 paths (A: FX→EffectManager, B: Diamond→Runtime directo, C: File→Runtime directo, D: TimelineEngine→Runtime directo) hacen que gatear Chronos sea complejo. Los paths B, C, D bypassan EffectManager completamente.

5.4 El Gate Frontend es Consistente con el Backend
Feature	Frontend Gate	Backend Gate	Consistencia
Chronos tab	UpgradeGate si DJ_FOUNDER	TickEngine descarta Heph outputs	✅
Hephaestus tab	UpgradeGate si DJ_FOUNDER	TickEngine descarta Heph outputs	✅
Theia tab	Sin gate	Sin gate	✅
Effect triggers (MIDI/KB)	Sin gate UI	TickEngine gate	✅ (efectos legacy funcionan, Heph no)
No hay inconsistencias entre frontend y backend.

Esperando instrucciones humanas antes de proponer cualquier refactor.