Script sync-factory-effects.ts — verificado y listo
El script ya existía (scripts/sync-factory-effects.ts, WAVE 7726) pero tenía 2 bugs que impedían usarlo:

Bug 1 — Path incorrecto (FIXED)
Buscaba en %APPDATA%\LuxSync\ (productName) pero Electron usa %APPDATA%\luxsync-electron\ (name). El script habría fallado con "User arsenal directory not found". Corregido: pkg.name primero.

Bug 2 — Custom/ no filtrado (FIXED)
Sincronizaba efectos de custom/ (heph_*, user-created) a builtins/custom/. Ahora custom/ se excluye por defecto. Flag --include-custom para incluirlos.

Estado verificado
Concepto	Valor
.lfx en builtins (repo)	46 (42 en manifest + 4 en custom/)
.lfx en userdata	48 (44 factory + 4 custom)
Efectos con match	41 factory + 1 user-only (efecto_base)
Manifest actual	42 entradas, 1 stale (divine_obliteration — nuestro fix WAVE 7755)
Checksum del script	sha256:SHA-256(JSON.stringify(clip)) — coincide con LfxFileLoader.computeLfxChecksum()
Manifest checksum	SHA-256 raw bytes, first 16 chars — coincide con generate-arsenal-manifest.ts
Cómo usarlo


bash
# Preview (sin escribir nada)
npm run sync-effects -- --dry-run
 
# Ejecutar (sobreescribe builtins + reconstruye manifest.json)
npm run sync-effects
 
# Incluir custom/ también
npm run sync-effects -- --include-custom
El script hace:

Lee cada .lfx de %APPDATA%\luxsync-electron\arsenal\
Lo matchea con un builtin por clip.id
Sanea author → "LuxSync Factory"
Recalcula checksum = sha256:SHA-256(JSON.stringify(clip))
Escribe el .lfx saneado al builtin path
Reconstruye manifest.json con checksums actualizados

***********EJECUTADO !

------------------------------------

KINETIC BLACKLIST — exclusión total
KINETIC_SECURE_PARAMS (que solo suavizaba Cauchy en pan/tilt) → KINETIC_BLACKLIST (exclusión absoluta de pan, tilt, rot_x, rot_y).

Filtrado en 6 operadores:

Operador	Antes	Ahora
focal_mutation	Cauchy suave en pan/tilt	Excluidos del pool + targetParamIds sin pan/tilt
gene_augmentation	pan/tilt en AUGMENTABLE_PARAMS	Removidos (18→16 params)
macro_splice	Cauchy suave en pan/tilt	Excluidos del pool de gaps
spatial_resonance	Phase mutations en pan/tilt	Excluidos del target
crossover	Recombinación de pan/tilt (salto 170°)	Excluidos — herencia completa del dominante
adaptive_pruning	—	Sin cambios (solo elimina flat tracks)
El movimiento sigue siendo 100% humano. Un champion con un color raro se desactiva desde la UI; un champion con un pan que lanza un láser al público ya no puede existir.

-----------------------------------------------

Bug A — Ruleta Ciega (FIXED)
pickWeightedOperator no normalizaba los pesos. Total = 1.08, pero rng() devuelve [0, 1). El último operador (color_hue_shift, peso 0.08) empezaba en acc=1.00 — inalcanzable. El operador de evolución de paleta de color nunca se disparaba. Fix: r = rng() * totalWeight.

Bug B — Mantis Estéril (FIXED)
_mitosis() filtraba status = 'alive', excluyendo champions. Los organismos más aptos no podían reproducirse asexualmente. La reproducción sexual SÍ los incluía, pero con el bug anterior (WAVE 7755) los champions no recibían trials. Ahora ambos paths incluyen champions. Fix: status IN ('alive', 'champion').

Bug C — evaluateFireEvent es dead code (DOCUMENTADO)
La ecuación de fitness completa (EMA + contexto 6D + decaimiento temporal γ^Δt_días) está definida en FitnessEvaluator.ts pero nunca es llamada. El fitness real es acumulación lineal +0.05 * intensity por disparo. No hay EMA, no hay olvido por inactividad, no hay coherencia contextual. Conectarlo requiere rediseñar el loop de reward del EffectManager — documentado como deuda arquitectónica.

Bug D — Operadores "light" (by design, agravado)
Con chaos < 0.5, los operadores solo hacen 1 mutación por llamada. La magnitud Cauchy mediana es 0.15·span. Esto es el equilibrio puntuado por diseño, pero combinado con los bugs A+B+C, el ecosistema evoluciona muy lentamente. Con los fixes aplicados, debería acelerarse: más operadores disponibles (color_hue_shift), más reproducción (champions en mitosis), más trials (champions en EffectManager).

-------------------------------------------------------

Commit cfdb9da5 creado. Resumen:

¿Funciona la Mantis?
SÍ, ahora. El flujo end-to-end con los 3 commits acumulados:

WAVE 7755 — Champions reciben trials del EffectManager
WAVE 7756 — Mitosis incluye champions + ruleta normalizada
WAVE 7757 — Operadores caóticos + 18 params disponibles


Champion (fitness ≥ 0.80, trials ≥ 10)
  → _sexualReproduction() empareja por especie
  → spawnHybrid() → crossover() → prenatalScreening()
  → INSERT híbrido + CULL ambos padres (MANTIS)
4 Fixes de caos
Fix C — 18 params en vez de 6
AUGMENTABLE_PARAMS expandido de 6 → 18. Antes, si el blueprint ya tenía los 6 básicos, el operador añadía duplicados en zonas complementarias. Ahora puede inyectar gobo1, gobo2, prism, focus, iris, white, amber, speed, direction, width, rot_x, rot_y, smoke_density, fan_speed — innovación estructural real.

Fix D — focal_mutation caótico
Pleiotropy: 2-6 mutaciones (was 1-3)
Cauchy: scale=0.25, maxAbs=0.80 (was 0.15/0.60)
Mediana de shift: 0.25·span (was 0.15) — visible, no imperceptible
Kinetic Security preservado: pan/tilt siguen con uniforme conservador
Fix E — curve_adaptation no más no-op
Antes: 1 keyframe, 1 track. Si ya tenía la interp del DNA → l2Distance=0 (desperdiciado)
Ahora: 2-4 tracks, 1-3 keyframes cada uno. Si la interp ya coincide → FORCE cambio a una alternativa. Nunca es no-op.
Fix F — gene_augmentation más keyframes
Min 3 keyframes (was 2), max 12 (was 8)
macro_splice: 2-5 splices (was 1-3)
color_hue_shift: 2-6 mutaciones (was 1-3)
Typecheck: exit 0, sin regresiones.

------------------------------------------------

