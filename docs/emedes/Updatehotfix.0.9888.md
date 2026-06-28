Actualizacion Modal V3 :

NewClipModal actualizado a V3. tsc --noEmit: 0 errores.

Cambios realizados en NewClipModal.tsx:
Zonas estandarizadas:

State interno cambiado de EffectZone[] → ZoneTarget[] (alineado con el tipo canónico V3).
SmartZoneSelector sigue usando EffectZone internamente, pero el modal hace el cast en la frontera (zones as EffectZone[] / z as ZoneTarget[]).
"ROUTING" → "MIX BUS":

El label heredado de Chronos V1 fue reemplazado por "MIX BUS", el término V3 correcto.
Campos V3 añadidos al clip:

cognitiveDNA: inicializado con defaults completos (genome, textureAffinity, energyZone, aggressionRange, spatialBehavior).
simulationMeta: inicializado con defaults (beautyWeights, gpuCost, fatigueImpact, zScoreGuards).
effectType: 'heph_custom' → 'custom' (alineado con el store default).
Campos V3 añadidos por track:

dimmerScale: 1 (default explícito).
blendMode: mapado por paramId — 'max' para intensity/strobe/white, 'replace' para el resto.
phaseConfig: inicializado con DEFAULT_PHASE_CONFIG_PRO (spreadDeg: 0, symmetry: 'linear', wings: 1, blocks: 1, shuffle: 0, shuffleSeed: 1, direction: 1).
Bug fix — color range:

createDefaultCurve ahora usa range: [0, 360] para color (antes [0, 1]). Coincide con lo que _normalizeClipCurves espera en HephaestusClipIndex.ts.

center (⚡ Strobes/Blinders) — ya estaba presente como tile CTR con StrobeIcon. Tu intuición era correcta.
ambient (🌫️ House lights) — añadido al POSITION_TILES como tile AMB con SmokeIcon.
El SmartZoneSelector ahora muestra los 5 CanonicalZone espaciales: FRT, BCK, FLR, CTR, AMB — más los 3 tiles de target (ALL, MOV, PAR, AIR) y los 4 modifiers (L, R, ODD, EVN). Cobre total de las 9 CanonicalZone válidas (excluyendo unassigned que no tiene sentido como target intencional).


-------------------------------------------

AMPUTACION DE DDOS WAVE 7031 completada. tsc --noEmit: 0 errores.

Cambios realizados:
1. Nuevo archivo — useHephLibrary.ts:

Cache singleton a nivel módulo (_clipCache, _loadedClips, _isLoading) que sobrevive a unmount/remount.
Pub/sub interno con _listeners para sincronizar todas las instancias del hook.
loadLibrary(): carga completa (heph:list + heph:load por clip no cacheado). Deduplicada con guard _isLoading.
refreshMetadata(): solo heph:list — sin heph:load. Para usar tras Save/Create/Delete.
getCachedClip(filePath): lookup O(1) para D&D.
Auto-load en primer montaje (_hasInitialized guard).
2. ForgeTab.tsx — amputación:

Eliminados: LibraryClip interface, library state, isLoadingLibrary state, clipCacheRef, loadLibrary function, useEffect de montaje.
Reemplazado por: const { loadedClips: library, isLoading: isLoadingLibrary, refreshMetadata, getCachedClip } = useHephLibrary().
handleDelete ahora usa refreshMetadata() en lugar de loadLibrary().
handleDragStart usa getCachedClip() en lugar de clipCacheRef.current.get().
3. index.tsx — amputación:

Eliminados: LibraryClip interface, library state, isLoadingLibrary state, clipCacheRef, loadLibrary function, useEffect de montaje.
Reemplazado por: const { refreshMetadata } = useHephLibrary().
handleSave, handleSaveAs, handleDelete, handleCreateClip ahora llaman refreshMetadata() en lugar de loadLibrary().
Impacto: El DDoS ×4 se elimina. Una sola llamada heph:list + heph:load al boot (sin importar cuántos componentes se monten). Save/Create/Delete solo refrescan metadata (1 heph:list), sin re-precachear clips.

