/**
 * RenderGovernor.ts — Euclid Oracle · Fase E3 (§4.5 Governor adaptativo)
 *
 * Prevención TDR para shaders generativos: controla `u_renderScale` — el
 * worker renderiza la escena a `scale × resolución` en un FBO y la escala
 * al canvas en el blit final.
 *
 * Reglas del blueprint:
 *   · EMA del frame time > 15 ms sostenido 1 s → scale −= 0.1 (mín. 0.4)
 *   · EMA < 10 ms sostenido 1 s               → scale += 0.05 (máx. 1.0)
 *   · Banda muerta 10–15 ms + cooldown post-ajuste → histéresis anti-oscilación
 *
 * Puro: `step()` no toca GL — el worker alimenta el dt (o GPU ms si hay
 * EXT_disjoint_timer_query_webgl2) y aplica el scale al FBO.
 */

export interface GovernorConfig {
  /** EMA del frame time (ms). */
  emaAlpha: number
  /** Umbral de sobrecoste (ms). */
  overMs: number
  /** Umbral de holgura (ms). */
  underMs: number
  /** Tiempo sostenido requerido para ajustar (ms). */
  dwellMs: number
  /** Pausa tras cada ajuste (ms) — histéresis. */
  cooldownMs: number
  /** Paso de degradación. */
  downStep: number
  /** Paso de recuperación. */
  upStep: number
  minScale: number
  maxScale: number
  /** Escala inicial — 0.75 para raymarching (§4.5). */
  initialScale: number
}

export const GOVERNOR_DEFAULTS: GovernorConfig = {
  emaAlpha: 0.12,
  overMs: 15,
  underMs: 10,
  dwellMs: 1000,
  cooldownMs: 400,
  downStep: 0.1,
  upStep: 0.05,
  minScale: 0.4,
  maxScale: 1.0,
  initialScale: 0.75,
}

export class RenderGovernor {
  /** Escala vigente — aplicada al FBO cada frame. */
  renderScale: number
  /** EMA del coste de frame (ms) — entrada del governor (gpuMs ?? rafDt). */
  frameEmaMs = 16.7
  /** Total de degradaciones/recuperaciones aplicadas (diagnóstico). */
  downgrades = 0
  upgrades = 0

  private readonly cfg: GovernorConfig
  private overAccMs = 0
  private underAccMs = 0
  private cooldownUntilMs = 0

  constructor(cfg: Partial<GovernorConfig> = {}) {
    this.cfg = { ...GOVERNOR_DEFAULTS, ...cfg }
    this.renderScale = this.cfg.initialScale
  }

  /**
   * Un paso por frame renderizado.
   * @param frameMs coste real del frame (gpuMs del timer query si está,
   *                si no, el dt del render clock).
   * @param nowMs   reloj monotónico (performance.now()).
   * @returns renderScale vigente tras el paso.
   */
  step(frameMs: number, nowMs: number): number {
    const cfg = this.cfg
    this.frameEmaMs += (frameMs - this.frameEmaMs) * cfg.emaAlpha

    if (nowMs < this.cooldownUntilMs) {
      this.overAccMs = 0
      this.underAccMs = 0
      return this.renderScale
    }

    if (this.frameEmaMs > cfg.overMs) {
      this.overAccMs += frameMs
      this.underAccMs = 0
      if (this.overAccMs >= cfg.dwellMs) {
        this.renderScale = Math.max(cfg.minScale, this.renderScale - cfg.downStep)
        this.downgrades++
        this.overAccMs = 0
        this.cooldownUntilMs = nowMs + cfg.cooldownMs
      }
    } else if (this.frameEmaMs < cfg.underMs) {
      this.underAccMs += frameMs
      this.overAccMs = 0
      if (this.underAccMs >= cfg.dwellMs) {
        this.renderScale = Math.min(cfg.maxScale, this.renderScale + cfg.upStep)
        this.upgrades++
        this.underAccMs = 0
        this.cooldownUntilMs = nowMs + cfg.cooldownMs
      }
    } else {
      // Banda muerta — ninguna acumulación: histéresis.
      this.overAccMs = 0
      this.underAccMs = 0
    }
    return this.renderScale
  }

  /** Fuerza la escala (p.ej. al activar un shader nuevo). */
  reset(scale = this.cfg.initialScale): void {
    this.renderScale = scale
    this.frameEmaMs = 16.7
    this.overAccMs = 0
    this.underAccMs = 0
    this.cooldownUntilMs = 0
  }
}
