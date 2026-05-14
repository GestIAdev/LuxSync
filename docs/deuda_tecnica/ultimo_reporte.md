⚡ WAVE 4730 — REPORTE TÉCNICO
Archivos modificados
@/electron-app/src/stores/programmer-types.ts — tipo AggregatedCellGroup
@/electron-app/src/stores/programmerStore.ts — releaseProgrammer, releaseKinetics, forgetDeviceCatalog
@/electron-app/src/hooks/useCapabilityCells.ts — cleanup suave + useAggregatedCapabilityCells
@/electron-app/src/components/hyperion/controls/TheProgrammer.tsx — Unlock divorciado
tsc --noEmit: 0 errores.

🧠 TARGET 1 — Hive Mind (agregación)
Nuevo tipo en @/electron-app/src/stores/programmer-types.ts:279-293:

ts
export interface AggregatedCellGroup {
  readonly groupKey: string             // `${family}:${role}:${label}`
  readonly family: NodeFamily
  readonly role: NodeRole
  readonly label: string
  readonly cellKeys: readonly CellKey[] // todas las cells con esta firma
  readonly nodeIds: readonly NodeId[]   // unión flat (twin-aware)
  readonly cellCount: number
  readonly deviceCount: number
}
Nuevo hook en @/electron-app/src/hooks/useCapabilityCells.ts:377-435:

ts
export function useAggregatedCapabilityCells(
  selectedIds: readonly string[],
): AggregatedCellGroup[]
Reusa useCapabilityCells (que sigue dando DeviceCells[] para compat con la UI actual) y reorganiza por firma. Memoizado sobre deviceCells — el cómputo de agregación es O(N) sobre el total de cells.

Ejemplos de salida:

10 PARs LED → [ {COLOR:primary:Color, cellKeys:[...10], deviceCount:10}, {IMPACT:primary:Intensidad, cellKeys:[...10], deviceCount:10} ]
Tungsten + 5 PARs → grupos COMPARTIDOS (intersección) + grupos exclusivos del Tungsten (Petals, Wash, Beam) con deviceCount:1.
Patrón UI sugerido para la siguiente fase:

tsx
const groups = useAggregatedCapabilityCells(selectedIds)
const setCellColor = useProgrammerStore(s => s.setCellColor)
 
const onColorChange = (group, r, g, b) => {
  for (const key of group.cellKeys) setCellColor(key, r, g, b)
}
💧 TARGET 2 — Hidratación / persistencia
Causa raíz del bug: el effect de selección en useCapabilityCells.ts llamaba a unregisterDeviceCells(deviceId) para cada fixture deseleccionado. Esa función:

Elimina entries de cellRegistry + cellsByDevice.
Borra los cellOverrides asociados.
Encola los nodeIds en pendingClearNodeIds → el bridge envía clearManualOverrides al L2 → la cinética/color/intensidad manual desaparecen del L2.
Fix: nuevo método forgetDeviceCatalog(deviceId) en @/electron-app/src/stores/programmerStore.ts:1222-1261:

Solo poda cellRegistry/cellsByDevice para cells SIN override activo.
Cells CON override permanecen en el registry → al re-seleccionar el fixture, nodeIds siguen siendo resolubles.
JAMÁS emite clears al L2.
cellOverrides quedan intactos → el bridge sigue enviando los manuales al L2 a 44Hz aunque el fixture esté deseleccionado en la UI.
El effect en @/electron-app/src/hooks/useCapabilityCells.ts:317-341 ahora llama forgetDeviceCatalog en vez de unregisterDeviceCells.

Hidratación al re-seleccionar: automática. Como los cellOverrides persisten, cualquier hook UI que lea useProgrammerStore(s => s.cellOverrides.get(cellKey)) obtiene el valor previamente escrito.

unregisterDeviceCells se mantiene como teardown explícito (cambio de showfile, eliminación del fixture). Su JSDoc se actualizó para clarificar que NO debe llamarse en respuesta a cambio de selección.

🛡️ TARGET 3 — Divorcio de dominios
releaseProgrammer() (@/electron-app/src/stores/programmerStore.ts:1000-1057)
Cell layer: itera cellOverrides y elimina las entries cuya payload.family !== KINETIC. Encola sus nodeIds en pendingClearNodeIds.
Legacy layer: reconstruye fixtureOverrides preservando pan, tilt, speed, targetX/Y/Z + entries de extras con clave rotation/speed (phantom kinetic). Limpia el resto.
Marca dirty: IMPACT, COLOR, BEAM, EXTRAS.
NO marca KINETIC dirty → el bridge no toca el nodo :kinetic.
releaseKinetics() (@/electron-app/src/stores/programmerStore.ts:1059-1102)
Cell layer: elimina cells con family === KINETIC.
Legacy layer: limpia pan/tilt/speed/targetX/Y/Z y entries rotation/speed de extras.
Marca dirty: KINETIC + EXTRAS (para empujar el clear de phantoms).
releaseAll() se conserva como kill-switch nuclear (Programmer + Cathedral) sin cambios.
handleUnlockAll en @/electron-app/src/components/hyperion/controls/TheProgrammer.tsx:251-261
ts
const handleUnlockAll = useCallback(() => {
  if (selectedIds.length === 0) return
  releaseProgrammer()                                       // ← solo Programmer
  const nodeIds = selectedIds.map(id => `${id}:impact`)
  window.lux?.aether?.clearInhibitLimit(nodeIds)
}, [selectedIds, releaseProgrammer])
Las llamadas a setManualPattern, setKineticFanOffsets, setActivePattern, setManualOverrideForFixtures, setLockedFixtures se trasladaron a un nuevo handleNuclearReset (no wired al UI hoy; queda disponible para futuras acciones tipo "Reset Show" / emergencia).

ProgrammerAetherBridge — no requiere cambios
El bridge ya itera por familia y respeta los dirtyFamilies. Como releaseProgrammer no marca KINETIC dirty, el bridge no toca el nodo :kinetic en ese flush. Idéntico para releaseKinetics con las familias del Programmer. La segregación queda garantizada por la disciplina de dirty flags.

Próxima ola (fase visual)
La UI de TheProgrammer.tsx puede ahora consumir useAggregatedCapabilityCells(selectedIds) para reemplazar el deviceGroups.map(group => <DeviceCellGroup ... />) actual por un render plano de AggregatedCellGroup[] con secciones cuyo onChange itera cellKeys y dispara los setters cell-* del store sobre todo el conjunto. La capa store/hook ya soporta este uso sin modificación adicional.*