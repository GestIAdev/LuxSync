/**
 * 📡 WAVE 2048: OPERATION "ECHO LOCATION" - Art-Net Network Discovery
 * ============================================================================
 * 
 * Chronos ya no es ciego. ArtPoll/ArtPollReply protocol implementation.
 * 
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────┐
 * │        ArtNetDiscovery (Main Process)   │
 * │  ┌──────────────────────────────────┐   │
 * │  │ UDP Socket (port 6454, shared)   │   │
 * │  └───────┬──────────────┬───────────┘   │
 * │          │              │               │
 * │    ArtPoll SEND    ArtPollReply RECV    │
 * │    (broadcast)      (unicast back)      │
 * │     every 3s        parse → store       │
 * │                                         │
 * │  ┌──────────────────────────────────┐   │
 * │  │ Discovered Nodes Map             │   │
 * │  │  IP → { name, mac, universes }   │   │
 * │  └──────────────────────────────────┘   │
 * └─────────────────────────────────────────┘
 *           │ IPC events
 *           ▼
 * ┌─────────────────────────────────────────┐
 * │        Renderer (NetIndicator.tsx)      │
 * │  NET [●] → Click → Node List Popup     │
 * └─────────────────────────────────────────┘
 * 
 * ART-NET PROTOCOL REFERENCE:
 * - ArtPoll:      OpCode 0x2000 (broadcast query)
 * - ArtPollReply: OpCode 0x2100 (node response)
 * - Port:         6454 (UDP)
 * 
 * AXIOMA ANTI-SIMULACIÓN:
 * No mocks. Real UDP packets. Real network. Real responses.
 * 
 * @module hal/drivers/ArtNetDiscovery
 * @version WAVE 2048
 */

import * as dgram from 'dgram'
import { EventEmitter } from 'events'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Discovered Art-Net node */
export interface ArtNetNode {
  /** IP address of the node */
  ip: string
  
  /** Short name (max 18 chars, from ArtPollReply) */
  shortName: string
  
  /** Long name (max 64 chars, from ArtPollReply) */
  longName: string
  
  /** MAC address (6 bytes → "XX:XX:XX:XX:XX:XX") */
  mac: string
  
  /** Firmware version */
  firmwareVersion: number
  
  /** Output universe ports (up to 4 per node) */
  outputUniverses: number[]
  
  /** Input universe ports (up to 4 per node) */
  inputUniverses: number[]
  
  /** Node style (0=StNode, 1=StController, 2=StMedia, etc.) */
  nodeStyle: number
  
  /** Last time we received ArtPollReply from this node (ms) */
  lastSeen: number
  
  /** Number of times we've seen this node respond */
  responseCount: number
}

/** Discovery state */
export type DiscoveryState = 'idle' | 'polling' | 'error'

