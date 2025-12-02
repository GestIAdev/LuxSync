/**
 * test-fxt-parser.ts
 * 🧪 Test del parser de archivos .fxt
 * 
 * Verifica que los archivos del casero se parsean correctamente
 * Ejecutar: npx ts-node src/test-fxt-parser.ts
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { FXTParser, loadAllFixtures, ChannelType, FixtureType } from './engines/fixtures/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           🧪 TEST - PARSER DE ARCHIVOS .FXT                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  const libreriasPath = path.join(__dirname, '..', 'librerias');
  console.log(`📂 Carpeta: ${libreriasPath}\n`);

  // Cargar todos los fixtures
  const fixtures = await loadAllFixtures(libreriasPath);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    📦 FIXTURES PARSEADOS                          ');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  for (const fixture of fixtures) {
    console.log(`┌──────────────────────────────────────────────────────────────────┐`);
    console.log(`│ 📍 ${fixture.name.padEnd(59)}│`);
    console.log(`├──────────────────────────────────────────────────────────────────┤`);
    console.log(`│  Fabricante:   ${fixture.manufacturer.padEnd(47)}│`);
    console.log(`│  Tipo:         ${fixture.type.padEnd(47)}│`);
    console.log(`│  Canales:      ${fixture.channelCount.toString().padEnd(47)}│`);
    console.log(`│  Archivo:      ${fixture.sourceFile.padEnd(47)}│`);
    console.log(`├──────────────────────────────────────────────────────────────────┤`);
    console.log(`│  CAPABILITIES:                                                   │`);
    
    const caps = fixture.capabilities;
    const capsList = [];
    
    if (caps.hasRGB) capsList.push('RGB');
    if (caps.hasRGBW) capsList.push('RGBW');
    if (caps.hasPan) capsList.push(`Pan (${caps.panRange || '?'}°)`);
    if (caps.hasTilt) capsList.push(`Tilt (${caps.tiltRange || '?'}°)`);
    if (caps.hasFinePanTilt) capsList.push('16bit Pan/Tilt');
    if (caps.hasColorWheel) capsList.push(`ColorWheel (${caps.colorWheelSlots.length} slots)`);
    if (caps.hasGoboWheel) capsList.push(`Gobo (${caps.goboWheelSlots.length} slots)`);
    if (caps.hasGoboRotation) capsList.push('Gobo Rot');
    if (caps.hasPrism) capsList.push('Prism');
    if (caps.hasFocus) capsList.push('Focus');
    if (caps.hasZoom) capsList.push('Zoom');
    if (caps.hasFrost) capsList.push('Frost');
    if (caps.hasIris) capsList.push('Iris');
    if (caps.hasDimmer) capsList.push('Dimmer');
    if (caps.hasStrobe) capsList.push('Strobe');
    
    console.log(`│    ${capsList.join(', ').substring(0, 60).padEnd(60)} │`);
    console.log(`├──────────────────────────────────────────────────────────────────┤`);
    console.log(`│  CANALES DMX:                                                    │`);
    
    for (const channel of fixture.channels.slice(0, 12)) {
      const typeIcon = getChannelIcon(channel.type);
      console.log(`│    CH${channel.index.toString().padStart(2)}: ${typeIcon} ${channel.name.substring(0, 25).padEnd(25)} [${channel.type.padEnd(15)}] │`);
    }
    
    if (fixture.channels.length > 12) {
      console.log(`│    ... y ${(fixture.channels.length - 12)} canales más                                      │`);
    }
    
    console.log(`└──────────────────────────────────────────────────────────────────┘`);
    console.log('');
  }

  // Resumen por tipo
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    📊 RESUMEN POR TIPO                            ');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  const typeCounts: Record<string, number> = {};
  for (const fixture of fixtures) {
    typeCounts[fixture.type] = (typeCounts[fixture.type] || 0) + 1;
  }

  for (const [type, count] of Object.entries(typeCounts)) {
    const icon = getTypeIcon(type as FixtureType);
    console.log(`  ${icon} ${type.padEnd(25)} ${count}`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  ✅ Total: ${fixtures.length} fixtures parseados correctamente`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
}

function getChannelIcon(type: ChannelType): string {
  switch (type) {
    case ChannelType.PAN:
    case ChannelType.PAN_FINE:
      return '↔️ ';
    case ChannelType.TILT:
    case ChannelType.TILT_FINE:
      return '↕️ ';
    case ChannelType.DIMMER:
      return '💡';
    case ChannelType.STROBE:
    case ChannelType.SHUTTER:
      return '⚡';
    case ChannelType.RED:
      return '🔴';
    case ChannelType.GREEN:
      return '🟢';
    case ChannelType.BLUE:
      return '🔵';
    case ChannelType.WHITE:
      return '⚪';
    case ChannelType.COLOR_WHEEL:
      return '🌈';
    case ChannelType.GOBO_WHEEL:
    case ChannelType.GOBO_ROTATION:
      return '🎯';
    case ChannelType.PRISM:
    case ChannelType.PRISM_ROTATION:
      return '💎';
    case ChannelType.FOCUS:
      return '🔍';
    case ChannelType.ZOOM:
      return '🔭';
    case ChannelType.FROST:
      return '❄️ ';
    default:
      return '⚙️ ';
  }
}

function getTypeIcon(type: FixtureType): string {
  switch (type) {
    case FixtureType.PAR:
      return '🔦';
    case FixtureType.MOVING_HEAD_SPOT:
      return '🎯';
    case FixtureType.MOVING_HEAD_WASH:
      return '🌊';
    case FixtureType.MOVING_HEAD_BEAM:
      return '⚡';
    case FixtureType.WASH:
      return '💧';
    case FixtureType.BEAM:
      return '🔆';
    case FixtureType.STROBE:
      return '💥';
    default:
      return '💡';
  }
}

main().catch(console.error);
