/**
 * 🔬 WAVE 2543: ART-NET PROBE — Test directo al hardware
 * 
 * Envía ArtDmx raw con pan/tilt del EL 1140 (addr50, universe 0 y 1)
 * para diagnosticar si la IMC responde independientemente de LuxSync.
 *
 * Uso: node scripts/artnet-probe.mjs
 */

import dgram from 'dgram'

const TARGET_IP = '10.0.0.10'
const ARTNET_PORT = 6454

// EL 1140 patch: addr50, 13 canales
const FIXTURE_ADDR = 50   // DMX address (1-based)
const DMX_CHANNELS = 512

// Valores de prueba: pan=128 (centro), tilt=128 (centro), speed=0 (max speed), dimmer=200
const PAN   = 200   // ch0  → DMX addr 50
const TILT  = 200   // ch1  → DMX addr 51
const SPEED = 0     // ch4  → DMX addr 54 (0 = máxima velocidad)
const DIMMER = 200  // ch5  → DMX addr 55

function buildArtDmxPacket(universe, dmxData) {
  const header = Buffer.from('Art-Net\0')
  const packet = Buffer.alloc(18 + DMX_CHANNELS, 0)
  
  header.copy(packet, 0)
  packet.writeUInt16LE(0x5000, 8)   // OpCode ArtDmx
  packet.writeUInt16BE(14, 10)       // Protocol version
  packet.writeUInt8(1, 12)           // Sequence
  packet.writeUInt8(0, 13)           // Physical
  packet.writeUInt8(universe & 0xFF, 14)     // SubUni
  packet.writeUInt8((universe >> 8) & 0x7F, 15) // Net
  packet.writeUInt16BE(DMX_CHANNELS, 16)     // Length

  // Escribir valores en el buffer DMX (addr es 1-based, buffer es 0-based)
  const base = FIXTURE_ADDR - 1
  packet[18 + base + 0] = PAN
  packet[18 + base + 1] = TILT
  packet[18 + base + 2] = 0      // Pan Fine
  packet[18 + base + 3] = 0      // Tilt Fine
  packet[18 + base + 4] = SPEED
  packet[18 + base + 5] = DIMMER
  packet[18 + base + 6] = 0      // Strobe
  packet[18 + base + 7] = 0      // Color Wheel (0 = white/open)
  packet[18 + base + 8] = 0      // Gobo
  packet[18 + base + 9] = 0      // Prism

  return packet
}

function buildArtPoll() {
  const packet = Buffer.alloc(14, 0)
  Buffer.from('Art-Net\0').copy(packet, 0)
  packet.writeUInt16LE(0x2000, 8)   // OpCode ArtPoll
  packet.writeUInt16BE(14, 10)       // Protocol version
  packet.writeUInt8(0x02, 12)        // TalkToMe
  packet.writeUInt8(0x00, 13)        // Priority
  return packet
}

const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

socket.bind(ARTNET_PORT, '0.0.0.0', () => {
  socket.setBroadcast(true)
  console.log(`✅ Socket bound to port ${ARTNET_PORT}`)
  console.log(`🎯 Target: ${TARGET_IP}:${ARTNET_PORT}`)
  console.log(`📍 EL 1140 @ addr${FIXTURE_ADDR} | PAN=${PAN} TILT=${TILT} DIMMER=${DIMMER}`)
  console.log(``)
  console.log(`Probando universe 0 y universe 1 alternativamente...`)
  console.log(`Si el mover se mueve, el universe correcto es el que responde.`)
  console.log(``)

  // Escuchar ArtPollReply
  socket.on('message', (msg, rinfo) => {
    if (msg.length >= 10 && msg.toString('ascii', 0, 7) === 'Art-Net') {
      const opcode = msg.readUInt16LE(8)
      if (opcode === 0x2100) {
        console.log(`🟢 ArtPollReply from ${rinfo.address}:${rinfo.port} — IMC ESTÁ VIVA`)
      }
    }
  })

  // Enviar ArtPoll primero
  const poll = buildArtPoll()
  socket.send(poll, ARTNET_PORT, TARGET_IP, () => console.log(`📡 ArtPoll → ${TARGET_IP}`))

  let frameCount = 0
  let currentUniverse = 0

  const interval = setInterval(() => {
    frameCount++

    // Alternar universe cada 2 segundos (88 frames @ ~44Hz-ish)
    if (frameCount % 88 === 0) {
      currentUniverse = currentUniverse === 0 ? 1 : 0
      console.log(`🔄 Cambiando a universe ${currentUniverse}`)
    }

    const dmxPacket = buildArtDmxPacket(currentUniverse, null)
    socket.send(dmxPacket, ARTNET_PORT, TARGET_IP, (err) => {
      if (err) console.error(`❌ Send error: ${err.message}`)
    })

    // Log cada ~2 segundos
    if (frameCount % 44 === 0) {
      console.log(`📤 Frame #${frameCount} | U${currentUniverse} | addr${FIXTURE_ADDR} PAN=${PAN} TILT=${TILT}`)
    }

    // Reenviar ArtPoll cada 5 segundos
    if (frameCount % 220 === 0) {
      socket.send(poll, ARTNET_PORT, TARGET_IP, () => {})
      // También broadcast
      const parts = TARGET_IP.split('.')
      const broadcast = `${parts[0]}.${parts[1]}.${parts[2]}.255`
      socket.send(poll, ARTNET_PORT, broadcast, () => {})
    }

    // Parar después de 30 segundos
    if (frameCount >= 1320) {
      clearInterval(interval)
      console.log(`\n✅ Probe completado. ${frameCount} frames enviados.`)
      socket.close()
    }
  }, 23)  // ~44Hz
})

socket.on('error', (err) => {
  console.error(`❌ Socket error: ${err.message}`)
  process.exit(1)
})

process.on('SIGINT', () => {
  clearInterval
  socket.close()
  console.log('\n🛑 Probe detenido.')
  process.exit(0)
})
