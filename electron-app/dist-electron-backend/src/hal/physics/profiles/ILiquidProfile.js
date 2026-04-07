/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2435: ILiquidProfile — Contrato de Perfil para el Omni-Liquid Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Contiene TODA la parametría que varía entre géneros musicales.
 * El motor LiquidStereoPhysics no tiene ni una constante numérica propia —
 * todo viene del perfil inyectado.
 *
 * Un perfil es puro dato: sin lógica, sin funciones, sin imports pesados.
 * Misma mecánica, resultado completamente distinto según los números.
 *
 * WAVE 2435: Añade overrides41 — parametría específica para layout 4.1.
 * La fusión ocurre en setProfile(), NO en el hot-path.
 *
 * @module hal/physics/profiles/ILiquidProfile
 * @version WAVE 2435 — OMNILIQUID OVERRIDES
 */
export {};
