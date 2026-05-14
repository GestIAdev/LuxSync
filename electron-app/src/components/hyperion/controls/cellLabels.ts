/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏷️ CELL LABELS — WAVE 4734 BATCH 1
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Utilidades puras de resolución de etiquetas y null-safety para los headers
 * de las section atomic. Garantizan que llamadas como `.toUpperCase()` o
 * `.replace()` en `ctx.label` NUNCA crasheen aunque el JSON venga roto, el
 * `aetherNodeId` sea vacío, o el pipeline aún no haya hidratado la cell.
 *
 * @module components/hyperion/controls/cellLabels
 * @version WAVE 4734-A
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Fallback final cuando todas las resoluciones fallan. */
export const UNKNOWN_CELL_LABEL = 'Unknown Cell'

/**
 * Mapeo declarativo de `aetherNodeId` conocidos a etiquetas humanas.
 *
 * Cubre los casos que la Forja Híbrida (WAVE 4732) emite con `cellId`
 * semántico. Si el operador renombra el `label` desde la Forja, este mapa
 * NO se consulta — solo entra cuando el label cae al fallback `cellId`.
 *
 * Para añadir nuevos: respetar el patrón `kebab-case` del aetherNodeId.
 */
export const WELL_KNOWN_LABELS: Readonly<Record<string, string>> = Object.freeze({
  // Roles canónicos
  'wash':           'Wash',
  'beam':           'Rayo',
  'kinetic':        'Posición',
  'impact':         'Master',
  'color':          'Color',
  'atmosphere':     'Ambiente',
  // Variantes Tungsten / multi-impact
  'impact-golden':  'Golden',
  'impact-stain':   'Stain',
  'impact-master':  'Master',
  // Variantes COLOR
  'color-rgb':      'Color RGB',
  'color-rgbw':     'Color RGBW',
  'color-cmy':      'Color CMY',
})

/**
 * Patrón regex para detectar un `cellId` crudo (kebab/snake-case alfanumérico).
 *
 * Si la cadena no matchea esto, es un label custom que el operador escribió
 * (puede tener espacios, acentos, mayúsculas…) y se devuelve verbatim.
 */
const CELL_ID_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/

// ─────────────────────────────────────────────────────────────────────────────
// HUMANIZE — kebab/snake-case → Title Case
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte un cellId estilo `petal-1` o `wash_drop` en `Petal 1` / `Wash Drop`.
 *
 * Determinista, sin locale. Espera input ya validado por `CELL_ID_PATTERN`.
 * Para entradas inválidas, devuelve la cadena tal cual (defensivo).
 */