/** Discovery events */
export interface DiscoveryEvents {
  'node-discovered': (node: ArtNetNode) => void
  'node-lost': (ip: string) => void
  'node-updated': (node: ArtNetNode) => void
  'poll-sent': () => void
  'error': (error: string) => void
  'state-change': (state: DiscoveryState) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const ARTNET_PORT = 6454
const ARTNET_HEADER = Buffer.from('Art-Net\0')

/** OpCodes */
const OPCODE_POLL = 0x2000
const OPCODE_POLL_REPLY = 0x2100

/** Poll interval (3 seconds) */
const POLL_INTERVAL_MS = 3000

/** Node timeout: if no reply in 12 seconds, consider lost */
const NODE_TIMEOUT_MS = 12000

/** Art-Net protocol version */
const PROTOCOL_VERSION = 14

/** Art-Net broadcast addresses to try */
const BROADCAST_ADDRESSES = [
  '2.255.255.255',    // Art-Net primary subnet
  '10.255.255.255',   // Art-Net secondary subnet
  '255.255.255.255',  // Global broadcast (fallback)
]

// ═══════════════════════════════════════════════════════════════════════════
// ARTPOLL PACKET BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build ArtPoll packet (12 bytes)
 * 
 * Structure:
 * [0-7]   ID: "Art-Net\0" (8 bytes)
 * [8-9]   OpCode: 0x2000 (little-endian)
 * [10-11] ProtVer: 14 (big-endian)
 * [12]    TalkToMe: 0x02 (send ArtPollReply on change)
 * [13]    Priority: 0x00 (diagnostic priority, unused)
 */
function buildArtPollPacket(): Buffer {
  const packet = Buffer.alloc(14)
  
  // Header: "Art-Net\0"
  ARTNET_HEADER.copy(packet, 0)
  
  // OpCode: 0x2000 (little-endian)
  packet.writeUInt16LE(OPCODE_POLL, 8)
  
  // Protocol Version: 14 (big-endian)
  packet.writeUInt16BE(PROTOCOL_VERSION, 10)
  
  // TalkToMe: 0x02 = Send ArtPollReply when conditions change
  packet.writeUInt8(0x02, 12)
  
  // Priority: 0x00 (not used for discovery)
  packet.writeUInt8(0x00, 13)
  
  return packet
}

// ═══════════════════════════════════════════════════════════════════════════
// ARTPOLLREPLY PARSER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse ArtPollReply packet (minimum 207 bytes)
 * 
 * Structure (key fields):
 * [0-7]     ID: "Art-Net\0"
 * [8-9]     OpCode: 0x2100 (little-endian)
 * [10-13]   IP Address (4 bytes)
 * [14-15]   Port: 0x1936 (little-endian = 6454)
 * [16-17]   VersInfo: Firmware version (big-endian)
 * [18]      NetSwitch (bits 14-8 of Port-Address)
 * [19]      SubSwitch (bits 7-4 of Port-Address)
 * [20-21]   Oem: Manufacturer code (big-endian)
 * [22]      Ubea Version
 * [23]      Status1
 * [24-25]   EstaManufacturer (little-endian)
 * [26-43]   ShortName (18 bytes, null-terminated)
 * [44-107]  LongName (64 bytes, null-terminated)
 * [108-171] NodeReport (64 bytes)
 * [172-173] NumPorts (big-endian)
 * [174-177] PortTypes (4 bytes)
 * [178-181] GoodInput (4 bytes)
 * [182-185] GoodOutput (4 bytes)
 * [186-189] SwIn (4 bytes - input universe per port)
 * [190-193] SwOut (4 bytes - output universe per port)
 * [200]     Style (node type)
 * [201-206] Mac (6 bytes)
 */
function parseArtPollReply(data: Buffer, senderIp: string): ArtNetNode | null {
  // Minimum packet size check
  if (data.length < 207) {
    return null
  }
  
  // Verify Art-Net header
  const header = data.subarray(0, 8).toString('ascii')
  if (header !== 'Art-Net\0') {
    return null
  }
  
  // Verify OpCode
  const opCode = data.readUInt16LE(8)
  if (opCode !== OPCODE_POLL_REPLY) {
    return null
  }
  
  // Parse fields
  const firmwareVersion = data.readUInt16BE(16)
  const netSwitch = data.readUInt8(18)
  const subSwitch = data.readUInt8(19)
  
  // ShortName (18 bytes, null-terminated ASCII)
  const shortName = readNullTerminatedString(data, 26, 18)
  
  // LongName (64 bytes, null-terminated ASCII)
  const longName = readNullTerminatedString(data, 44, 64)
  
  // NumPorts
  const numPorts = data.readUInt16BE(172)
  const portCount = Math.min(numPorts, 4) // Max 4 ports per node
  
  // PortTypes (4 bytes) - bit 6: can output, bit 7: can input
  // SwOut (4 bytes) - output universe for each port (bits 3-0)
  // SwIn (4 bytes) - input universe for each port (bits 3-0)
  const outputUniverses: number[] = []
  const inputUniverses: number[] = []
  
  for (let i = 0; i < portCount; i++) {
    const portType = data.readUInt8(174 + i)
    
    // Full universe address = (NetSwitch << 8) | (SubSwitch << 4) | SwOut[i]
    if (portType & 0x80) { // Can output DMX
      const swOut = data.readUInt8(190 + i)
      const universe = (netSwitch << 8) | (subSwitch << 4) | (swOut & 0x0F)
      outputUniverses.push(universe)
    }
    
    if (portType & 0x40) { // Can input DMX
      const swIn = data.readUInt8(186 + i)
      const universe = (netSwitch << 8) | (subSwitch << 4) | (swIn & 0x0F)
      inputUniverses.push(universe)
    }
  }
  
  // Style byte
  const nodeStyle = data.length > 200 ? data.readUInt8(200) : 0
  
  // MAC address (6 bytes at offset 201)
  let mac = '00:00:00:00:00:00'
  if (data.length >= 207) {
    const macBytes: string[] = []
    for (let i = 0; i < 6; i++) {
      macBytes.push(data.readUInt8(201 + i).toString(16).padStart(2, '0').toUpperCase())
    }
    mac = macBytes.join(':')
  }
  
  return {
    ip: senderIp,
    shortName,
    longName,
    mac,
    firmwareVersion,
    outputUniverses,
    inputUniverses,
    nodeStyle,
    lastSeen: Date.now(),
    responseCount: 1,
  }
}

/**
 * Read null-terminated ASCII string from buffer
 */
function readNullTerminatedString(buffer: Buffer, offset: number, maxLen: number): string {
  let end = offset
  const limit = Math.min(offset + maxLen, buffer.length)
  
  while (end < limit && buffer[end] !== 0) {
    end++
  }
  
  return buffer.subarray(offset, end).toString('ascii').trim()
}

// ═══════════════════════════════════════════════════════════════════════════
// DISCOVERY CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class ArtNetDiscovery extends EventEmitter {
  /** Discovered nodes (IP → node data) */
  private nodes: Map<string, ArtNetNode> = new Map()
  
