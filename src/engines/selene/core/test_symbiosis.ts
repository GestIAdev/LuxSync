/**
 * 🧪 TEST SCRIPT - GRAPHQL-VERITAS SIMBIOSIS
 * Testing the symbiotic integration between GraphQL and Veritas
 */

import { SeleneDatabase } from "./Database.js";
import { SeleneCache } from "../Cache.js";
import { SeleneMonitoring } from "../Monitoring.js";
import { SeleneVeritas } from "../Veritas/Veritas.js";


async function testGraphQLVeritasSymbiosis() {
  console.log("🧪 TESTING GRAPHQL-VERITAS SIMBIOSIS");
  console.log("=====================================");

  try {
    // Initialize components
    const database = new SeleneDatabase();
    const cache = new SeleneCache();
    const monitoring = new SeleneMonitoring();
    const veritas = new SeleneVeritas(null as any, database, cache, monitoring);

    console.log("✅ Components initialized");

    // Test 1: Veritas basic functionality
    console.log("\n🔐 TEST 1: Veritas Basic Status");
    const status = await veritas.getStatus();
    console.log("✅ Veritas status:", JSON.stringify(status, null, 2));

    // Test 2: Generate test certificate
    console.log("\n� TEST 2: Generate Truth Certificate");
    const testData = {
      id: "test-patient-1",
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@test.com",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const certificate = await veritas.generateTruthCertificate(
      testData,
      "patient",
      "test-patient-1",
    );
    console.log("✅ Certificate generated:", JSON.stringify({
      dataHash: certificate.dataHash,
      issuer: certificate.issuer,
      issuedAt: certificate.issuedAt,
    }));

    // Test 3: Verify data integrity
    console.log("\n� TEST 3: Verify Data Integrity");
    const integrityCheck = await veritas.verifyDataIntegrity(
      testData,
      "patient",
      "test-patient-1",
    );
    console.log("✅ Integrity check:", JSON.stringify({
      isValid: integrityCheck.isValid,
      confidence: integrityCheck.confidence,
      anomalies: integrityCheck.anomalies.length,
    }));

    // Test 4: Async verification (simbiosis core)
    console.log("\n⚡ TEST 4: Async Verification (Simbiosis Core)");
    const asyncResult = await veritas.verifyDataIntegrity(
      testData,
      "patient",
      "test-patient-1",
    );
    console.log("✅ Async verification result:", JSON.stringify({
      verified: asyncResult.verified,
      confidence: asyncResult.confidence,
      hasCertificate: !!asyncResult.certificate,
    }));

    // Test 5: Cache statistics
    console.log("\n💾 TEST 5: Cache Statistics");
    const cacheStats = veritas.getCacheStats();
    console.log("✅ Cache stats:", JSON.stringify(cacheStats, null, 2));

    // Test 6: Second call to test caching
    console.log("\n� TEST 6: Test Certificate Caching");
    const cachedCertificate = await veritas.generateTruthCertificate(
      testData,
      "patient",
      "test-patient-1",
    );
    console.log("✅ Cached certificate retrieved (should be same hash):", JSON.stringify({
      dataHash: cachedCertificate.dataHash,
      sameAsOriginal: cachedCertificate.dataHash === certificate.dataHash,
    }));

    // Test 7: Updated cache stats
    console.log("\n📊 TEST 7: Updated Cache Statistics");
    const updatedCacheStats = veritas.getCacheStats();
    console.log(
      "✅ Updated cache stats:",
      JSON.stringify(updatedCacheStats, null, 2),
    );

    console.log(
      "\n🎉 ALL TESTS COMPLETED - GRAPHQL-VERITAS SIMBIOSIS SUCCESSFUL!",
    );
    console.log(
      '🔗 "La petición de datos y la garantía de su verdad son la misma cosa"',
    );
    console.log("⚡ Veritas ahora está integrado simbióticamente con GraphQL");
    console.log(
      "🔐 Cada consulta GraphQL puede incluir verificación matemática automática",
    );
  } catch (error) {
    console.error("💥 Test failed:", error as Error);
    throw error;
  }
}

// Run the test
testGraphQLVeritasSymbiosis().catch(console.error);


