/**
 * 🛡️ VERITAS CODE VALIDATOR - LA LEY DE @VERITAS
 * "Antes de que cualquier línea de código auto-generado pueda ser promovida al núcleo,
 * deberá pasar por el juicio implacable de @veritas. Si la nueva lógica viola los principios
 * matemáticos y éticos del sistema, será rechazada de forma fulminante."
 *
 * Forged by PunkClaude - Protocolo de Singularidad: "La Ley Fundamental"
 */
import { SeleneVeritas } from '../../Veritas/Veritas.js';
export interface CodeValidationRequest {
    code: string;
    generatedBy: string;
    targetSystem: string;
    context: {
        ethicalPrinciples: string[];
        mathematicalConstraints: string[];
        systemIntegrityRules: string[];
    };
    timestamp: Date;
}
export interface CodeValidationResult {
    isValid: boolean;
    confidence: number;
    certificate?: CodeCertificate;
    violations: ValidationViolation[];
    validatedAt: Date;
    validatorVersion: string;
}
export interface CodeCertificate {
    codeHash: string;
    validationHash: string;
    ethicalClearance: boolean;
    mathematicalCompliance: boolean;
    systemIntegrityVerified: boolean;
    issuedBy: '@veritas';
    issuedAt: Date;
    expiresAt: Date;
    signature: string;
}
export interface ValidationViolation {
    type: 'ethical' | 'mathematical' | 'integrity' | 'security';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    location?: {
        line: number;
        column: number;
        code: string;
    };
    recommendation: string;
}
/**
 * 🚨 VERITAS CODE VALIDATOR - La Ley Fundamental
 * Valida todo código auto-generado antes de permitir su promoción al núcleo
 */
export declare class VeritasCodeValidator {
    private veritas;
    private validatorVersion;
    private dangerousPatterns;
    constructor(veritas: SeleneVeritas);
    /**
     * ⚖️ VALIDATE CODE - La Ley de @veritas
     * Todo código auto-generado DEBE pasar esta validación antes de ser promovido
     */
    validateCode(request: CodeValidationRequest): Promise<CodeValidationResult>;
    /**
     * 🧮 VALIDACIÓN MATEMÁTICA - Veritas verifica integridad matemática
     */
    private validateMathematicalIntegrity;
    /**
     * ⚖️ VALIDACIÓN ÉTICA - Veritas verifica principios éticos
     */
    private validateEthicalCompliance;
    /**
     * 🛡️ VALIDACIÓN DE INTEGRIDAD DEL SISTEMA
     */
    private validateSystemIntegrity;
    /**
     * 🔒 VALIDACIÓN DE SEGURIDAD
     */
    private validateSecurityCompliance;
    /**
     * 📊 CALCULAR CONFIANZA GENERAL
     */
    private calculateOverallConfidence;
    /**
     * 🎯 DECISIÓN FINAL - La Ley de @veritas
     */
    private makeFinalJudgment;
    /**
     * 📜 GENERAR CERTIFICADO - Código aprobado por @veritas
     */
    private generateCodeCertificate;
    private validateMathematicalConstraint;
    private validateEthicalPrinciple;
    private validateIntegrityRule;
}
//# sourceMappingURL=VeritasCodeValidator.d.ts.map