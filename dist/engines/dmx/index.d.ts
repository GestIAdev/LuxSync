/**
 * 💡 DMX ENGINE - INDEX
 *
 * Control de iluminación DMX512 para LuxSync
 * - TORNADO USB driver
 * - Art-Net protocol
 * - Fixture management
 * - Scene building
 */
export interface DMXPacket {
    universe: number;
    channels: number[];
}
export interface Fixture {
    id: string;
    name: string;
    type: string;
    address: number;
    channels: number;
    profile: string;
}
export declare class DMXEngine {
    initialize(): Promise<void>;
    sendPacket(packet: DMXPacket): Promise<void>;
    loadFixtures(path: string): Promise<Fixture[]>;
    close(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map