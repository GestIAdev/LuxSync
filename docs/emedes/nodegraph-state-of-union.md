# NodeGraph — State of the Union (Post-Saneamiento)

## Fuente de Verdad

`useForgeGraphStore` (Zustand). El grafo vive en `graph: IForgeNodeGraph` con `nodes: IForgeNode[]` y `edges: IForgeEdge[]`. Toda mutación pasa por actions tipadas: `addNode`, `removeNode`, `moveNode`, `updateNodeConfig`, `updateNodeLabel`, `addEdge`, `removeEdge`, `clearGraph`. El flag `isDirty` marca cambios pendientes de guardado.

## Motor de Renderizado

`@xyflow/react` v12. Estado local dual: `rfNodes`/`rfEdges` (`useState`) derivados del store via `useEffect`. During drag, XYFlow muta solo el estado local; persiste al store en `onNodeDragStop`. Drop de paleta y conexiones escriben al store + estado local simultáneamente. Custom nodes: 5 componentes visuales por categoría (`ForgeInputNode`, `ForgeProcessNode`, `ForgeLogicNode`, `ForgeOutputNode`, `ForgeCompoundNode`). Snap-to-grid `[16,16]`, zoom `0.2–2`, MiniMap + Controls.

## Blindaje de Conexiones

`addEdge` valida: (1) duplicados por ID, (2) **multi-conexión bloqueada** — un puerto de entrada (`targetNode` + `targetPort`) solo acepta un cable. Conexiones inválidas se rechazan con `console.warn`. El evaluador asume 1 input = 1 edge; el store ahora garantiza ese invariant.

## Sistema de Tipos — 23/23 Nodos

Los 23 `ForgeNodeType` tienen interfaz dedicada en la unión `IForgeNodeConfig` (`types.ts`): `input_dmx`, `input_audio_band`, `input_beat`, `input_bpm`, `input_energy`, `input_constant`, `input_time`, `proc_lfo`, `proc_smooth`, `proc_map_range`, `proc_math`, `proc_clamp`, `proc_delay`, `proc_merge`, `proc_curve`, `proc_invert`, `logic_threshold`, `logic_gate`, `logic_switch`, `logic_and`, `logic_or`, `logic_counter`, `output_dmx`, `compound_ingenio`.

**Factories:** 23/23 entradas en `FORGE_PALETTE` con config tipada correcta. **Previews:** `buildConfigPreview` cubre los 23 tipos con texto descriptivo en el canvas. **Inspector:** 21/23 tipos con panel (17 dedicados + 4 fallback con warning). `proc_invert`, `logic_and`, `logic_or` usan fallback genérico (sin campos configurables).
