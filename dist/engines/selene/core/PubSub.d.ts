/**
 * 🔥 SELENE SONG CORE PUBSUB SYSTEM
 * By PunkClaude & RaulVisionario - September 23, 2025
 *
 * MISSION: Real-time PubSub system for GraphQL subscriptions
 * TARGET: WebSocket-based real-time updates with Veritas protection
 */
export declare class SelenePubSub {
    private pubsub;
    private veritas;
    private monitoring;
    private activeSubscriptions;
    private connectionCount;
    constructor(veritas: any, monitoring: any);
    /**
     * 📡 Publish event with Veritas validation
     */
    publish(topic: string, _payload: any): Promise<void>;
    /**
     * 🔔 Get async iterator for subscriptions
     */
    asyncIterator(topics: string | string[]): any;
    /**
     * 🔐 Apply Veritas validation to subscription payloads
     */
    private applyVeritasValidation;
    /**
     * 📊 Update subscription metrics
     */
    private updateMetrics;
    /**
     * 🔍 Get data type from topic
     */
    private getDataTypeFromTopic;
    /**
     * 🛡️ Get Veritas level from topic
     */
    private getVeritasLevelFromTopic;
    /**
     * 📈 Get subscription statistics
     */
    getStats(): any;
    /**
     * 🔌 Track WebSocket connection
     */
    trackConnection(_connected: boolean): void;
    /**
     * 🧹 Cleanup inactive subscriptions
     */
    cleanup(): void;
}
export default SelenePubSub;
//# sourceMappingURL=PubSub.d.ts.map