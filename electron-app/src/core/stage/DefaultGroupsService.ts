/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEFAULT GROUPS SERVICE — PARCHE 2
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Genera (o regenera) los grupos de sistema a partir de la lista de fixtures
 * activa. Esta utilidad es el único lugar donde se crean grupos "isSystem".
 *
 * Diseño:
 * - Idempotente: puede llamarse en cada _syncDerivedState sin efectos
 *   secundarios.
 * - No-destructivo: los grupos creados por el usuario (isSystem !== true)
 *   siempre se preservan tal cual.
 * - Agnóstico de estado: recibe datos, devuelve datos. Sin efectos en stores.
 *
 * RAZÓN DE EXTRACCIÓN (FRACTURA 2):
 * La lógica de grupos por defecto vivía exclusivamente en ShowFileMigrator.ts
 * y solo se ejecutaba en la migración V1→V2. Un show nativo V2 nunca recibía
 * estos grupos, dejando a KeyForge disparando en el vacío al buscar
 * 'group-zone-front', 'group-type-moving-head', 'group-all', etc.
 *
 * @module core/stage/DefaultGroupsService
 */

import type { FixtureV2, FixtureGroup } from './ShowFileV2'

/**
 * Genera grupos de sistema (zona, tipo, "All Fixtures") a partir de fixtures.
 * Los grupos de usuario existentes se preservan intactos.
 *
 * @param fixtures        Lista activa de fixtures del show.
 * @param existingGroups  Grupos ya presentes en showFile.groups.
 * @returns               Array combinado: grupos sistema + grupos usuario.
 */
export function ensureSystemGroups(
  fixtures: readonly FixtureV2[],
  existingGroups: readonly FixtureGroup[],
): FixtureGroup[] {
  // Preservar grupos de usuario (creados por el operador, no por el sistema)
  const userGroups = existingGroups.filter(g => !g.isSystem)

  if (fixtures.length === 0) return userGroups

  const generated: FixtureGroup[] = []
  let order = 0

  // ── Grupos por zona ────────────────────────────────────────────────────
  const byZone = new Map<string, string[]>()
  for (const f of fixtures) {
    const zone = f.zone || 'unassigned'
    if (!byZone.has(zone)) byZone.set(zone, [])
    byZone.get(zone)!.push(f.id)
  }
  for (const [zone, ids] of byZone) {
    if (ids.length > 1) {
      generated.push({
        id: `group-zone-${zone}`,
        name: zone.replace(/-/g, ' ').toUpperCase(),
        fixtureIds: ids,
        color: '#00f3ff',
        isSystem: true,
        order: order++,
      })
    }
  }

  // ── Grupos por tipo ────────────────────────────────────────────────────
  const byType = new Map<string, string[]>()
  for (const f of fixtures) {
    const type = f.type || 'generic'
    if (!byType.has(type)) byType.set(type, [])
    byType.get(type)!.push(f.id)
  }
  for (const [type, ids] of byType) {
    if (ids.length > 1 && type !== 'generic') {
      generated.push({
        id: `group-type-${type}`,
        name: `All ${type.replace(/-/g, ' ')}s`,
        fixtureIds: ids,
        color: '#f54a00',
        isSystem: true,
        order: order++,
      })
    }
  }

  // ── Grupo universal ────────────────────────────────────────────────────
  generated.push({
    id: 'group-all',
    name: 'ALL FIXTURES',
    fixtureIds: fixtures.map(f => f.id),
    color: '#ffffff',
    hotkey: '0',
    isSystem: true,
    order: 999,
  })

  // Grupos de usuario al final (order 1000+) para no colisionar con sistema
  const userGroupsWithOrder = userGroups.map((g, i) => ({ ...g, order: 1000 + i }))

  return [...generated, ...userGroupsWithOrder]
}
