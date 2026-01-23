🏗️ ARQUITECTURA HÍBRIDA: "THE TRANSLATOR"
El TitanEngine debe tener dos caminos de renderizado que se bifurcan en el último milisegundo, justo antes de salir al cable DMX.

1. EL DICCIONARIO (Perfil de Fixture)
Cada fixture en tu sistema necesita una definición clara de sus capacidades. No basta con los canales DMX.

TypeScript
interface FixtureProfile {
  type: 'beam' | 'spot' | 'wash' | 'hybrid';
  engine: {
    colorMixing: 'RGB' | 'CMY' | 'Wheel' | 'Hybrid'; // 'Hybrid' = Rueda + CMY
    shutter: 'Mechanical' | 'Digital'; // Digital = Instantáneo (LED)
    movement: 'Stepper' | 'Galvo';
  };
  // La "Piedra Rosetta" para tus LB230N
  colorWheel?: {
    colors: [
      { dmx: 0,   name: 'Open',   rgb: '#FFFFFF' },
      { dmx: 10,  name: 'Red',    rgb: '#FF0000' },
      { dmx: 20,  name: 'Orange', rgb: '#FF8800' },
      { dmx: 30,  name: 'Aquamarine', rgb: '#7FFFD4' }, // Ese color raro que siempre traen
      // ...
    ];
    spinModeAllowed: boolean; // ¿Permitimos giro continuo?
  };
}
2. EL TRADUCTOR (ColorTranslator.ts)
Cuando Selene sueña en "Azul Cian Cyberpunk" (#00FFFF), el traductor actúa según el fixture:

Caso A: Mover LED (Rico):

Input: #00FFFF

Output: R:0, G:255, B:255

Resultado: Color exacto, transición instantánea.

Caso B: LB230N (Tu Realidad):

Input: #00FFFF

Output: Busca en colorWheel.

Cálculo: Distancia euclidiana de color. ¿Qué está más cerca?

Opción 1: Blue (Distancia 40)

Opción 2: Aquamarine (Distancia 15) -> GANADOR

Acción: Envía DMX valor 30 (Aquamarine).

⚠️ SAFETY LOCK: Si el efecto pide cambiar de color cada 100ms, el SafetyLayer dice: "¡QUIETO! Mantén el Aquamarine hasta que el efecto termine o cambie drásticamente."

📜 DIRECTIVA TÁCTICA: WAVE 983 - HARDWARE ABSTRACTION LAYER (HAL)
OBJETIVO: Permitir que Selene use "Pintura LED" en "Lienzos Mecánicos" sin romperlos, manteniendo la velocidad para quien pueda pagarla.

1. ColorTranslator (El Intérprete):

Implementar función mapRGBtoPhysical(targetColor, wheelColors).

Usar algoritmos de distancia de color (DeltaE o Euclidian simple) para encontrar el "vecino más cercano".

Bonus: Si la distancia es muy grande (ej: Selene pide Rosa y la rueda solo tiene Rojo y Azul), priorizar la Intensidad (Blanco) o un color primario, en lugar de un color sucio.

2. HardwareSafetyLayer (El Búnker):

LEDs: MaxFrequency = Infinity. Transition = Instant.

Physical Wheels:

MaxColorChangeFreq = 0.5 Hz (1 cambio cada 2s máx).

LatchMode = Enabled (Si entra un efecto rápido, elegir un color y bloquearlo).

BlackoutMove = Optional (Cerrar dimmer mientras gira la rueda para no ver el arcoíris intermedio).

3. HybridEngine (La Lógica de Disparo):

Si el efecto es strobe_storm (Multicolor rápido):

LEDs: Disparan arcoíris estroboscópico.

Beams: Disparan Blanco (Open) con Strobe Mecánico brutal. (El impacto es el mismo: caos y luz, aunque sacrifiquemos el color).