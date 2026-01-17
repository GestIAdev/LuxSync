/**
 * 🎭 TEST DIRECTO EL-1140
 * Script para testear el mover directamente sin pasar por el engine
 * 
 * INSTRUCCIONES:
 * 1. Abre DevTools (F12) en LuxSync
 * 2. Pega este código en la consola
 * 3. Ejecuta: testMover()
 * 
 * Esto enviará valores directos al canal 50 (tu mover)
 */

async function testMover() {
  console.log('🎭 TEST EL-1140 @ Canal 50')
  
  // Asegura que ArtNet está conectado
  const status = await window.artnet.getStatus()
  console.log('Status:', status)
  
  if (status.state !== 'ready' && status.state !== 'sending') {
    console.error('❌ ArtNet no está conectado')
    console.log('Conecta desde el dashboard primero')
    return
  }
  
  console.log('✅ ArtNet conectado a', status.ip)
  
  // EL-1140 Astro 150B - Modo 16 canales (más común)
  // Canal 50 = DMX address base
  const channels = {
    pan: 50,        // Ch 1: Pan
    panFine: 51,    // Ch 2: Pan Fine
    tilt: 52,       // Ch 3: Tilt
    tiltFine: 53,   // Ch 4: Tilt Fine
    speed: 54,      // Ch 5: Speed
    dimmer: 55,     // Ch 6: Dimmer
    shutter: 56,    // Ch 7: Shutter/Strobe
    color: 57,      // Ch 8: Color wheel
    gobo: 58,       // Ch 9: Gobo
    goboRot: 59,    // Ch 10: Gobo rotation
    prism: 60,      // Ch 11: Prism
    focus: 61,      // Ch 12: Focus
    // ... resto de canales
  }
  
  console.log('📍 Canales configurados:', channels)
  
  // TEST 1: DIMMER AL 100%
  console.log('TEST 1: Dimmer 100%')
  await window.dmx.setChannel(channels.dimmer, 255)
  await new Promise(r => setTimeout(r, 1000))
  
  // TEST 2: SHUTTER ABIERTO
  console.log('TEST 2: Shutter abierto')
  await window.dmx.setChannel(channels.shutter, 255)
  await new Promise(r => setTimeout(r, 1000))
  
  // TEST 3: PAN CENTRO
  console.log('TEST 3: Pan centro (127)')
  await window.dmx.setChannel(channels.pan, 127)
  await window.dmx.setChannel(channels.panFine, 0)
  await new Promise(r => setTimeout(r, 1000))
  
  // TEST 4: TILT CENTRO
  console.log('TEST 4: Tilt centro (127)')
  await window.dmx.setChannel(channels.tilt, 127)
  await window.dmx.setChannel(channels.tiltFine, 0)
  await new Promise(r => setTimeout(r, 1000))
  
  // TEST 5: MOVIMIENTO PAN
  console.log('TEST 5: Sweep pan')
  for (let i = 0; i < 255; i += 5) {
    await window.dmx.setChannel(channels.pan, i)
    await new Promise(r => setTimeout(r, 50))
  }
  
  // TEST 6: COLOR WHEEL
  console.log('TEST 6: Cambio de color')
  const colors = [0, 64, 128, 192, 255]
  for (const c of colors) {
    await window.dmx.setChannel(channels.color, c)
    await new Promise(r => setTimeout(r, 500))
  }
  
  // TEST 7: GOBO
  console.log('TEST 7: Cambio de gobo')
  const gobos = [0, 32, 64, 96, 128]
  for (const g of gobos) {
    await window.dmx.setChannel(channels.gobo, g)
    await new Promise(r => setTimeout(r, 500))
  }
  
  // RESET: Todo a home
  console.log('RESET: Home position')
  await window.dmx.setChannel(channels.dimmer, 0)
  await window.dmx.setChannel(channels.shutter, 0)
  await window.dmx.setChannel(channels.pan, 127)
  await window.dmx.setChannel(channels.tilt, 127)
  await window.dmx.setChannel(channels.color, 0)
  await window.dmx.setChannel(channels.gobo, 0)
  
  console.log('✅ Test completado')
  console.log('Si el mover NO se movió:')
  console.log('  1. Verifica dirección física (debe ser A050)')
  console.log('  2. Verifica modo DMX del mover (16ch es común)')
  console.log('  3. Verifica cable DMX conectado')
  console.log('  4. Verifica interface está en 10.0.0.10')
}

// Ejecuta el test
console.log('🎭 Script de test cargado')
console.log('Ejecuta: testMover()')