export function humanizeCellId(cellId: string): string {
  if (typeof cellId !== 'string' || cellId.length === 0) return UNKNOWN_CELL_LABEL
  return cellId
    .split(/[-_]+/)
    .filter(part => part.length > 0)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFE STRING HELPERS — null/undefined-proof
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `.toUpperCase()` blindado: nunca crashea por `null`/`undefined`/non-string.
 *
 * @param value Cualquier cosa. Si no es string utilizable, retorna `fallback`.
 * @param fallback Devuelto cuando el input no es resoluble. Default `''`.
 */
export function safeUpperCase(value: unknown, fallback: string = ''): string {
  if (value === null || value === undefined) return fallback
  if (typeof value !== 'string') {
    const coerced = String(value)
    return coerced.length === 0 ? fallback : coerced.toUpperCase()
  }
  return value.length === 0 ? fallback : value.toUpperCase()
}

/**
 * `.trim()` blindado. Retorna `null` si después de trim queda cadena vacía.
 *
 * Útil para distinguir "el operador puso espacios" de "campo no llegó".
 */
export function safeTrim(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') {
    const coerced = String(value).trim()
    return coerced.length === 0 ? null : coerced
  }
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

// ─────────────────────────────────────────────────────────────────────────────
// CELL LABEL RESOLUTION — el corazón del módulo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resuelve el label visible de una célula con fallbacks en cascada.
 *
 * Orden de precedencia (Blueprint §4.2):
 *   1. `label` custom del operador (cualquier cadena no-cellId).
 *   2. Mapeo `WELL_KNOWN_LABELS` si el label es un cellId conocido.
 *   3. `humanizeCellId(label)` si parece un cellId genérico.
 *   4. `UNKNOWN_CELL_LABEL` como último fallback.
 *
 * Nunca devuelve cadena vacía. Nunca lanza. Output siempre listo para
 * `.toUpperCase()` directo.
 *
 * @example
 * resolveCellLabel('Pétalo 1')      // → 'Pétalo 1'   (label custom)
 * resolveCellLabel('wash')          // → 'Wash'        (well-known)
 * resolveCellLabel('petal-1')       // → 'Petal 1'     (humanize)
 * resolveCellLabel('')              // → 'Unknown Cell'
 * resolveCellLabel(null)            // → 'Unknown Cell'
 * resolveCellLabel(undefined)       // → 'Unknown Cell'
 */
export function resolveCellLabel(raw: string | null | undefined): string {
  const trimmed = safeTrim(raw)
  if (trimmed === null) return UNKNOWN_CELL_LABEL

  // Cadena custom (espacios, acentos, mayúsculas) → devolver verbatim.
  if (!CELL_ID_PATTERN.test(trimmed)) return trimmed

  // cellId conocido → label declarativa.
  const known = WELL_KNOWN_LABELS[trimmed]
  if (known !== undefined) return known

  // cellId desconocido → humanizar.
  return humanizeCellId(trimmed)
}

/**
 * Labels genéricos de familia — producidos por `suffixToLabel` cuando no hay
 * una etiqueta semántica real (fixtures clásicos de un solo canal).
 *
 * Si el label resuelto ES uno de estos → muestra formato «FAMILIA: LABEL».
 * Si NO lo es → es una etiqueta personalizada Aether → muestra SOLO el label.
 */
const GENERIC_AUTO_LABELS = new Set([
  'Intensidad', 'Color', 'Cinética', 'Haz', 'Extras',
])

/**
 * Combina título canónico de sección + label de célula para el header.
 *
 * WAVE 4737 PURIST UI:
 *   - `isCustom = true`  → el label es semántico (Aether): mostrar SOLO el label.
 *   - `isCustom = false` → label genérico de familia: mostrar «TITLE: SUBLABEL».
 *
 * @param sectionTitle El `SectionMeta.title` (`'INTENSITY'`, `'COLOR'`, …).
 * @param cellLabel    El label resuelto por `resolveCellLabel` (o crudo).
 * @returns Texto listo para el header del acordeón.
 */
export function buildSectionHeaderText(
  sectionTitle: string | null | undefined,
  cellLabel:    string | null | undefined,
): { title: string; sublabel: string; isCustom: boolean } {
  const title    = safeUpperCase(sectionTitle, 'SECTION')
  const resolved = resolveCellLabel(cellLabel)
  const sublabel = safeUpperCase(resolved, 'CELL')
  const isCustom = !GENERIC_AUTO_LABELS.has(resolved)
  return { title, sublabel, isCustom }
}

// ─────────────────────────────────────────────────────────────────────────────
// PREFIX EXTRACTION — para descubrir labels desde channelName[]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el prefijo común más largo entre N cadenas.
 *
 * Usado en BATCH-H (pipeline) para que `["Petal1R", "Petal1G", "Petal1B"]`
 * derive en el label `'Petal1'` → `'Petal 1'` tras humanize.
 *
 * Comparación case-sensitive. Retorna `''` si no hay solapamiento.
 */
export function longestCommonPrefix(strings: readonly string[]): string {
  if (strings.length === 0) return ''
  if (strings.length === 1) return strings[0] ?? ''

  let prefix = strings[0] ?? ''
  for (let i = 1; i < strings.length; i++) {
    const s = strings[i] ?? ''
    let j = 0
    const maxLen = Math.min(prefix.length, s.length)
    while (j < maxLen && prefix.charCodeAt(j) === s.charCodeAt(j)) j++
    prefix = prefix.slice(0, j)
    if (prefix.length === 0) break
  }
  return prefix
}

/**
 * Resuelve un label semántico desde un array de `channelName` (legacy / Forge).
 *
 * Pipeline:
 *   1. Filtra cadenas vacías.
 *   2. Calcula `longestCommonPrefix`.
 *   3. Si el prefijo tiene ≥ 3 caracteres → `humanizeCellId(prefix)`.
 *   4. Si no, retorna `null` para que el caller use el siguiente fallback.
 *
 * Pensado para el `_buildLabelFor` del `NodeExtractionPipeline` (BATCH-H).
 */
export function deriveLabelFromChannelNames(
  channelNames: readonly (string | null | undefined)[],
): string | null {
  const cleaned = channelNames
    .map(n => safeTrim(n))
    .filter((s): s is string => s !== null)

  if (cleaned.length === 0) return null

  const prefix = longestCommonPrefix(cleaned).trim()
  if (prefix.length < 3) return null

  // Normalizar separadores: 'Petal1' → 'Petal 1' requiere insertar guion
  // entre letras y dígitos. Solo si el prefijo es alfanumérico crudo.
  const withSeparators = prefix.replace(/([A-Za-z])(\d)/g, '$1-$2')
  if (CELL_ID_PATTERN.test(withSeparators.toLowerCase())) {
    return humanizeCellId(withSeparators.toLowerCase())
  }
  return prefix
}
