import { BaseDatabase } from './BaseDatabase.js';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';
export declare class DocumentsDatabase extends BaseDatabase {
    constructor(pool: Pool, redis?: RedisClientType, redisConnectionId?: string);
    /**
     * 📄 GET DOCUMENTS - GraphQL Migration v3.0 - FULL SCHEMA
     * ✅ MAPEO COMPLETO: snake_case DB → camelCase GraphQL
     * ✅ FULL FIELDS: Todos los campos de medical_documents incluyendo AI, @veritas, DICOM, embeddings
     */
    getDocuments(filters?: any): Promise<any[]>;
    /**
     * ➕ CREATE DOCUMENT - GraphQL Migration v3.0 - FULL SCHEMA
     * ✅ MAPEO COMPLETO: camelCase input → snake_case DB → camelCase output
     * ✅ FULL FIELDS: Todos los campos de medical_documents
     */
    createDocument(data: any): Promise<any>;
    /**
     * ✏️ UPDATE DOCUMENT - GraphQL Migration v1.0
     * ✅ MAPEO COMPLETO con lastModified (CRITICAL!)
     */
    updateDocument(id: string, data: any): Promise<any>;
    /**
     * 🗑️ DELETE DOCUMENT - GraphQL Migration v1.0
     * ✅ Soft delete
     */
    deleteDocument(id: string): Promise<boolean>;
    getDocumentsV3(args: {
        patientId?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getDocumentV3ById(id: string): Promise<any>;
    getUnifiedDocumentsV3(args: {
        patientId?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getUnifiedDocumentV3ById(id: string): Promise<any>;
    createDocumentV3(input: any): Promise<any>;
    updateDocumentV3(id: string, input: any): Promise<any>;
    deleteDocumentV3(id: string): Promise<void>;
    uploadUnifiedDocumentV3(input: any): Promise<any>;
}
//# sourceMappingURL=DocumentsDatabase.d.ts.map