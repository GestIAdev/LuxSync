/**
 * 🔄 HYSTERESIS TRIGGER (Schmitt Trigger)
 * ══════════════════════════════════════════════════════════════════════════
 * WAVE 16.3: Gatillos con Histéresis para Efectos Profesionales
 * 
 * Previene el efecto "metralleta" cuando la energía oscila en el borde.
 * 
 * COMPORTAMIENTO:
 * - Para ACTIVAR: Energía debe superar THRESHOLD_ON (subida clara)
 * - Para DESACTIVAR: Energía debe bajar de THRESHOLD_OFF (bajada clara)
 * - Si oscila entre ON y OFF: mantiene estado anterior (banda muerta)
 * 
 * EJEMPLO VISUAL:
 * ┌─────────────────────────────────────────┐
 * │ Energía: ────────▄▄▄▄▀▀▀─ (oscila)      │
 * │           0.60  0.70 0.50                │
 * │                                          │
 * │ ON_THRESHOLD = 0.70                     │
 * │ OFF_THRESHOLD = 0.50                    │
 * │                                          │
 * │ Comportamiento:                         │
 * │ - Sube a 0.70 → ENCIENDE (cruza ON)    │
 * │ - Oscila entre 0.60-0.70 → SIGUE ON    │
 * │ - Baja a 0.50 → APAGA (cruza OFF)      │
 * │                                          │
 * │ Resultado: 1 evento ON, 1 OFF           │
 * │ Sin histéresis: 20+ eventos/segundo 💥  │
 * └─────────────────────────────────────────┘
 * 
 * "Los efectos profesionales no parpadean, respiran" - Wave 16 Pro
 * ══════════════════════════════════════════════════════════════════════════
 */

export class HysteresisTrigger {
  private state: boolean = false;
  private readonly thresholdOn: number;
  private readonly thresholdOff: number;
  private readonly name: string;
  
  // Estadísticas para debug
  private transitionCount: number = 0;
  private lastTransitionTime: number = 0;
  private framesSinceLastTransition: number = 0;
  
  /**
   * Constructor
   * @param name - Nombre del trigger (para debug)
   * @param thresholdOn - Umbral para activar (debe ser > thresholdOff)
   * @param thresholdOff - Umbral para desactivar (debe ser < thresholdOn)
   */
  constructor(
    name: string,
    thresholdOn: number,
    thresholdOff: number
  ) {
    this.name = name;
    this.thresholdOn = thresholdOn;
    this.thresholdOff = thresholdOff;
    
    if (thresholdOff >= thresholdOn) {
      throw new Error(
        `HysteresisTrigger [${name}]: OFF threshold (${thresholdOff}) must be < ON threshold (${thresholdOn})`
      );
    }
    
    // WAVE 18.3: Silenced for cleaner logs (uncomment for debug)
    // console.log(`[Hysteresis] 🔄 Trigger "${name}" created: ON>${thresholdOn} OFF<${thresholdOff}`);
  }
  
  /**
   * 🔄 PROCESA ENERGÍA CON HISTÉRESIS
   * 
   * @param energy - Valor de energía normalizado (0-1)
   * @returns true si el estado CAMBIÓ, false si sigue igual
   */
  process(energy: number): boolean {
    const previousState = this.state;
    this.framesSinceLastTransition++;
    
    if (!this.state && energy > this.thresholdOn) {
      // Transición: OFF → ON
      this.state = true;
      this.transitionCount++;
      this.lastTransitionTime = Date.now();
      this.framesSinceLastTransition = 0;
      
      // WAVE 18.3: Silenced for cleaner logs
      // console.log(`[Hysteresis] ⚡ ${this.name}: OFF→ON (E=${energy.toFixed(3)} > ${this.thresholdOn})`);
      
    } else if (this.state && energy < this.thresholdOff) {
      // Transición: ON → OFF
      this.state = false;
      this.transitionCount++;
      this.lastTransitionTime = Date.now();
      this.framesSinceLastTransition = 0;
      
      // WAVE 18.3: Silenced for cleaner logs
      // console.log(`[Hysteresis] 💤 ${this.name}: ON→OFF (E=${energy.toFixed(3)} < ${this.thresholdOff})`);
    }
    // Si energía está entre OFF y ON, no cambiar estado (histéresis)
    
    return this.state !== previousState;
  }
  
  /**
   * 📊 OBTIENE ESTADO ACTUAL
   */
  getState(): boolean {
    return this.state;
  }
  
  /**
   * 📊 OBTIENE NOMBRE DEL TRIGGER
   */
  getName(): string {
    return this.name;
  }
  
