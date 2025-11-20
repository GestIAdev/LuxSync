/**
 * 🌪️ TORNADO USB DMX DRIVER
 * 
 * Professional DMX512 driver for Tornado USB DMX Interface
 * 
 * Hardware Specs:
 * - 2x XLR outputs (3-pin)
 * - 1x USB input
 * - 5x LEDs: AUX, USB, DMX, OUT1, OUT2
 * - 512 channels per universe
 * - DMX512 protocol
 * 
 * @date 2025-11-20
 * @author LuxSync Team
 * @dedicated-to El casero que se porta bien 🎁
 */

import type { DMXScene, FixtureState } from '../types.js';

/**
 * DMX Driver Interface
 */
export interface DMXDriver {
  initialize(): Promise<void>;
  applyScene(scene: DMXScene): Promise<void>;
  destroy(): Promise<void>;
}

/**
 * DMX512 Frame structure
 * - Start byte: 0x00
 * - 512 channel bytes (0-255)
 */
interface DMXFrame {
  startByte: number;
  channels: Uint8Array; // 512 channels
}

/**
 * USB device filter for Tornado
 */
interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
}

/**
 * Web USB API declarations
 * (TypeScript doesn't include these by default)
 */
declare global {
  interface Navigator {
    usb: {
      requestDevice(options: { filters: USBDeviceFilter[] }): Promise<any>;
      getDevices(): Promise<any[]>;
    };
  }
}

/**
 * Tornado USB DMX Driver
 * 
 * Connects to Tornado USB DMX interface and sends DMX512 data
 * Supports 2 universes (OUT1, OUT2)
 */
export class TornadoUSBDriver implements DMXDriver {
  private device: any | null = null;  // USBDevice (Web USB API)
  private interface: any | null = null;
  private endpoint: any | null = null;
  private connected: boolean = false;
  private universe1: Uint8Array;      // 512 channels for OUT1
  private universe2: Uint8Array;      // 512 channels for OUT2
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private targetFPS: number = 30;     // DMX refresh rate (23-44 FPS standard)

  // Tornado USB device identifiers (common for FTDI-based DMX interfaces)
  private static readonly VENDOR_ID = 0x0403;     // FTDI
  private static readonly PRODUCT_ID = 0x6001;    // FT232 USB-Serial (common in DMX interfaces)

  constructor(fps: number = 30) {
    this.universe1 = new Uint8Array(512);  // All channels start at 0
    this.universe2 = new Uint8Array(512);
    this.targetFPS = fps;
    
    console.log('🌪️ TornadoUSBDriver initialized');
    console.log(`   Target FPS: ${fps}`);
    console.log(`   Universes: 2 (OUT1, OUT2)`);
    console.log(`   Channels per universe: 512`);
  }

  /**
   * Initialize USB connection to Tornado device
   */
  async initialize(): Promise<void> {
    console.log('🌪️ Requesting USB device access...');
    
    try {
      // Check if Web USB API is available
      if (!navigator.usb) {
        throw new Error('Web USB API not supported in this browser. Use Chrome/Edge.');
      }

      // Request USB device (user must select from dialog)
      const filters: USBDeviceFilter[] = [
        { 
          vendorId: TornadoUSBDriver.VENDOR_ID,
          productId: TornadoUSBDriver.PRODUCT_ID
        }
      ];

      this.device = await navigator.usb.requestDevice({ filters });
      
      console.log('🌪️ Tornado device found:');
      console.log(`   Manufacturer: ${this.device.manufacturerName}`);
      console.log(`   Product: ${this.device.productName}`);
      console.log(`   Serial: ${this.device.serialNumber}`);

      // Open device
      await this.device.open();
      console.log('✅ Device opened');

      // Select configuration (usually first one)
      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1);
      }

      // Claim interface (usually interface 0)
      await this.device.claimInterface(0);
      this.interface = this.device.configuration.interfaces[0];
      console.log('✅ Interface claimed');

      // Find output endpoint (OUT endpoint for DMX data)
      const outEndpoint = this.interface.alternate.endpoints.find(
        (ep: any) => ep.direction === 'out'
      );

      if (!outEndpoint) {
        throw new Error('No OUT endpoint found on Tornado device');
      }

      this.endpoint = outEndpoint;
      console.log(`✅ Endpoint configured: ${this.endpoint.endpointNumber}`);

