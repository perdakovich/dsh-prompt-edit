/**
 * Platform compatibility adapter for DeepSeek Harness (DSH) Host Runtime.
 *
 * Fully synchronous module evaluation (no top-level await) to guarantee clean import
 * across all bundlers, CJS/ESM interop layers, and Node.js environments.
 * Runtime capabilities are memoized lazily on first invocation.
 */

let forkSeedPromise = null;

async function getForkSeedBuilder() {
  if (forkSeedPromise) return forkSeedPromise;

  forkSeedPromise = (async () => {
    try {
      const mod = await import("@deepseek-ai/dsh-session/fork");
      return typeof mod.buildForkSeed === "function" ? mod.buildForkSeed : null;
    } catch (err) {
      // Tolerate genuine package absence in pre-0.2 runtimes; rethrow unexpected bugs/syntax defects.
      if (err?.code !== "ERR_MODULE_NOT_FOUND") {
        throw err;
      }
      return null;
    }
  })();

  return forkSeedPromise;
}

/**
 * Build a structurally valid session seed for child session initialization across DSH versions.
 *
 * @param {Array} events - Committed event log of parent session
 * @param {number|null} boundary - Target cut event seq
 * @returns {Promise<{ seed: Array, inheritedEventCount: number }>}
 */
export async function buildPlatformSeed(events, boundary) {
  if (boundary === null) {
    return { seed: [], inheritedEventCount: 0 };
  }

  const builder = await getForkSeedBuilder();
  if (typeof builder === "function") {
    // DSH 0.2.x V4 format: seals open turns with synthetic 'forked' closers and inherited marker
    return {
      seed: builder(events, boundary),
      inheritedEventCount: boundary + 1,
    };
  }

  // DSH 0.1.x V3 fallback: direct prefix slice
  const seed = events.slice(0, boundary + 1);
  return {
    seed,
    inheritedEventCount: seed.length,
  };
}

/**
 * Strict Typert codec factory with single-instance caching.
 * Satisfies both DSH 0.2 (create factory) and DSH 0.1.x (pre-instantiated schema property).
 *
 * @param {string} typeSymbol
 * @param {() => any} createSchema
 */
export function strictCodec(typeSymbol, createSchema) {
  const schema = createSchema();
  return {
    mode: "strict",
    typeSymbol,
    create: () => schema,
    schema,
  };
}
