import { useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// screenToSVG — Conversión de coordenadas DOM → SVG user space
// PROYECTO EREBUS — FASE 1 COMMIT A
//
// Única fuente de verdad para la matemática de proyección inversa.
// Toma clientX/clientY del evento de puntero y devuelve coordenadas
// en el espacio de usuario del viewBox (metros, top-left origin).
//
// Usa getScreenCTM().inverse() — el estándar SVG para mapear
// píxeles de pantalla a unidades del viewBox.
// ═══════════════════════════════════════════════════════════════════════════

export interface SVGPoint {
  x: number
  y: number
}

/**
 * Hook que devuelve una función estable para convertir coordenadas
 * de pantalla (clientX, clientY) a coordenadas SVG (viewBox user space).
 *
 * @param svgRef - Ref al elemento <svg> raíz del lienzo
 * @returns Función (clientX, clientY) → { x, y } en metros SVG
 */
export function useScreenToSVG(
  svgRef: React.RefObject<SVGSVGElement | null>,
) {
  return useCallback(
    (clientX: number, clientY: number): SVGPoint => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const pt = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return { x: 0, y: 0 }
      const svgPt = pt.matrixTransform(ctm.inverse())
      return { x: svgPt.x, y: svgPt.y }
    },
    [svgRef],
  )
}

export default useScreenToSVG
