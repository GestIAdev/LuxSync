 WAVE 5000.V3 — FORENSIC AUDIT REPORT
Arena Candidate Pipeline & Nepotism SQL
1. EL DESCONEXIÓN DEL SIMULADOR (Por qué no compiten las mutaciones)
Flujo exacto de lectura de candidatos en vivo
El EffectDreamSimulator lee los candidatos del DynamicEffectRegistry en tiempo real en cada ciclo de dream. La cadena es:

EffectDreamSimulator.generateCandidates() (@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:630-868) llama a this.getVibeAllowedEffects(state.vibe) (línea 638).
getVibeAllowedEffects() (@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:509-514) ejecuta:


ts
const entries = getDynamicEffectRegistry().getEffectsForVibe(vibe)
if (entries.length > 0) return entries.map(e => e.id)
return []
Esto es una lectura en vivo del registry dinámico — no un array estático.
DecisionMaker.generateDivineStrikeDecision() (@/electron-app/src/core/intelligence/think/DecisionMaker.ts:846-847) también lee del registry en vivo:


ts
const _registryDivine = getDynamicEffectRegistry().getDivineArsenal(vibeId)
const arsenal: string[] = _registryDivine.map(e => e.id)
SeleneTitanConscious (@/electron-app/src/core/intelligence/SeleneTitanConscious.ts:1334) usa this.effectSelector.getAvailableFromArsenal(divineArsenal, pattern.vibeId) para cooldown-check, pero la lista de IDs viene del DynamicEffectRegistry.
Conclusión: ¿Está conectado o desconectado?
El simulador SÍ lee del DynamicEffectRegistry en vivo. No hay array estático del bootloader. El registry es la fuente única de verdad desde WAVE 4824.

PERO — el problema real está en registerEffectV3() (@/electron-app/src/core/arsenal/DynamicEffectRegistry.ts:94-120):