  /** UDP socket for discovery (bound to port 6454) */
  private socket: dgram.Socket | null = null
  
  /** Poll interval timer */
  private pollTimer: NodeJS.Timeout | null = null
  
  /** Cleanup timer (remove stale nodes) */
  private cleanupTimer: NodeJS.Timeout | null = null
  
  /** Current state */
  private state: DiscoveryState = 'idle'
  
  /** Broadcast address to use */
  private broadcastAddress: string = '2.255.255.255'
  
  /** Total polls sent */
  private pollCount = 0
  
  constructor() {
    super()
    console.log('[ArtNetDiscovery] 📡 WAVE 2048: ECHO LOCATION initialized')
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Start discovery: bind socket, begin polling
   * 
   * IMPORTANT: This creates its OWN socket bound to port 6454 for LISTENING.
   * ArtNetDriver uses a separate ephemeral-port socket for SENDING DMX.
   * Both can coexist because UDP allows port reuse.
   */
  async start(): Promise<boolean> {
    if (this.socket) {
      console.warn('[ArtNetDiscovery] Already running')
      return true
    }
    
    try {
      // Create UDP socket with reuseAddr (coexist with ArtNetDriver)
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
      
      // Listen for incoming packets (ArtPollReply from nodes)
      this.socket.on('message', (msg, rinfo) => {
        this.handleIncomingPacket(msg, rinfo)
      })
      
      this.socket.on('error', (err) => {
        console.error('[ArtNetDiscovery] Socket error:', err.message)
        this.setState('error')
        this.emit('error', err.message)
      })
      
      // Bind to Art-Net port 6454 to receive ArtPollReply
      await new Promise<void>((resolve, reject) => {
        this.socket!.bind(ARTNET_PORT, () => {
          const addr = this.socket!.address()
          console.log(`[ArtNetDiscovery] ✅ Listening on port ${addr.port}`)
          resolve()
        })
        this.socket!.once('error', (err) => {
          // Port 6454 may already be in use by ArtNetDriver
          // Fallback: bind to ephemeral port and still send ArtPoll
          console.warn(`[ArtNetDiscovery] ⚠️ Port 6454 busy, binding to ephemeral port`)
          this.socket!.removeAllListeners('error')
          this.socket!.bind(undefined, () => {
            console.log(`[ArtNetDiscovery] ✅ Fallback: listening on port ${this.socket!.address().port}`)
            resolve()
          })
        })
      })
      
      // Enable broadcast
      this.socket.setBroadcast(true)
      
      // Start polling loop
      this.startPolling()
      
      // Start cleanup loop (remove stale nodes)
      this.startCleanup()
      
      this.setState('polling')
      console.log('[ArtNetDiscovery] 📡 Discovery ACTIVE')
      
      return true
    } catch (error) {
      console.error('[ArtNetDiscovery] Failed to start:', error)
      this.setState('error')
      return false
    }
  }
  
  /**
   * Stop discovery: close socket, clear timers
   */
  async stop(): Promise<void> {
    // Clear timers
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    
    // Close socket
    if (this.socket) {
      return new Promise((resolve) => {
        this.socket!.close(() => {
          this.socket = null
          this.setState('idle')
          console.log('[ArtNetDiscovery] 🛑 Discovery stopped')
          resolve()
        })
      })
    }
    
    this.setState('idle')
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // POLLING
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Start periodic ArtPoll broadcasting
   */
  private startPolling(): void {
    // Send first poll immediately
    this.sendArtPoll()
    
    // Then every POLL_INTERVAL_MS
    this.pollTimer = setInterval(() => {
      this.sendArtPoll()
    }, POLL_INTERVAL_MS)
  }
  
  /**
   * Send ArtPoll packet to broadcast address
   */
  private sendArtPoll(): void {
    if (!this.socket) return
    
    const packet = buildArtPollPacket()
    
    // Send to primary broadcast address
    this.socket.send(packet, 0, packet.length, ARTNET_PORT, this.broadcastAddress, (err) => {
      if (err) {
        // Try fallback broadcast
        this.socket?.send(packet, 0, packet.length, ARTNET_PORT, '255.255.255.255', (err2) => {
          if (err2) {
            console.warn('[ArtNetDiscovery] ⚠️ ArtPoll send failed:', err2.message)
          }
        })
      }
    })
    
    this.pollCount++
    this.emit('poll-sent')
  }
  
  /**
   * Start cleanup loop to remove stale nodes
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      const staleIps: string[] = []
      
      for (const [ip, node] of this.nodes) {
        if (now - node.lastSeen > NODE_TIMEOUT_MS) {
          staleIps.push(ip)
        }
      }
      
      for (const ip of staleIps) {
        this.nodes.delete(ip)
        console.log(`[ArtNetDiscovery] 💀 Node lost: ${ip}`)
        this.emit('node-lost', ip)
      }
    }, NODE_TIMEOUT_MS / 2) // Check every 6 seconds
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PACKET HANDLING
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Handle incoming UDP packet
   */
  private handleIncomingPacket(data: Buffer, rinfo: dgram.RemoteInfo): void {
    // Quick header check
    if (data.length < 10) return
    
    const header = data.subarray(0, 8).toString('ascii')
    if (header !== 'Art-Net\0') return
    
    const opCode = data.readUInt16LE(8)
    
    if (opCode === OPCODE_POLL_REPLY) {
      this.handlePollReply(data, rinfo)
    }
    // Other opcodes (ArtDmx, etc.) are ignored here
  }
  
  /**
   * Process ArtPollReply
   */
  private handlePollReply(data: Buffer, rinfo: dgram.RemoteInfo): void {
    const node = parseArtPollReply(data, rinfo.address)
    
    if (!node) {
      console.warn(`[ArtNetDiscovery] ⚠️ Malformed ArtPollReply from ${rinfo.address}`)
      return
    }
    
    const existing = this.nodes.get(node.ip)
    
    if (existing) {
      // Update existing node
      existing.shortName = node.shortName
      existing.longName = node.longName
      existing.mac = node.mac
      existing.firmwareVersion = node.firmwareVersion
      existing.outputUniverses = node.outputUniverses
      existing.inputUniverses = node.inputUniverses
      existing.nodeStyle = node.nodeStyle
      existing.lastSeen = Date.now()
      existing.responseCount++
      
      this.emit('node-updated', existing)
    } else {
      // New node discovered!
      node.lastSeen = Date.now()
      this.nodes.set(node.ip, node)
      
      console.log(`[ArtNetDiscovery] 🆕 Node discovered: ${node.shortName} (${node.ip}) [${node.outputUniverses.length} out, ${node.inputUniverses.length} in]`)
      this.emit('node-discovered', node)
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Get all discovered nodes (snapshot)
   */
  getNodes(): ArtNetNode[] {
    return Array.from(this.nodes.values())
  }
  
  /**
   * Get node count
   */
  getNodeCount(): number {
    return this.nodes.size
  }
  
  /**
   * Get discovery state
   */
  getState(): DiscoveryState {
    return this.state
  }
  
  /**
   * Set broadcast address (default: 2.255.255.255)
   */
  setBroadcastAddress(address: string): void {
    this.broadcastAddress = address
    console.log(`[ArtNetDiscovery] 📡 Broadcast address: ${address}`)
  }
  
  /**
   * Force immediate poll (user-triggered refresh)
   */
  pollNow(): void {
    this.sendArtPoll()
  }
  
  /**
   * Get full status for IPC
   */
  getStatus(): {
    state: DiscoveryState
    nodeCount: number
    nodes: ArtNetNode[]
    pollCount: number
    broadcastAddress: string
  } {
    return {
      state: this.state,
      nodeCount: this.nodes.size,
      nodes: this.getNodes(),
      pollCount: this.pollCount,
      broadcastAddress: this.broadcastAddress,
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL
  // ═══════════════════════════════════════════════════════════════════════════
  
  private setState(newState: DiscoveryState): void {
    if (this.state !== newState) {
      this.state = newState
      this.emit('state-change', newState)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let discoveryInstance: ArtNetDiscovery | null = null

export function getArtNetDiscovery(): ArtNetDiscovery {
  if (!discoveryInstance) {
    discoveryInstance = new ArtNetDiscovery()
  }
  return discoveryInstance
}

export default ArtNetDiscovery
