Genesis Engine — Resumen de Arquitectura
Operadores Genéticos (GeneticOperators.ts — 1728 líneas)
8 operadores + 1 sexual:

#	Operador	Descripción
1	focal_mutation	Desplaza un keyframe individual en un track seleccionado por ADN
2	gene_augmentation	Inyecta un nuevo track estructural con curva guiada por ADN
3	spatial_resonance	Aplica un arquetipo de fase geométrica (Harmony/Chaos/Aggression) a un track no-color
4	proportional_stretch	Estira/comprime el clip por un multiplicador musical (0.25–2.0)
5	macro_splice	Inserta un bloque de 2 keyframes (Stutter/Peak/Breath) en un gap temporal
6	adaptive_pruning	Elimina tracks muertos o keyframes redundantes (con protección de zonas)
7	curve_adaptation	Cambia interpolación de un keyframe basado en ADN (orgánico→bezier, agresivo→hold)
8	crossover	Reproducción sexual: merge dominante/recesivo de tracks + blend de ADN
Infraestructura clave:

applyDelta — Aplicador de JSON Patch (RFC 6902) sobre clips
computeL2DistanceV2 — Distancia composite: 0.55*dCurve + 0.40*dPhase + 0.05*dStructural
FatTailedRng — Distribuciones Cauchy/Pareto para mutaciones de cola pesada
blendCognitiveDNA — Mezcla 70/30 del genoma dominante, uniones de listas, promedio de rangos
applyOperator — Dispatcher único para todos los operadores asexuales
ColiseumService — Orquestador Central
spawnOrganism — Pipeline asexual: ancestor → operador → screening G1-G7 → rarity → DB insert
spawnHybrid — Pipeline sexual: 2 padres → materialize → crossover → screening → rarity → DB insert
spawnInitialCohort — Spawn G1 con probabilidad dinámica según carrying capacity
runEcologicalMaintenance — Pipeline metabólico de 6 pasos:
Flush heatmap logger
Entropy decay (con crowding penalty >80% capacity)
Apoptosis (fitness < 0.10, post-neonatal)
Speciation (K-means)
Lifecycle transitions (champion/demote/cull + HoF)
Mitosis (fitness ≥ 0.85, trials ≥ 5)
Sexual reproduction (fitness ≥ 0.80, trials ≥ 10, Mantis Rule: padres sacrificados)
Base de Datos (selene-genesis.db)
5 tablas + 3 triggers + 2 views:

lfx_blueprints — Ancestros de granito (inmutables via trigger)
lfx_organisms — Organismos vivos (gen ≤ 16, FK a blueprint)
context_heatmaps — Fire events async batched
lineage_tree — Árbol genealógico con ancestor_path
swarm_imports — Importaciones de consolas remotas
Views: v_contextual_candidates, v_hall_of_fame
UI Layer (GenesisLabView.tsx)
Layout: Header + HallOfFame + LootTray (grid filtrable) + LineageInspector (sidebar 300px)
Store: useGenesisStore con acciones fetch/cull/canonize/maintenance/purge
Preview: dispatcha CustomEvent('luxsync:genesis-preview-organism') al shell de HephaestusView