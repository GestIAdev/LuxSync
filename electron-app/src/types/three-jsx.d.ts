/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 THREE.JS JSX TYPES - WAVE 30: Stage Command & Dashboard
 * Declaraciones de tipos para React Three Fiber
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este archivo extiende los tipos de JSX para incluir los elementos de Three.js
 * que son usados por React Three Fiber (@react-three/fiber).
 * 
 * Sin este archivo, TypeScript no reconocería elementos como <mesh>, <group>, etc.
 */

import { ThreeElements } from '@react-three/fiber'

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
