PRE-FLIGHT CHECK REPORT
1. window.lux.forceStrike / IPC bridge:
❌ Sin scope. Firma actual: (config: { effect: string; intensity: number }). El preload (preload.ts) la pasa directamente a ipcRenderer.invoke('lux:forceStrike', config). Sin campo scope.

2. KeyActionDispatcher.ts:
❌ Sin scope. La rama fx-* llama lux?.forceStrike?.({ effect: effectId, intensity: payload.intensity }). ActionPayload no tiene campo scope. La interfaz local LuxBridgeSubset.forceStrike tampoco lo declara.

3. IPCHandlers.ts / handler lux:forceStrike:
❌ Sin scope. Recibe { effect, intensity } y llama titanOrchestrator.forceStrikeNextFrame(config). ForceStrikeConfig (TitanOrchestrator.ts) tampoco tiene scope.

4. useKeyboardCortex.ts:
❌ Cuando un chord dispara, llama dispatchAction(chord.actionId, { source, intensity, modifiers, phase }) sin ningún scope derivado de las teclas del chord. ChordBinding no tiene scopeGroupIndex.

IMPLEMENTACIÓN
Son 9 cambios quirúrgicos encadenados. Los hago en paralelo donde no hay dependencia.

Starting: Extender tipos: ActionPayload + ChordBinding + ForceStrikeConfig + EffectTriggerConfig (5/10)

Paso 5 — Extender los tipos base (4 archivos, sin dependencias entre sí):

Paso 6 — Extender KeyActionDispatcher.ts: añadir scope a LuxBridgeSubset.forceStrike, exportar resolveGroupScope, y pasar scope en la rama fx-*:

Paso 7 — Extender pipeline IPC (preload, vite-env, IPCHandlers, TitanEngine):

El IPCHandlers falló — el original tiene caracteres raros (emoji mal codificado). Consulto el texto exacto:

Paso 8 — useKeyboardCortex.ts: importar resolveGroupScope y usarlo al despachar un chord con scopeGroupIndex:

Paso 9 — stadiumLoadout.ts: declarar scopeGroupIndex en los chords existentes:

Edited
stadiumLoadout.ts+3-2
Paso 10 — Validar TypeScript:

Cero errores en todos los archivos.

Completed: Validar sin errores de compilación (10/10)

ENTREGABLE — WAVE 4802-D COMPLETE
Qué encontré en el Pre-Flight
Componente	Estado antes	Gap
window.lux.forceStrike + preload	{ effect, intensity }	❌ Sin scope
KeyActionDispatcher (fx-* branch)	Sin scope en el call	❌
ActionPayload / ChordBinding	Sin campo scope/scopeGroupIndex	❌
ForceStrikeConfig	Sin scope	❌
EffectTriggerConfig	Sin fixtureScope	❌
useKeyboardCortex chord dispatch	Sin derivación de scope desde chord	❌
stadiumLoadout chords	Comentario "scope not yet implemented"	❌
Cambios aplicados (10 archivos, 0 errores)
Tipos (types.ts, TitanOrchestrator.ts, effects/types.ts)

ActionPayload → scope?: string[] — el vector de IDs de fixtures que viajaen el payload de cualquier acción
ChordBinding → scopeGroupIndex?: number — índice de grupo (1-based) que el chord declara como objetivo
ForceStrikeConfig → scope?: string[] — propagado por el pipeline IPC/Engine
EffectTriggerConfig → fixtureScope?: string[] — punto de aterrizaje en el EffectManager
Dispatcher (KeyActionDispatcher.ts)

LuxBridgeSubset.forceStrike ahora tipea scope?: string[]
Rama fx-*: pasa scope: payload.scope al call de forceStrike
Exporta resolveGroupScope(groupIndex) — wrapper público de getGroupFixtureIds
Pipeline IPC

preload.ts: la firma acepta scope?: string[]
vite-env.d.ts: tipo global actualizado
IPCHandlers.ts: handler recibe y pasa scope al forceStrikeNextFrame
TitanEngine.ts: destructura scope de manualStrikePending → pasa como fixtureScope a effectManager.trigger, loguea el count
Cortex (useKeyboardCortex.ts)

Importa resolveGroupScope
Cuando un chord tiene scopeGroupIndex, resuelve los fixture IDs en tiempo real y los mete en payload.scope. Si el grupo está vacío (show sin fixtures aún), scope = undefined → comportamiento por defecto intacto
Loadout (stadiumLoadout.ts)

chord-group1-strobe (1+F) → scopeGroupIndex: 1
chord-group2-strobe (2+F) → scopeGroupIndex: 2
Comportamiento resultante

Operador pulsa 1 + F  (chord detectado):
  └── useKeyboardCortex detecta chord con scopeGroupIndex=1
  └── resolveGroupScope(1) → ['fix-001', 'fix-002', 'fix-005']
  └── dispatchAction('fx-strobe_storm', { source:'keyforge', scope:['fix-001','fix-002','fix-005'], ... })
  └── KeyActionDispatcher → lux.forceStrike({ effect:'strobe_storm', intensity:1.0, scope:[...] })
  └── IPC 'lux:forceStrike' → titanOrchestrator.forceStrikeNextFrame({ ..., scope:[...] })
  └── TitanEngine → effectManager.trigger({ ..., fixtureScope:['fix-001','fix-002','fix-005'] })
  └── Log: [TitanEngine] 🧨 MANUAL STRIKE: strobe_storm @ 1.00 [🎯 3 fixtures]

Selección persistente de la UI → INTACTA  ✅


El fixtureScope en EffectTriggerConfig es el punto de extensión para que futuras waves apliquen el efecto sólo a esos fixtures en el sistema de zonas de Aether. La infraestructura está completa y correctamente tipada de punta a punta.

Claude Sonnet 4.6 • 1