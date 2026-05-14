/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧠 CELL ROUTING — WAVE 4734 BATCH 1
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Registro declarativo `NodeFamily → SectionMeta`. Sustituye el `switch`
 * gigante del antiguo `TheProgrammer.tsx:386-401` por un mapa frozen que
 * el futuro <CellRouter> consume sin condicionales hardcoded.
 *
 * ⚠️ BATCH 1 SCOPE: este archivo SOLO declara metadatos y predicados puros.
 *   - Cero JSX, cero imports de React components.
 *   - Cero CSS.
 *   - Los componentes reales se enchufan en BATCH 2 vía `componentKey`.
 *
 * REGLA ATMOSPHERE / EXTRAS:
 *   La familia ATMOSPHERE rutea al `componentKey: 'extras'`. Su `canRender`
 *   devuelve `false` deliberadamente — el <CellRouter> NO la pintará como
 *   acordeón autónomo; el <ExtrasAggregator> (Batch 2/3) las recoge por
 *   separado escaneando `groups.filter(g => g.family === ATMOSPHERE)`.
 *   Así "ATMOSPHERE" y los canales phantom orfanos comparten la misma
 *   "lógica de cajón desastre".
 *
 * @module components/hyperion/controls/cellRouting
 * @version WAVE 4734-A
 */

import {
  NodeFamily,
  type AggregatedCellGroup,
  type CellOverride,
} from '../../../stores/programmer-types'

// ─────────────────────────────────────────────────────────────────────────────
// SECTION COMPONENT KEYS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identificador estable del componente que renderiza una familia de células.
 *
 * Discriminated union — el <CellRouter> (BATCH 2) hará el `switch` sobre estos
 * literales en un solo lugar, importando lazy los `*SectionBody` reales.
 *
 * `'extras'` es el destino compartido de ATMOSPHERE + orphan phantoms.
 */
export type SectionComponentKey =
  | 'intensity'
  | 'color'
  | 'beam'
  | 'kinetic'
  | 'extras'

// ─────────────────────────────────────────────────────────────────────────────
// SECTION META — Contrato declarativo por familia
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Predicado de gating. Decide si una cell tiene sustancia suficiente para
 * pintarse como acordeón autónomo.
 *
 * El <CellRouter> lo invoca por cada `AggregatedCellGroup` ANTES de montar
 * el componente. Si retorna `false`, la cell se omite del árbol React
 * (ahorra DOM y evita acordeones vacíos / fantasma — bug F1 del blueprint).
 *
 * @param group El grupo agregado del hook `useAggregatedCapabilityCells`.
 * @param override El override actual de la primera cellKey del grupo (o `undefined`).
 *                 La Hive Mind garantiza que todas las cellKeys del grupo
 *                 comparten payload, así que basta con consultar la primera.
 */
export type CellGatePredicate = (
  group: AggregatedCellGroup,
  override: CellOverride | undefined,
) => boolean

/**
 * Metadatos por familia. Inmutable.
 *
 * NOTA BATCH 1: NO incluye `Body` ni `Icon` React components — eso entra en
 * BATCH 2 cuando refactoricemos las `*Section` en `*Body` + `*Contract`.
 * Por ahora `componentKey` apunta al string id que el router resolverá.
 */