ts
public registerEffectV3(v3: LFXFileV3, options: RegisterOptions = {}): RegistryEntry | null {
    const clip = v3.clip
    if (!clip.cognitiveDNA) {
      // V3 sin DNA: clip Hephaestus puro — invisible para Selene por diseño.
      return null   // ← ← ← GATE KILLER
    }
El bloqueo crítico: registerEffectV3() rechaza cualquier clip que no tenga clip.cognitiveDNA. Los organismos materializados por OrganismMaterializer.materialize() producen un HephAutomationClipV3 que es el resultado de aplicar applyDelta(parentClip, delta) sobre el blueprint ancestral. Si el applyDelta no preserva el campo cognitiveDNA del ancestro, el clip materializado llega sin DNA y registerEffectV3 devuelve null silenciosamente. El organismo nunca entra al registry. El simulador nunca lo ve.

Segundo problema potencial: incluso si el cognitiveDNA se preserva, el clip.id del organismo materializado será el mismo que el del blueprint ancestral (el applyDelta opera sobre el clip del padre). Si el ID colisiona con el blueprint ya registrado, registerEffectV3 hace this._byId.delete(prev) y lo reemplaza — el organismo mutado pisa al ancestro en el registry en lugar de coexistir.

Falta para que funcione:

Verificar que applyDelta() preserva cognitiveDNA en el clip resultante.
Asegurar que el clip.id del organismo materializado sea único (ej. organism_id, no blueprint_id), para que coexista con el ancestro en el registry.
Verificar que dna.compatibleVibes no sea vacío tras la mutación.
2. EL BUG DEL NEPOTISMO SQL (Por qué los hijos cobran sin pelear)
La consulta actual
@/electron-app/src/core/effects/EffectManager.ts:543-546:



sql
SELECT organism_id FROM lfx_organisms
WHERE (organism_id = ? OR blueprint_id = ?) AND status = 'alive'
Parámetros: config.effectType, config.effectType

Análisis matemático del nepotismo
Cuando config.effectType = 'cumbia_moon' (un Blueprint Ancestral base):

organism_id = 'cumbia_moon' → FALSO. Los organismos mutados tienen IDs como org_abc123, no el ID del blueprint. La columna organism_id nunca contiene el blueprint_id.
blueprint_id = 'cumbia_moon' → VERDADERO para TODOS los descendientes vivos de ese blueprint.
Resultado: La consulta devuelve todos los organismos vivos descendientes de cumbia_moon, sin importar cuál fue realmente disparado en la pista. Todos reciben fitness_score += reward, trials_count + 1, passes_count + 1.

Confirmación del bug
Si hay 15 organismos vivos de cumbia_moon y se dispara un efecto con effectType = 'cumbia_moon', los 15 reciben comida metabólica. 14 de ellos no entraron a la pista — no compitieron, no fueron evaluados, pero cobran.

Esto causa:

Inflación de fitness artificial en toda la descendencia.
Degeneración de la selección natural — los organismos no necesitan competir para sobrevivir, solo existir.
trials_count y passes_count inflados — las métricas de supervivencia pierden significado.
Lógica estricta correcta
Debe distinguirse si config.effectType es un Ancestro (blueprint) o una Mutación (organismo):



sql
-- PASO 1: ¿Es un organismo exacto?
SELECT 1 FROM lfx_organisms WHERE organism_id = ? AND status = 'alive'
-- Si existe → es una mutación: alimentar SOLO a ese organismo_id
-- Si NO existe → es un blueprint ancestral: NADIE cobe (el ancestro es granito, no come)
Regla: Solo el organism_id exacto disparado recibe recompensa metabólica. Si el ID no existe en lfx_organisms (porque es un blueprint ancestral), nadie cobra. Los blueprints son granito inmutable — no compiten, no comen.

3. VISIBILIDAD DE LINAJE EN LA UI (Por qué no sabemos quién es el padre)
¿Se envía blueprint_id al frontend?
Sí. El IPC handler genesis:getOrganisms (@/electron-app/src/core/genesis/genesisIpc.ts:82) ejecuta:



sql
SELECT * FROM lfx_organisms
Esto devuelve todas las columnas, incluyendo blueprint_id. El OrganismDTO (línea 31-52) incluye explícitamente blueprint_id: string. El tipo GenesisOrganism en el store (@/electron-app/src/stores/useGenesisStore.ts:14) también lo incluye:



ts
export interface GenesisOrganism {
  organism_id: string
  blueprint_id: string  // ← SÍ está presente
  ...
}
¿Por qué las tarjetas no muestran el ancestro?
@/electron-app/src/components/views/HephaestusView/GenesisLab/LootTray.tsx:76-124:

El card renderiza:

displayName = custom_name ?? rarity_tier-organism_id.slice(0,6) (línea 81)
rarity_tier badge (línea 93)
status, fitness_score, survivalRate, trials_count (líneas 98-112)
generation, species_id (líneas 114-122)
blueprint_id está disponible en el objeto org pero nunca se renderiza. No hay ningún elemento JSX que lo muestre. El usuario ve "epic-abc123" pero no sabe que proviene de "cumbia_moon".

Fix necesario
Añadir una línea en el card que muestre el ancestro, ej:



tsx
<span className="loot-card__ancestor">
  ⚗️ {org.blueprint_id}
</span>
RESUMEN DE HALLAZGOS
#	Hallazgo	Severidad	Estado
1A	El DreamSimulator SÍ lee del DynamicEffectRegistry en vivo	✅ Confirmado	No es la causa
1B	registerEffectV3 rechaza clips sin cognitiveDNA — posible gate killer	CRÍTICO	Requiere verificación de applyDelta
1C	clip.id colisión: organismo mutado puede pisar al ancestro en el registry	ALTO	Requiere ID único por organismo
2	Nepotismo SQL confirmado: WHERE blueprint_id = ? alimenta toda la descendencia	CRÍTICO	Query debe usar solo organism_id = ?
3A	blueprint_id SÍ se envía al frontend	✅ Confirmado	Datos disponibles
3B	LootTray.tsx no renderiza blueprint_id