export declare class SeleneLoadBalancer {
    private app;
    private server;
    private vitals;
    private nodes;
    private healthCheckInterval;
    constructor();
    private setupMiddleware;
    private getNextNode;
    private setupHealthChecks;
    private logLoadBalancerStatus;
    private setupRoutes;
    start(port?: number): void;
    private setupGracefulShutdown;
    stop(): void;
}
//# sourceMappingURL=LoadBalancer.d.ts.map