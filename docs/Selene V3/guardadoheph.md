WAVE 7175 — Auditoría: Pipeline de Guardado y Resolución de .lfx
1. El Payload de la UI (Frontend) — BUG ENCONTRADO
Componente: DnaRail.tsx — sliders de ACOUSTIC PRESSURE en líneas 642-693.

Flujo de datos:

El usuario mueve los sliders → handlePressureMin/handlePressureMax actualizan form.pressureRange (estado local React, línea 173).
Al cambiar form, se recomputea instance = buildInstance(form) (useMemo, línea 305).
Al cambiar instance, un useEffect (línea 329) propaga al parent vía onDnaChange().
El bug está en DnaRail.tsx:335-346 — el useEffect que propaga:



tsx
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/views/HephaestusView/dna/DnaRail.tsx:335-346
    const reality = instance.toCognitiveDNA()
    onDnaChange({
      genome: { ...reality.genome },
      textureAffinity: form.textureAffinity,
      compatibleVibes: [...reality.compatibleVibes],
      validSections: dna.validSections,
      energyZone: { ...reality.energyZone },
      aggressionRange: { ...reality.aggressionRange },
      pressureRange: { ...form.pressureRange },   // ← USA form.pressureRange ✓
      spatialBehavior: reality.spatialBehavior,
      ikCompatibility: dna.ikCompatibility,
    })
La línea 343 sí usa form.pressureRange (los valores del slider). Esto es correcto.

PERO — instance.toCognitiveDNA() (línea 335) ignora form.pressureRange y recalcula el suyo propio:



ts
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/arsenal/LfxClipInstance.ts:564-570
    const pressureRange = Object.freeze(
      isHardArchetype || aggression > 0.7
        ? { min: 0.5, max: 1.0 }     // ← OVERRIDE HARDCODED
        : isAmbientArchetype
          ? { min: 0.0, max: 0.5 }
          : { min: 0.0, max: 1.0 }
    )
Sin embargo, DnaRail.tsx:343 no usa reality.pressureRange — usa form.pressureRange. Entonces el payload que llega al store sí contiene los valores del slider.

Veredicto P1: El payload de la UI es correcto. onDnaChange empaqueta form.pressureRange (valores vivos del slider), no datos obsoletos.

2. El Sistema de Guardado (Backend/Main) — OK, PERO CON MATIZ
Flujo:

HephaestusView.index.tsx:176 → serializeHephClip(clip) → window.luxsync.hephaestus.save(serialized).
IPC handler heph:save (HephIPCHandlers.ts:50) → hephFileIO.saveClip(clipData).
HephFileIO.saveClip() (HephFileIO.ts:159) escribe a:


ts
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/hephaestus/HephFileIO.ts:189-190
    const fileName = `${clip.id}.lfx`;
    const filePath = path.join(this.arsenalPath!, fileName);
arsenalPath = userData/arsenal/ (línea 129). Siempre escribe a la carpeta local del usuario. No existe opción de escribir al repo/builtins.

Después de escribir, hace index.upsert(filePath, 'user') (línea 197) y _lfxLoader.loadFile(filePath, 'user') (línea 60 en HephIPCHandlers) para hot-registration en el DynamicEffectRegistry.
Veredicto P2: El guardado es correcto — siempre escribe a userData/arsenal/{clip.id}.lfx. El problema NO está aquí.

3. El Resolver de Archivos — ROOT CAUSE ENCONTRADO
Boot-time loading (main.ts:580-615):



ts
// 1. Builtins (repo) — source: 'builtin'
_vibeDirectories.push({ absolutePath: _builtinPath, source: 'builtin' })  // subcarpetas por vibe
 
// 2. User arsenal (local) — source: 'user'
const _arsenalPath = path.join(app.getPath('userData'), 'arsenal')
_vibeDirectories.push({ absolutePath: _arsenalPath, source: 'user' })
 
const _arsenalReport = await _lfxLoader.loadAll(_vibeDirectories)
Orden de carga: builtins primero, user después. loadAll itera secuencialmente (línea 96).

Prioridad de override en DynamicEffectRegistry.registerEffectV3() (DynamicEffectRegistry.ts:124-128):



ts
const prev = this._byId.get(entry.id)
if (prev) this._removeFromIndices(prev)
this._byId.set(entry.id, entry)
Last-write-wins. Como user se carga después de builtin, un .lfx en userData/arsenal/ con el mismo ID que un builtin debería ganar. Esto es correcto en boot-time.

PERO — el HephaestusClipIndex (el que usa heph:load para servir clips al editor) tiene un problema diferente:



ts
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/hephaestus/HephaestusClipIndex.ts:229-237
      const existing = this._byId.get(clip.id)
      if (existing && existing.filePath !== filePath) {
        this._byPath.delete(existing.filePath)
      }
      this._byId.set(clip.id, loaded)
      this._byPath.set(filePath, loaded)