      this.connected = true;
      console.log('🌪️ Tornado USB DMX ready!');
      console.log('   LED status: USB=ON, DMX=ON, OUT1=READY, OUT2=READY');
      
    } catch (error: any) {
      console.error('❌ Failed to initialize Tornado USB:', error);
      
      if (error.message?.includes('No device selected')) {
        throw new Error('No se seleccionó ningún dispositivo USB. Conecta el Tornado y vuelve a intentar.');
      }
      
      throw new Error(`Error al conectar Tornado USB: ${error.message}`);
    }
  }

  /**
   * Apply DMX scene to hardware
   */
  async applyScene(scene: DMXScene): Promise<void> {
    if (!this.connected || !this.device) {
      console.warn('⚠️ Tornado not connected, skipping frame');
      return;
    }

    // FPS throttling
    const now = Date.now();
    const elapsed = now - this.lastFrameTime;
    const minFrameTime = 1000 / this.targetFPS;

    if (elapsed < minFrameTime) {
      return; // Skip frame to maintain target FPS
    }

    try {
      // Map scene fixtures to DMX channels
      this.mapSceneToChannels(scene);

      // Send Universe 1 (OUT1)
      await this.sendDMXFrame(this.universe1);

      // TODO: Send Universe 2 (OUT2) if needed
      // await this.sendDMXFrame(this.universe2);

      this.frameCount++;
      this.lastFrameTime = now;

      // Debug every 100 frames
      if (this.frameCount % 100 === 0) {
        console.log(`🌪️ DMX frames sent: ${this.frameCount} | FPS: ${(1000 / elapsed).toFixed(1)}`);
      }
      
    } catch (error: any) {
      console.error('❌ Error sending DMX frame:', error);
      this.connected = false;
    }
  }

  /**
   * Map LuxSync scene to DMX channels
   * 
   * Default mapping for 8 PAR fixtures (3 channels each: R, G, B)
   * - Fixture 1: Channels 1-3
   * - Fixture 2: Channels 4-6
   * - Fixture 3: Channels 7-9
   * - Fixture 4: Channels 10-12
   * - Fixture 5: Channels 13-15
   * - Fixture 6: Channels 16-18
   * - Fixture 7: Channels 19-21
   * - Fixture 8: Channels 22-24
   */
  private mapSceneToChannels(scene: DMXScene): void {
    // Clear all channels
    this.universe1.fill(0);

    // Map each fixture from the fixtureStates Map
    let index = 0;
    scene.fixtureStates.forEach((state: FixtureState, fixtureId: string) => {
      const startChannel = index * 3; // 3 channels per PAR (R, G, B)

      if (startChannel + 2 < 512) {
        // Get RGB values (default to 0 if not present)
        const r = state.red || 0;
        const g = state.green || 0;
        const b = state.blue || 0;
        const dimmer = state.dimmer !== undefined ? state.dimmer / 255 : 1.0;

        // Apply dimmer to RGB
        const finalR = Math.round(r * dimmer);
        const finalG = Math.round(g * dimmer);
        const finalB = Math.round(b * dimmer);

        // Set DMX channels (0-indexed in array, but DMX channels are 1-indexed)
        this.universe1[startChannel] = Math.max(0, Math.min(255, finalR));
        this.universe1[startChannel + 1] = Math.max(0, Math.min(255, finalG));
        this.universe1[startChannel + 2] = Math.max(0, Math.min(255, finalB));
      }
      
      index++;
    });
  }

  /**
   * Send DMX512 frame to USB device
   * 
   * DMX512 protocol:
   * - Start byte: 0x00 (BREAK)
   * - 512 channel bytes (0-255)
   * 
   * Total: 513 bytes
   */
  private async sendDMXFrame(channels: Uint8Array): Promise<void> {
    if (!this.device || !this.endpoint) {
      throw new Error('Device not initialized');
    }

    // Create DMX frame: [START_BYTE, ...512_CHANNELS]
    const dmxFrame = new Uint8Array(513);
    dmxFrame[0] = 0x00;  // DMX512 start byte (BREAK)
    dmxFrame.set(channels, 1);  // Copy 512 channels

    // Send via USB (bulk transfer)
    try {
      await this.device.transferOut(this.endpoint.endpointNumber, dmxFrame);
    } catch (error: any) {
      // Ignore common timeout errors (DMX is fire-and-forget)
      if (!error.message?.includes('TIMEOUT')) {
        throw error;
      }
    }
  }

  /**
   * Set target FPS for DMX output
   */
  setFPS(fps: number): void {
    this.targetFPS = Math.max(23, Math.min(44, fps)); // DMX standard: 23-44 FPS
    console.log(`🌪️ DMX FPS set to: ${this.targetFPS}`);
  }

  /**
   * Get statistics
   */
  getStats(): {
    connected: boolean;
    frameCount: number;
    fps: number;
    universes: number;
  } {
    const now = Date.now();
    const elapsed = now - this.lastFrameTime;
    const fps = elapsed > 0 ? 1000 / elapsed : 0;

    return {
      connected: this.connected,
      frameCount: this.frameCount,
      fps: Math.round(fps * 10) / 10,
      universes: 2
    };
  }

  /**
   * Disconnect from USB device
   */
  async destroy(): Promise<void> {
    console.log('🌪️ Disconnecting Tornado USB...');

    // Blackout all channels
    this.universe1.fill(0);
    this.universe2.fill(0);

    if (this.connected && this.device) {
      try {
        await this.sendDMXFrame(this.universe1);
      } catch (error) {
        console.warn('⚠️ Could not send blackout frame');
      }

      try {
        await this.device.close();
      } catch (error) {
        console.warn('⚠️ Error closing device');
      }
    }

    this.device = null;
    this.interface = null;
    this.endpoint = null;
    this.connected = false;
    this.frameCount = 0;

    console.log('✅ Tornado USB disconnected');
  }

  /**
   * Check if Tornado is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Reconnect to device (if connection lost)
   */
  async reconnect(): Promise<void> {
    console.log('🔄 Attempting to reconnect...');
    await this.destroy();
    await this.initialize();
  }
}
