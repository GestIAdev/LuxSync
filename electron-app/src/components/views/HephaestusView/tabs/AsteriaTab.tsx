/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA TAB — WAVE 8010-P1: PIXEL MAPPER INVERSO
 *
 * Cuarta pestaña de Hephaestus. Contenedor del Lienzo Táctico: proyección
 * top-down del rig donde el operador pinta coreografía espacial (ondas,
 * textos, barridos) que el compilador hornea en el `.lfx` — el runtime de
 * 44 Hz jamás calcula espacio (Zero Alloc dogma, blueprint ASTERIA).
 *
 * Recibe `preview` + `temporalActions` de la shell (mismo contrato que
 * ForgeTab) y los delega al AsteriaView, orquestador del layout interno.
 *
 * @module views/HephaestusView/tabs/AsteriaTab
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react'
import type { HephPreviewReturn } from '../useHephPreview'
import type { TemporalActions } from '../types/HephaestusShared'
import { AsteriaView } from '../asteria/AsteriaView'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface AsteriaTabProps {
  preview: HephPreviewReturn
  temporalActions: TemporalActions
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const AsteriaTab: React.FC<AsteriaTabProps> = ({ preview, temporalActions }) => {
  return <AsteriaView preview={preview} temporalActions={temporalActions} />
}
