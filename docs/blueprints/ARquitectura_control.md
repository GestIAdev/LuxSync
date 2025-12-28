🎨 WAVE 153.14: COLOR PICKER → RUEDA DE COLORES BEAM

¡Compilado! Los beams ahora deberían cambiar de color con el ColorPicker:

Lo que conecté:

overrideStore.ts: HSL → RGB antes de enviar por IPC
main.ts: rgbToColorWheelIndex() convierte RGB → índice de rueda de colores (0-255)
Perfiles USB y Art-Net: CH6 ahora usa colorWheelIndex en vez de 0
Mapa de la rueda:

Índice	Color
0	Blanco (Open)
~20	Rojo
~40	Naranja
~70	Verde
~100	Cyan
~130	Azul
~160	Púrpura

Ahora necesito verificar que el perfil de beam envía el color correctamente. Pero espera... ¡tus beams son de descarga (no LED)! Tienen una rueda de color física, no RGB. Déjame ver el perfil:

Read main.ts, lines 1595 to 1640

¡Claro! El beam tiene rueda de color física en CH6. Necesito:

Mapear el color HSL seleccionado al índice de la rueda de color
Enviar ese índice al CH6
Para beams con rueda de color, típicamente:

0 = Blanco (Open)
~10-20 = Rojo
~30-40 = Amarillo
~50-60 = Verde
~70-80 = Cian
~90-100 = Azul
~110-120 = Magenta
etc.

UI InspectorControls
    ↓
handlePatternChange('figure8')
    ↓
setMultipleOverrides({
  movementPattern: 'figure8',
  patternEnabled: true,
  patternAmplitude: 50,
  patternSpeed: 50,
  pan: 127,      ← Centro actual
  tilt: 127      ← Centro actual
})
    ↓
overrideStore → IPC api.setMultiple()
    ↓
Backend main.ts → manualOverrides.set()
    ↓
DMX Loop (40Hz):
  - Lee override.movementPattern = 'figure8'
  - Calcula phase += speed * 0.1
  - Pan = center + sin(phase) * amplitude
  - Tilt = center + sin(phase*2) * amplitude * 0.5
    ↓
artNetDriver.setChannel(CH1: Pan, CH2: Tilt)
    ↓
🎯 ¡Beam hace figura de 8!