/**
 * 🔐 SELENE SONG CORE WEBSOCKET AUTHENTICATION
 * By PunkClaude & RaulVisionario - September 23, 2025
 *
 * MISSION: Secure WebSocket connections for GraphQL subscriptions
 * TARGET: JWT-based authentication with role-based access control
 */
export interface WebSocketAuthContext {
    user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
    };
    isAuthenticated: boolean;
    connectionId: string;
}
export declare class WebSocketAuth {
    private monitoring;
    private jwtSecret;
    private activeConnections;
    constructor(monitoring: any);
    /**
     * 🔍 Authenticate WebSocket connection
     */
    authenticateConnection(_connectionParams: any): Promise<WebSocketAuthContext>;
    /**
     * 🚪 Handle connection disconnect
     */
    handleDisconnect(connectionId: string): void;
    /**
     * 🛡️ Check subscription permissions
     */
    checkSubscriptionPermission(authContext: WebSocketAuthContext, subscriptionName: string): boolean;
    /**
     * 📊 Get active connections stats
     */
    getActiveConnectionsStats(): any;
    /**
     * 🔧 Extract auth token from connection parameters
     */
    private extractAuthToken;
    /**
     * 🔐 Verify JWT token
     */
    private verifyJWTToken;
    /**
     * 🆔 Generate unique connection ID
     */
    private generateConnectionId;
    /**
     * 👤 Create unauthenticated context
     */
    private createUnauthenticatedContext;
    /**
     * 🌐 Check if subscription is public
     */
    private isPublicSubscription;
    /**
     * 🔒 Check subscription permissions based on role
     */
    private hasSubscriptionPermission;
}
export default WebSocketAuth;
//# sourceMappingURL=WebSocketAuth.d.ts.map