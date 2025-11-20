/**
 * 🔐 SELENE SONG CORE WEBSOCKET AUTHENTICATION
 * By PunkClaude & RaulVisionario - September 23, 2025
 *
 * MISSION: Secure WebSocket connections for GraphQL subscriptions
 * TARGET: JWT-based authentication with role-based access control
 */

import * as jwt from "jsonwebtoken";

// import { MonitoringOrchestrator } from "../Monitoring/MonitoringOrchestrator.js";

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

export class WebSocketAuth {
  private monitoring: any; // MonitoringOrchestrator;
  private jwtSecret: string =
    process.env.JWT_SECRET || "selene-secret-key";
  private activeConnections: Map<string, WebSocketAuthContext> = new Map();

  constructor(monitoring: any) {
    this.monitoring = monitoring;
    console.log("🔐 WebSocket Authentication initialized");
  }

  /**
   * 🔍 Authenticate WebSocket connection
   */
  async authenticateConnection(
    _connectionParams: any,
  ): Promise<WebSocketAuthContext> {
    const connectionId = this.generateConnectionId();
    console.log(`🔍 Authenticating WebSocket connection: ${connectionId}`);

    try {
      // Extract authentication token
      const authToken = this.extractAuthToken(_connectionParams);

      if (!authToken) {
        console.log(
          `⚠️ No auth token provided for connection: ${connectionId}`,
        );
        return this.createUnauthenticatedContext(connectionId);
      }

      // Verify JWT token
      const decoded = this.verifyJWTToken(authToken);

      if (!decoded) {
        console.log(`❌ Invalid JWT token for connection: ${connectionId}`);
        this.monitoring.logError(
          "WebSocket authentication failed",
          new Error("Invalid JWT token"),
          {
            connectionId,
            tokenProvided: !!authToken,
          },
        );
        return this.createUnauthenticatedContext(connectionId);
      }

      // Create authenticated context
      const authContext: WebSocketAuthContext = {
        user: {
          id: decoded.userId || decoded.id,
          email: decoded.email,
          role: decoded.role || "user",
          permissions: decoded.permissions || ["read"],
        },
        isAuthenticated: true,
        connectionId,
      };

      // Store active connection
      this.activeConnections.set(connectionId, authContext);

      console.log(
        `✅ WebSocket connection authenticated: ${connectionId}, user: ${authContext.user?.email}`,
      );
      this.monitoring.logMetric("websocket_auth_success", 1, {
        connectionId,
        userId: authContext.user?.id,
        role: authContext.user?.role,
      });

      return authContext;
    } catch (error) {
      console.error(
        `💥 WebSocket authentication error for ${connectionId}:`,
        error,
      );
      this.monitoring.logError(
        "WebSocket authentication error",
        error as Error,
        {
          connectionId,
        },
      );
      return this.createUnauthenticatedContext(connectionId);
    }
  }

  /**
   * 🚪 Handle connection disconnect
   */
  handleDisconnect(connectionId: string): void {
    console.log(`🚪 WebSocket connection disconnected: ${connectionId}`);
    this.activeConnections.delete(connectionId);
  }

  /**
   * 🛡️ Check subscription permissions
   */
  checkSubscriptionPermission(
    authContext: WebSocketAuthContext,
    subscriptionName: string,
  ): boolean {
    // If not authenticated, only allow public subscriptions
    if (!authContext.isAuthenticated) {
      return this.isPublicSubscription(subscriptionName);
    }

    // Check role-based permissions
    const userRole = authContext.user?.role || "user";
    const permissions = authContext.user?.permissions || [];

    return this.hasSubscriptionPermission(
      userRole,
      permissions,
      subscriptionName,
    );
  }

  /**
   * 📊 Get active connections stats
   */
  getActiveConnectionsStats(): any {
    const connections = Array.from(this.activeConnections.values());
    const authenticated = connections.filter((_c) => _c.isAuthenticated).length;
    const unauthenticated = connections.filter(
      (_c) => !_c.isAuthenticated,
    ).length;

    return {
      total: connections.length,
      authenticated,
      unauthenticated,
      connections: connections.map((c) => ({
        id: c.connectionId,
        authenticated: c.isAuthenticated,
        user: c.user ? { id: c.user.id, role: c.user.role } : null,
      })),
    };
  }

  /**
   * 🔧 Extract auth token from connection parameters
   */
  private extractAuthToken(connectionParams: any): string | null {
    // Try different common parameter names
    return (
      connectionParams?.authorization ||
      connectionParams?.authToken ||
      connectionParams?.token ||
      connectionParams?.["Authorization"] ||
      null
    );
  }

  /**
   * 🔐 Verify JWT token
   */
  private verifyJWTToken(_token: string): any {
    try {
      // Remove 'Bearer ' prefix if present
      const cleanToken = _token.replace(/^Bearer\s+/i, "");
      return jwt.verify(cleanToken, this.jwtSecret);
    } catch (error) {
      console.error("JWT verification failed:", error as Error);
      return null;
    }
  }

  /**
   * 🆔 Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `ws_${Date.now()}`; // Deterministic connection ID generation
  }

  /**
   * 👤 Create unauthenticated context
   */
  private createUnauthenticatedContext(
    _connectionId: string,
  ): WebSocketAuthContext {
    return {
      isAuthenticated: false,
      connectionId: _connectionId,
    };
  }

  /**
   * 🌐 Check if subscription is public
   */
  private isPublicSubscription(_subscriptionName: string): boolean {
    const publicSubscriptions = [
      "nuclearStatusUpdated",
      "nuclearHealthChanged",
    ];

    return publicSubscriptions.includes(_subscriptionName);
  }

  /**
   * 🔒 Check subscription permissions based on role
   */
  private hasSubscriptionPermission(
    role: string,
    _permissions: string[],
    subscriptionName: string,
  ): boolean {
    // Admin has access to everything
    if (role === "admin") {
      return true;
    }

    // Doctor role permissions
    if (role === "doctor") {
      const doctorAllowed = [
        "patientCreated",
        "patientUpdated",
        "appointmentCreated",
        "appointmentUpdated",
        "appointmentV3Created",
        "appointmentV3Updated",
        "medicalRecordCreated",
        "medicalRecordV3Created",
        "medicalRecordV3Updated",
        "treatmentCreated",
        "treatmentV3Created",
        "treatmentV3Updated",
      ];
      return doctorAllowed.includes(subscriptionName);
    }

    // Nurse role permissions
    if (role === "nurse") {
      const nurseAllowed = [
        "patientUpdated",
        "appointmentCreated",
        "appointmentUpdated",
        "appointmentV3Created",
        "appointmentV3Updated",
      ];
      return nurseAllowed.includes(subscriptionName);
    }

    // Receptionist role permissions
    if (role === "receptionist") {
      const receptionistAllowed = [
        "appointmentCreated",
        "appointmentUpdated",
        "appointmentV3Created",
        "appointmentV3Updated",
      ];
      return receptionistAllowed.includes(subscriptionName);
    }

    // Default user permissions
    const userAllowed = [
      "appointmentStatusChanged", // Only their own appointments
    ];

    return (
      userAllowed.includes(subscriptionName) && _permissions.includes("read")
    );
  }
}

export default WebSocketAuth;