También es last-write-wins. En boot-time, los builtins se cargan primero y los user después, así que el user debería ganar.

El problema real está en el DynamicEffectRegistry polyfill:



ts
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/arsenal/DynamicEffectRegistry.ts:109-112
    // Polyfill legacy .lfx: inject default pressureRange if missing
    if (!dna.pressureRange) {
      (dna as { pressureRange: { min: number; max: number } }).pressureRange = { min: 0.5, max: 1.0 }
    }
Este polyfill inyecta { min: 0.5, max: 1.0 } cuando pressureRange falta. Pero el .lfx de machine_gun ya tiene pressureRange: { min: 0.5, max: 1.0 } en el archivo, así que el polyfill no aplica en este caso.

El verdadero root cause: LfxClipInstance.toCognitiveDNA() override
Cuando el usuario abre un clip en el editor, el flujo es:

heph:load devuelve el clip desde HephaestusClipIndex (que leyó del disco — valores correctos).
loadClip(clip) lo carga en el store.
DnaRail recibe dna={clip?.cognitiveDNA} — con los valores del archivo.
El usuario modifica los sliders → form.pressureRange se actualiza.
useEffect propaga onDnaChange({ ... pressureRange: { ...form.pressureRange } }) al store.
El store actualiza clip.cognitiveDNA.pressureRange con los nuevos valores.
El usuario guarda → serializeHephClip(clip) → escribe al disco.
El problema: LfxClipInstance.toCognitiveDNA() (línea 564) ignora completamente cualquier pressureRange del input y siempre recalcula basándose en el archetype/aggression. Aunque DnaRail.tsx:343 usa form.pressureRange (no reality.pressureRange), hay un segundo path de pérdida:

Cuando DnaRail sincroniza desde el dna prop (línea 286-301, el useEffect que se dispara al cambiar de clip), lee dna.pressureRange correctamente. Pero si en algún momento otro componente llama instance.toCognitiveDNA() directamente, los valores del slider se pierden porque toCognitiveDNA() siempre recalcula pressureRange.

El otro problema crítico — HephaestusClipIndex vs DynamicEffectRegistry son dos índices paralelos:

HephaestusClipIndex — sirve clips al editor (vía heph:load)
DynamicEffectRegistry — sirve efectos a Selene IA (vía getEffectsForVibe etc.)
Ambos se alimentan de los mismos archivos pero no se sincronizan entre sí. Cuando se guarda un clip:

HephFileIO.saveClip() escribe a disco + HephaestusClipIndex.upsert(filePath, 'user').
HephIPCHandlers también llama _lfxLoader.loadFile(filePath, 'user') que hace HephaestusClipIndex.upsert de nuevo + DynamicEffectRegistry.registerEffectV3().
El upsert se llama dos veces (redundante pero inofensivo). El registerEffectV3 aplica el polyfill de pressureRange si falta — pero si el clip ya tiene pressureRange, no lo sobreescribe.

Resumen de hallazgos
Punto	Estado	Hallazgo
1. UI Payload	⚠️ Funciona pero frágil	DnaRail.tsx:343 usa form.pressureRange (correcto), pero LfxClipInstance.toCognitiveDNA() recalcula pressureRange ignorando el input. Si alguien cambia línea 343 para usar reality.pressureRange, los sliders se rompen.
2. Guardado	✅ OK	Siempre escribe a userData/arsenal/{id}.lfx. No hay ambigüedad de ruta.
3. Resolver	⚠️ Override parcial	Boot-time: user gana sobre builtin (last-write-wins). Pero DynamicEffectRegistry.registerEffectV3:109-112 inyecta {min:0.5, max:1.0} si pressureRange falta — esto puede enmascarcar valores guardados como 0 o sobreescribir ausencias con defaults incorrectos.
Root cause de la desincronización reportada
El DynamicEffectRegistry polyfill (DynamicEffectRegistry.ts:110-112) es el principal sospechoso. Si un clip se guarda con pressureRange: { min: 0.65, max: 1.0 } pero por algún motivo el pressureRange no llega al registry (ej. el clip se carga desde el HephaestusClipIndex que no aplica el polyfill), entonces Selene IA ve { min: 0.5, max: 1.0 } mientras el editor ve { min: 0.65, max: 1.0 }.

Segundo sospechoso: LfxClipInstance.toCognitiveDNA() que siempre recalcula pressureRange basándose en archetype/aggression, ignorando cualquier valor establecido manualmente. Esto significa que si el flujo de guardado pasa por toCognitiveDNA() en algún punto, los valores del slider se pierden.

Recomendación de fix (no ejecutado — solo auditoría):

LfxClipInstance.toCognitiveDNA() debería aceptar un pressureRange override opcional en lugar de siempre recalcularlo.
El polyfill en DynamicEffectRegistry.registerEffectV3:109-112 debería respetar { min: 0, max: 0 } como valor válido (permissive) en lugar de inyectar { min: 0.5, max: 1.0 }.