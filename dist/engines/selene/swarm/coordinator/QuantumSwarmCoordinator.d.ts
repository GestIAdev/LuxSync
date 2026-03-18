export declare class QuantumSwarmCoordinator {
    constructor(_nodeId: string | any, _redis: any, _options: any);
    on(_event: string, _callback: (...args: any[]) => void): void;
    getCurrentSwarmState(): Promise<any>;
    awaken(): Promise<void>;
}
//# sourceMappingURL=QuantumSwarmCoordinator.d.ts.map