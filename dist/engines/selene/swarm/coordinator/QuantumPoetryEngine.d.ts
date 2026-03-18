export interface QuantumPoem {
    text: string;
    beauty: number;
    rhythm: string;
    timestamp: number;
}
export declare class QuantumPoetryEngine {
    private poems;
    constructor(veritas?: any);
    /**
     * Generate poetry
     */
    generate(): QuantumPoem;
    /**
     * Store poem
     */
    store(id: string, poem: QuantumPoem): void;
    /**
     * Retrieve poem
     */
    retrieve(id: string): QuantumPoem | undefined;
    /**
     * Get all poems
     */
    getAllPoems(): QuantumPoem[];
}
//# sourceMappingURL=QuantumPoetryEngine.d.ts.map