export interface SectionMeta {
  /** Familia Aether que esta entrada sirve. Coincide con la key del mapa. */
  readonly family: NodeFamily
  /** Título canónico del header (`'INTENSITY'`, `'COLOR'`, …). */
  readonly title: string
  /** Identificador estable del componente a montar. Resuelto por el router. */
  readonly componentKey: SectionComponentKey
  /** Color neon por defecto si el role no aporta uno conocido. */
  readonly defaultNeon: string
  /** Predicado de gating — devuelve `true` si la cell debe pintarse. */
  readonly canRender: CellGatePredicate
  /**
   * `true` si la familia se delega al <ExtrasAggregator>. El router NO debe
   * intentar montar un acordeón autónomo aunque `canRender` retornase `true`.
   * Defensa redundante contra bypass: `canRender` ya devuelve `false`.
   */
  readonly delegatedToExtras: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// GATING PREDICATES — extraídos para reuso y testing
// ─────────────────────────────────────────────────────────────────────────────

/** Tipo helper: la forma de `override.payload` con discriminación por family. */
type OverridePayloadOf<F extends NodeFamily> = Extract<
  NonNullable<CellOverride>['payload'],
  { family: F }
>

/**
 * Gating IMPACT y COLOR: siempre que el grupo tenga al menos una cellKey.
 *
 * Permitir manual desde 0 es un caso válido (el operador puede subir el
 * slider DESDE el cero), así que no exigimos `data` no vacío.
 */
const alwaysRenderIfAnyCell: CellGatePredicate = (group) =>
  group.cellKeys.length > 0

/**
 * Gating KINETIC — anti-fantasma (bug F1 del blueprint).
 *
 * KineticBody SOLO controla 'rotation'. Pan/tilt/speed pertenecen al
 * KineticsCathedral. Por tanto la cell solo se pinta si:
 *   (a) el role es 'rotor' O 'percussion' (rotación continua — isContinuous=true
 *       en el pipeline asigna 'percussion'; 'rotor' era el nombre legacy), o
 *   (b) hay override 'rotation' activo.
 *
 * 'primary' (pan/tilt) queda EXCLUIDO → no genera acordeón vacío en CONTROLS.
 *
 * WAVE 4737: 'percussion' añadido porque NodeExtractionPipeline asigna ese
 * role a todos los nodos de rotación continua (isContinuous = !hasPanTilt && hasRotation).
 */
const renderKineticIfContinuous: CellGatePredicate = (group, override) => {
  if (group.cellKeys.length === 0) return false
  // 'rotor' (legacy suffix) y 'percussion' (pipeline continuo) → mostrar
  if (group.role === 'rotor' || group.role === 'percussion') return true
  if (override?.payload.family === NodeFamily.KINETIC) {
    const data = (override.payload as OverridePayloadOf<NodeFamily.KINETIC>).data as {
      rotation?: number
    }
    if (data.rotation !== undefined) return true
  }
  return false
}

/**
 * Gating BEAM — solo si hay óptica activa o el role lo declara explícitamente.
 *
 * Una cell COLOR + dimmer interno no debe disparar BeamSection. Las cells
 * BEAM válidas tienen role ∈ {beam, decoration} O ya tienen un override
 * activo en alguno de sus canales ópticos.
 */
const renderBeamOnlyIfOptical: CellGatePredicate = (group, override) => {
  if (group.cellKeys.length === 0) return false
  if (group.role === 'beam' || group.role === 'decoration') return true
  if (override?.payload.family === NodeFamily.BEAM) {
    const data = (override.payload as OverridePayloadOf<NodeFamily.BEAM>).data as {
      gobo?: number
      prism?: number
      focus?: number
      zoom?: number
      iris?: number
    }
    if (
      data.gobo !== undefined ||
      data.prism !== undefined ||
      data.focus !== undefined ||
      data.zoom !== undefined ||
      data.iris !== undefined
    ) {
      return true
    }
  }
  return false
}

/**
 * Gating ATMOSPHERE — siempre `false`.
 *
 * La familia se delega al <ExtrasAggregator>. El router NO la pinta como
 * acordeón individual; el aggregator escanea `groups.filter(family === ATMOSPHERE)`
 * por su cuenta y las fusiona con orphan phantoms en un único cajón.
 */
const neverRenderAtmosphere: CellGatePredicate = () => false

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY — Mapa frozen NodeFamily → SectionMeta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single source of truth de la decisión "qué componente / título / gating
 * aplica a cada familia". Frozen para que el árbol React nunca lo mute.
 *
 * Para añadir una familia nueva (ej. `LASER`):
 *   1. Añadir el enum en `NodeFamily`.
 *   2. Añadir su entry aquí.
 *   3. Crear el `LaserSectionBody` y enchufarlo en el router (BATCH 2).
 *
 * No hace falta tocar `TheProgrammer.tsx`.
 */
export const SECTION_REGISTRY: Readonly<Record<NodeFamily, SectionMeta>> = Object.freeze({
  [NodeFamily.IMPACT]: Object.freeze({
    family:            NodeFamily.IMPACT,
    title:             'INTENSITY',
    componentKey:      'intensity',
    defaultNeon:       '#ff3366',
    canRender:         alwaysRenderIfAnyCell,
    delegatedToExtras: false,
  }),
  [NodeFamily.COLOR]: Object.freeze({
    family:            NodeFamily.COLOR,
    title:             'COLOR',
    componentKey:      'color',
    defaultNeon:       '#36d1ff',
    canRender:         alwaysRenderIfAnyCell,
    delegatedToExtras: false,
  }),
  [NodeFamily.BEAM]: Object.freeze({
    family:            NodeFamily.BEAM,
    title:             'BEAM',
    componentKey:      'beam',
    defaultNeon:       '#facc15',
    canRender:         renderBeamOnlyIfOptical,
    delegatedToExtras: false,
  }),
  [NodeFamily.KINETIC]: Object.freeze({
    family:            NodeFamily.KINETIC,
    title:             'ROTATION',
    componentKey:      'kinetic',
    defaultNeon:       '#22c55e',
    canRender:         renderKineticIfContinuous,
    delegatedToExtras: false,
  }),
  [NodeFamily.ATMOSPHERE]: Object.freeze({
    family:            NodeFamily.ATMOSPHERE,
    title:             'EXTRAS',
    componentKey:      'extras',
    defaultNeon:       '#8b5cf6',
    canRender:         neverRenderAtmosphere,
    delegatedToExtras: true,
  }),
})

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — utilidades sobre el registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolución segura del meta para una familia. Retorna `undefined` si la
 * familia no está registrada (futuras familias que aún no tienen componente).
 *
 * El router debe tratar `undefined` como "skip silencioso" — nunca crashear.
 */
export function getSectionMeta(family: NodeFamily): SectionMeta | undefined {
  return SECTION_REGISTRY[family]
}

/**
 * Particiona los grupos en:
 *   - `routable`: grupos que el <CellRouter> debe pintar como acordeón propio.
 *   - `extras`:   grupos delegados al <ExtrasAggregator>.
 *   - `skipped`:  grupos que el gating descartó (anti-fantasma).
 *
 * Cada grupo va a EXACTAMENTE una de las tres listas. La unión es la entrada.
 *
 * Pensado para que el router lo invoque UNA vez por render y reparta:
 *
 * ```ts
 * const { routable, extras } = partitionGroupsForRouting(groups, overrides)
 * return <>
 *   {routable.map(g => <CellAccordion ... />)}
 *   <ExtrasAggregator atmosphereGroups={extras} />
 * </>
 * ```
 */
export interface PartitionedGroups {
  readonly routable: readonly AggregatedCellGroup[]
  readonly extras:   readonly AggregatedCellGroup[]
  readonly skipped:  readonly AggregatedCellGroup[]
}

export function partitionGroupsForRouting(
  groups: readonly AggregatedCellGroup[],
  resolveOverride: (group: AggregatedCellGroup) => CellOverride | undefined,
): PartitionedGroups {
  const routable: AggregatedCellGroup[] = []
  const extras:   AggregatedCellGroup[] = []
  const skipped:  AggregatedCellGroup[] = []

  for (const group of groups) {
    const meta = SECTION_REGISTRY[group.family]
    if (!meta) {
      // Familia desconocida — no romper. Tratar como skip silencioso.
      skipped.push(group)
      continue
    }
    if (meta.delegatedToExtras) {
      extras.push(group)
      continue
    }
    const override = resolveOverride(group)
    if (meta.canRender(group, override)) {
      routable.push(group)
    } else {
      skipped.push(group)
    }
  }

  return Object.freeze({
    routable: Object.freeze(routable),
    extras:   Object.freeze(extras),
    skipped:  Object.freeze(skipped),
  })
}
