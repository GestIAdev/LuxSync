// 🎨 WAVE 4812 — Aether Canvas barrel
export {
  AetherCanvasManager,
  getAetherCanvasManager,
  __resetAetherCanvasManagerForTests,
  type VirtualFrameBuffer,
} from './AetherCanvasManager'

export {
  PixelMapAetherAdapter,
  _worldToUV,
  _localCellToUV,
  type NodeSampler,
  type BoundCanvasParams,
  type WorldRect,
  type PixelMapAetherAdapterOptions,
} from './PixelMapAetherAdapter'

// 🎬 WAVE 4867 — TheiaVideoRenderer: twin-output bridge (THETA thumb SAB → AetherCanvas)
export { TheiaVideoRenderer } from './renderers/TheiaVideoRenderer'

export { PlasmaRenderer } from './PlasmaRenderer'