-----------------------------------------------

BUG CE CARGA Y DELETE EN LA LIBRERIA

Causa raíz y fix
El bug: HephFileIO.saveClip() escribe a userData/effects/{id}.lfx, pero en el boot del Arsenal (@/electron-app/electron/main.ts:561) solo se escaneaban las subcarpetas de src/core/arsenal/builtins/. El directorio userData/effects/ nunca se pasaba a LfxFileLoader.loadAll().

Por eso:

Al guardar → saveClip hace index.upsert() → el clip entra en memoria → heph:list lo devuelve → aparece ✅
Al recargar → nuevo proceso, índice vacío → solo se cargan builtins → heph:list no devuelve los user clips → desaparecen ❌
El fix (@/electron-app/electron/main.ts:581-585): Añadido userData/effects/ como un DirectorySpec con source: 'user' al array _vibeDirectories antes de llamar loadAll(). Ahora el boot ingesta tanto builtins como clips del usuario al HephaestusClipIndex.


Causa raíz y fix
El bug: HephFileIO.deleteClip() borraba el archivo .lfx del disco con fs.unlink() pero nunca eliminaba la entrada del HephaestusClipIndex en memoria. Como heph:list lee del índice (index.getAllMetadata()), el clip seguía apareciendo tras el refreshMetadata().

Fix (@/electron-app/src/core/hephaestus/HephFileIO.ts:265-272): Después del unlink, se llama a index.remove() para purgar la entrada stale del índice:

Si se pasó un path absoluto → index.getByPath() para obtener el ID, luego index.remove(id)
Si se pasó un clip ID → index.remove(idOrPath) directo

-----------------------------------------------

AJUSTES VISUALES Y DE DISEÑO . FILTROS DE LA LIBRERIA

Filtros de librería (WAVE 7034)
Añadidos 5 botones de filtro entre el título "📚 LIBRARY" y la barra de búsqueda:

⚡ Physical — dimmer/strobe
🎨 Color — color/saturación
🕹️ Movement — pan/tilt
🔍 Optics — zoom/focus/gobo/prism
🧩 Composite — multi-parámetro
Comportamiento:

Click en un icono → toggle del filtro (puedes seleccionar varios)
Los clips se filtran por item.category en el filteredLibrary memo
Botón ✕ para limpiar todos los filtros
Los iconos inactivos están a 40% opacidad; los activos brillan con el naranja LuxSync
Compatible con la búsqueda por texto (se combinan ambos filtros)
Archivos modificados:

@/electron-app/src/components/views/HephaestusView/tabs/ForgeTab.tsx — LIBRARY_FILTERS constant, activeFilters state, handleFilterToggle, filteredLibrary actualizado, JSX de los botones
@/electron-app/src/components/views/HephaestusView/HephaestusView.css — estilos .heph-library__filters, .heph-library__filter-btn, .heph-library__filter-btn--active, .heph-library__filter-clear


------------------------------------------------------

AJUSTES DE DISEÑO y CSS II :

Resumen
Unificados todos los fondos al mismo color #0a0a0f (casi negro) para eliminar el contraste de "parches":

CSS (HephaestusView.css):

.heph-view → #0a0a0f hardcodeado (antes var(--bg-deepest, #0a0a0f))
.heph-library → transparent (antes rgba(0, 0, 0, 0.4))
.heph-library__search → transparent (antes rgba(0, 0, 0, 0.3))
.heph-param-sidebar → transparent (antes rgba(0, 0, 0, 0.3))
Inline styles (index.tsx):