  /**
   * 🔄 RESET DEL TRIGGER
   */
  reset(): void {
    this.state = false;
    this.transitionCount = 0;
    this.lastTransitionTime = 0;
    this.framesSinceLastTransition = 0;
  }
  
  /**
   * 📊 OBTIENE ESTADÍSTICAS
   */
  getStats(): {
    name: string;
    state: boolean;
    thresholdOn: number;
    thresholdOff: number;
    transitionCount: number;
    lastTransitionTime: number;
    framesSinceLastTransition: number;
  } {
    return {
      name: this.name,
      state: this.state,
      thresholdOn: this.thresholdOn,
      thresholdOff: this.thresholdOff,
      transitionCount: this.transitionCount,
      lastTransitionTime: this.lastTransitionTime,
      framesSinceLastTransition: this.framesSinceLastTransition,
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════
// EFFECT TRIGGERS PRE-CONFIGURADOS (Wave 16 Pro)
// ══════════════════════════════════════════════════════════════════════════

/**
 * 🎛️ EFFECT TRIGGERS MANAGER
 * 
 * Contiene todos los triggers pre-configurados para efectos DMX
 * Los umbrales están calibrados según el blueprint Wave 16
 */
export class EffectTriggersManager {
  // Triggers individuales con umbrales calibrados
  public readonly pulse: HysteresisTrigger;
  public readonly chase: HysteresisTrigger;
  public readonly strobe: HysteresisTrigger;
  public readonly laser: HysteresisTrigger;
  public readonly prism: HysteresisTrigger;
  
  // Array para iteración
  private readonly triggers: HysteresisTrigger[];
  
  constructor() {
    // Configuración de umbrales (ON / OFF)
    // Basados en datos reales: E típica = 0.15-0.48 NORMALIZADA a 0-1
    
    this.pulse = new HysteresisTrigger('pulse', 0.35, 0.20);    // Siempre algo de movimiento
    this.chase = new HysteresisTrigger('chase', 0.65, 0.40);    // Movimiento activo
    this.strobe = new HysteresisTrigger('strobe', 0.80, 0.55);  // Solo en picos
    this.laser = new HysteresisTrigger('laser', 0.55, 0.35);    // Efectos visuales
    this.prism = new HysteresisTrigger('prism', 0.70, 0.45);    // Parpadeo prisma
    
    this.triggers = [this.pulse, this.chase, this.strobe, this.laser, this.prism];
    
    console.log('[EffectTriggers] 🎛️ All 5 Schmitt triggers initialized');
  }
  
  /**
   * 🔄 PROCESA ENERGÍA EN TODOS LOS TRIGGERS
   * @param normalizedEnergy - Energía normalizada (0-1)
   * @returns Estado de todos los efectos
   */
  processAll(normalizedEnergy: number): {
    pulse: boolean;
    chase: boolean;
    strobe: boolean;
    laser: boolean;
    prism: boolean;
    anyChanged: boolean;
  } {
    const pulseChanged = this.pulse.process(normalizedEnergy);
    const chaseChanged = this.chase.process(normalizedEnergy);
    const strobeChanged = this.strobe.process(normalizedEnergy);
    const laserChanged = this.laser.process(normalizedEnergy);
    const prismChanged = this.prism.process(normalizedEnergy);
    
    return {
      pulse: this.pulse.getState(),
      chase: this.chase.getState(),
      strobe: this.strobe.getState(),
      laser: this.laser.getState(),
      prism: this.prism.getState(),
      anyChanged: pulseChanged || chaseChanged || strobeChanged || laserChanged || prismChanged,
    };
  }
  
  /**
   * 🔄 RESET TODOS LOS TRIGGERS
   */
  resetAll(): void {
    this.triggers.forEach(t => t.reset());
    console.log('[EffectTriggers] 🔄 All triggers reset');
  }
  
  /**
   * 📊 OBTIENE ESTADÍSTICAS DE TODOS
   */
  getAllStats(): Record<string, ReturnType<HysteresisTrigger['getStats']>> {
    const stats: Record<string, ReturnType<HysteresisTrigger['getStats']>> = {};
    this.triggers.forEach(t => {
      stats[t.getName()] = t.getStats();
    });
    return stats;
  }
}

// Singleton para uso global
let _effectTriggersInstance: EffectTriggersManager | null = null;

export function getEffectTriggers(): EffectTriggersManager {
  if (!_effectTriggersInstance) {
    _effectTriggersInstance = new EffectTriggersManager();
  }
  return _effectTriggersInstance;
}

export function resetEffectTriggers(): void {
  if (_effectTriggersInstance) {
    _effectTriggersInstance.resetAll();
  }
}
