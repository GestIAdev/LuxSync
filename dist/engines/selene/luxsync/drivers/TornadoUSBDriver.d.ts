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
import type { DMXScene } from '../types.js';
/**
 * DMX Driver Interface
 */
export interface DMXDriver {
    initialize(): Promise<void>;
    applyScene(scene: DMXScene): Promise<void>;
    destroy(): Promise<void>;
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
            requestDevice(options: {
                filters: USBDeviceFilter[];
            }): Promise<any>;
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
export declare class TornadoUSBDriver implements DMXDriver {
    private device;
    private interface;
    private endpoint;
    private connected;
    private universe1;
    private universe2;
    private frameCount;
    private lastFrameTime;
    private targetFPS;
    private static readonly VENDOR_ID;
    private static readonly PRODUCT_ID;
    constructor(fps?: number);
    /**
     * Initialize USB connection to Tornado device
     */
    initialize(): Promise<void>;
    /**
     * Apply DMX scene to hardware
     */
    applyScene(scene: DMXScene): Promise<void>;
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
    private mapSceneToChannels;
    /**
     * Send DMX512 frame to USB device
     *
     * DMX512 protocol:
     * - Start byte: 0x00 (BREAK)
     * - 512 channel bytes (0-255)
     *
     * Total: 513 bytes
     */
    private sendDMXFrame;
    /**
     * Set target FPS for DMX output
     */
    setFPS(fps: number): void;
    /**
     * Get statistics
     */
    getStats(): {
        connected: boolean;
        frameCount: number;
        fps: number;
        universes: number;
    };
    /**
     * Disconnect from USB device
     */
    destroy(): Promise<void>;
    /**
     * Check if Tornado is connected
     */
    isConnected(): boolean;
    /**
     * Reconnect to device (if connection lost)
     */
    reconnect(): Promise<void>;
}
export {};
//# sourceMappingURL=TornadoUSBDriver.d.ts.map