.heph-global-bar → transparent (antes rgba(17, 17, 17, 0.75))
.heph-tab-rail → rgba(255, 255, 255, 0.03) (antes #1a1a1a)
Inline styles (ForgeTab.tsx):

.heph-forge-topbar → transparent (antes #141414)
Borders #262626 → rgba(255, 107, 43, 0.1) (consistente con el resto)
Inline styles (LabTab.tsx):

.heph-lab-workspace → transparent (antes #0d0d0d)
Borders #1c1c1c → rgba(255, 107, 43, 0.1)
Todo el layout ahora se ve como una unidad homogénea fusionada sobre #0a0a0f, con los bordes sutiles naranja como separadores visuales en vez de contrastes de fondo.

------------------------------------------------------

DISEÑO Y CSS III : ICONOS GENERICOS PURGADOS


Resumen
Sustituidos todos los emojis/iconos genéricos por LuxIcons SVG custom en la librería y el Phase Engine:

ForgeTab (ForgeTab.tsx):

Título LIBRARY: 📚 → <ScenesIcon> (claqueta SVG)
Filtros de categoría: ⚡🎨🕹️🔍🧩 → <IntensityIcon>, <ColorIcon>, <PositionIcon>, <FocusIcon>, <BeamIcon> — con color naranja activo / blanco-gris inactivo
Iconos de categoría (headers + items): emojis de getCategoryIcon() → getLuxCategoryIcon() con mapper CATEGORY_ICON_MAP a los mismos SVGs
Botón delete: 🗑️ → <TrashIcon> SVG
LabTab (LabTab.tsx):

Título PHASE DISTRIBUTION ENGINE: emoji 🌊 + color cyan #64c8ff → <WaveformIcon> SVG + color naranja LuxSync rgba(255, 107, 43, 0.6)
Sin tocar (como pediste): DnaRail, barras de herramientas, ParameterLane — esos ya usaban SVGs propios o no tenían iconos genéricos.

La estrategia fue crear un CATEGORY_ICON_MAP que mapea EffectCategory → componente LuxIcon, reutilizable en cualquier sitio que necesite iconos por categoría sin ir uno por uno.

-------------------------------------------------------

REDISEÑO de PhaseControls.tsx

Rediseñados los 4 paneles del Phase Distribution Engine con estilo glassmorphism + neon cyberpunk:

Glassmorphism:

Fondo semi-transparente rgba(255, 255, 255, 0.025) con backdropFilter: blur(8px) — efecto vidrio esmerilado
Bordes sutiles rgba(255, 255, 255, 0.06) con borderRadius: 8px
Dividers con gradiente linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)
Neon por panel (constante NEON):

Wave Shaper → naranja #ff6b2b — glow 0 0 20px rgba(255, 107, 43, 0.08)
Block Matrix → cyan #00e5ff — glow 0 0 20px rgba(0, 229, 255, 0.08)
Chaos Engine → rojo #ff1744 — glow 0 0 20px rgba(255, 23, 68, 0.08)
Spatial Behavior → verde #00e676 — glow 0 0 20px rgba(0, 230, 118, 0.08)
Títulos con textShadow: 0 0 12px currentColor — efecto neon brillante
Botones activos con boxShadow doble (outer glow + inset glow)
Inputs numéricos con boxShadow: inset 0 0 8px del color del panel
Sliders, valores y badges todos con glow neon del color correspondiente
Full height (hueco vacío eliminado):

Contenedor: flex: 1, height: 100% + gap: 10px
moduleBase: flex: 1, display: flex, flexDirection: column — cada panel se expande verticalmente para llenar el espacio disponible

------------------------------------------------------

AUDITORIA DE ESTADO DEL GUARDADO v3

Auditoría: Serialización .lfx vs Estructura V3
Veredicto: CONFIRMADO — el guardado respeta la estructura V3 con 2 issues menores
Flujo de guardado auditado


UI (index.tsx)
  → serializeHephClip(clip)        ← Limpia el clip a JSON-ready
  → IPC heph:save(serialized)
  → HephFileIO.saveClip(clip)
  → JSON.stringify(filePayload)
  → fs.writeFile()
  → HephaestusClipIndex.upsert()   ← Re-valida al cargar
Campos V3 — Tabla de cumplimiento
Nivel Clip (HephAutomationClipV3)
Campo	¿Serializado?	Notas
id	✅	clip.id directo
name	✅	clip.name directo
author	✅	clip.author directo
category	✅	clip.category directo
tags	✅	[...clip.tags] con fallback []
vibeCompat	✅	[...clip.vibeCompat] con fallback []
spatialZones	✅	[...clip.spatialZones] con fallback []
mixBus	✅	clip.mixBus directo
priority	✅	clip.priority directo
durationMs	✅	clip.durationMs directo
effectType	✅	clip.effectType directo
tracks	✅	Deep clone track por track
staticParams	✅	JSON.parse(JSON.stringify(...)) deep clone
cognitiveDNA	✅	JSON.parse(JSON.stringify(...)) deep clone
simulationMeta	✅	JSON.parse(JSON.stringify(...)) deep clone
schemaVersion	✅	Hardcoded '3.0'
Nivel Track (HephTrack)
Campo	¿Serializado?	Notas
id	✅	Directo
paramId	✅	Directo
zones	✅	[...track.zones]
curve	✅	Deep clone completo
dimmerScale	✅	Directo (opcional)
colorOverride	✅	{ ...track.colorOverride } shallow (OK, HSL es plano)
blendMode	✅	Directo (opcional)
cell	✅	Directo (opcional, reservado)
selector	✅	JSON.parse(JSON.stringify(...)) deep clone
phaseConfig	⚠️	{ ...track.phaseConfig } — shallow copy
Nivel Curve (HephCurve)
Campo	¿Serializado?	Notas
paramId	✅	Directo
valueType	✅	Directo
range	✅	[...range] con validación + fallback
defaultValue	✅	HSL shallow copy si objeto, directo si number
keyframes	✅	Map completo
mode	✅	?? 'absolute' fallback
Nivel Keyframe (HephKeyframe)
Campo	¿Serializado?	Notas
timeMs	✅	Directo
value	✅	HSL shallow copy si objeto, directo si number
interpolation	✅	Directo
bezierHandles	✅	[...handles] si presente
audioBinding	✅	Deep clone con source, inputRange, outputRange, smoothing
Issues encontrados
Issue 1: phaseConfig shallow copy — Riesgo BAJO
@/electron-app/src/core/hephaestus/types.ts:587



ts
phaseConfig: track.phaseConfig ? { ...track.phaseConfig } : undefined,
PhaseConfigPro tiene 7 campos todos primitivos (number, string, 1 | -1). Shallow copy { ... } es suficiente — no hay objetos anidados. No es un bug, pero es inconsistente con el tratamiento de selector que usa JSON.parse(JSON.stringify(...)).

Issue 2: $schema mismatch entre constantes y escritura — Cosmético
@/electron-app/src/core/hephaestus/HephFileIO.ts:37 define SCHEMA_VERSION = 'hephaestus/v1' pero saveClip() @ línea 162 escribe $schema: 'luxsync.lfx/3.0' (hardcoded inline). La constante SCHEMA_VERSION no se usa en saveClip. El valor escrito ('luxsync.lfx/3.0') es correcto y coincide con lo que espera HephaestusClipIndex.upsert() @ línea 158. Las constantes son dead code confuso pero no causan bugs.

Issue 3: checksum vacío — By design (temporal)
@/electron-app/src/core/hephaestus/HephFileIO.ts:165 escribe checksum: ''. El LfxFileLoader._parseAndValidateV3 tiene el gate G2 bypassed (WAVE 5020.5). Los user clips no necesitan checksum. Esto es correcto para desarrollo.

Validación de round-trip
El flujo de carga (HephaestusClipIndex.upsert) re-valida:

✅ $schema === 'luxsync.lfx/3.0' — coincide con lo que escribe saveClip
✅ tracks[] no vacío, cada track con curve.keyframes[] y zones[]
✅ _normalizeClipCurves() rellena range y mode si faltan (defensivo)
✅ tags, vibeCompat, spatialZones se normalizan a [] si faltan
El LfxFileLoader._parseAndValidateV3 valida adicionalmente:

✅ Campos mínimos: id, name, author, category, tags, vibeCompat, durationMs, effectType
✅ cognitiveDNA.genome con aggression, chaos, organicity ∈ [0,1]
✅ compatibleVibes no vacío, textureAffinity válido
✅ USER policy: aggression ≤ 0.95
Conclusión
El código de guardado respeta estrictamente la estructura V3. Todos los campos de HephAutomationClipV3, HephTrack, HephCurve, HephKeyframe y HephAudioBinding se serializan correctamente. El round-trip save→load está validado por dos capas (HephaestusClipIndex + LfxFileLoader).

Los 2 issues encontrados son no-bloqueantes:

phaseConfig shallow copy es segura porque PhaseConfigPro es plano (primitivos únicamente)
Las constantes dead code (SCHEMA_VERSION, FORMAT_VERSION) no afectan el output

-------------------------------------------------------

ARREGLO DE HOT RELOAD PARA SELENE IA y su ARSENAL + EXPLICACION DEL CAP a 0.95 aggression

Qué se hizo (WAVE 7034)
Archivo modificado: @HephIPCHandlers.ts

Save (heph:save): Después de hephFileIO.saveClip(), llama a _lfxLoader.loadFile(filePath, 'user') que reutiliza todo el pipeline de validación de LfxFileLoader → HephaestusClipIndex.upsert() + DynamicEffectRegistry.registerEffectV3(). Si el clip tiene cognitiveDNA, Selene lo ve instantáneamente sin reiniciar. Si no tiene DNA, registerEffectV3 retorna null silenciosamente (by design).

Delete (heph:delete): Antes de borrar, resuelve el clip ID desde el HephaestusClipIndex. Después de borrar de disco, llama a getDynamicEffectRegistry().unregisterEffect(clipId) para que Selene deje de verlo instantáneamente.

Explicación del cap aggression ≤ 0.95
@/electron-app/src/core/arsenal/LfxFileLoader.ts:60-63:



ts
const USER_SAFETY_POLICY = Object.freeze({
  MAX_AGGRESSION: 0.95,
  MAX_STROBE_HZ: 25,
})
El cognitiveDNA.genome tiene 3 valores ∈ [0, 1]: aggression, chaos, organicity. Aggression describe qué tan "nuclear" es un efecto — valores altos significan que Selene lo reserva para drops/clímax y lo bloquea en buildups.

El cap funciona así:

Builtins (source: 'builtin'): Sin límite. Los efectos factory pueden tener aggression = 1.0 (ej: core_meltdown es un divine drop puro).
User (source: 'user'): aggression ≤ 0.95. Si un usuario crea un clip con aggression > 0.95, el LfxFileLoader._parseAndValidateV3() lo rechaza con un warning y no entra al arsenal.
¿Por qué 0.95 y no 1.0? Es un guardrail de seguridad para contenido de comunidad. Un efecto con aggression = 1.0 es un "divine candidate" que Selene dispara en el clímax máximo (z-score épico + peak section). Permitir que clips de usuario arbitrarios tengan aggression 1.0 significaría que un clip mal diseñado podría colarse en el pool divino y dispararse en el momento más intenso de una sesión, con resultados potencialmente caóticos. El 0.95 deja un 5% de margen para que los divines factory mantengan supremacía.

¿Cuándo se aplica? Solo en carga (_parseAndValidateV3, línea 386). Tu clip de Hephaestus se guarda igual al disco con aggression = 1.0 si lo defines así — pero al intentar registrarse en el arsenal con source: 'user', el gate lo rechaza. El clip sigue existiendo en HephaestusClipIndex (visible para la UI de Hephaestus y el timeline), pero no entra al DynamicEffectRegistry y por tanto Selene no lo ve.

---------------------------------------------------------------------

