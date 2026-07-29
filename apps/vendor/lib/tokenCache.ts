import * as SecureStore from "expo-secure-store";

/**
 * A replacement for @clerk/expo/token-cache's default implementation.
 *
 * That default calls `SecureStore.setItemAsync(key, token)` directly with no
 * size check. Android's SecureStore (Keystore-backed) hard-caps a single
 * item at 2048 bytes — iOS's Keychain has no such limit. This chunks any
 * value over that across multiple keys so a large token (this app's JWTs
 * carry organization claims — o.id/o.rol/o.slg/o.per — on top of the usual
 * session claims) can't silently fail to persist.
 */
const CHUNK_SIZE = 1800; // safety margin under Android's 2048-byte limit
const CHUNK_COUNT_SUFFIX = "_chunk_count";

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

async function getChunkCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`, secureStoreOptions);
  return raw ? parseInt(raw, 10) : 0;
}

async function deleteAllVariants(key: string, chunkCount: number): Promise<void> {
  await SecureStore.deleteItemAsync(key, secureStoreOptions).catch(() => {});
  await SecureStore.deleteItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`, secureStoreOptions).catch(() => {});
  for (let i = 0; i < chunkCount; i++) {
    await SecureStore.deleteItemAsync(`${key}_${i}`, secureStoreOptions).catch(() => {});
  }
}

export const tokenCache = {
  getToken: async (key: string): Promise<string | null> => {
    try {
      const chunkCount = await getChunkCount(key);
      if (chunkCount === 0) {
        return await SecureStore.getItemAsync(key, secureStoreOptions);
      }
      const parts: string[] = [];
      for (let i = 0; i < chunkCount; i++) {
        const part = await SecureStore.getItemAsync(`${key}_${i}`, secureStoreOptions);
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join("");
    } catch {
      return null;
    }
  },

  saveToken: async (key: string, token: string): Promise<void> => {
    const previousChunkCount = await getChunkCount(key);
    await deleteAllVariants(key, previousChunkCount);

    if (token.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, token, secureStoreOptions);
      return;
    }

    const chunks: string[] = [];
    for (let i = 0; i < token.length; i += CHUNK_SIZE) {
      chunks.push(token.slice(i, i + CHUNK_SIZE));
    }
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}_${i}`, chunks[i]!, secureStoreOptions);
    }
    await SecureStore.setItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`, String(chunks.length), secureStoreOptions);
  },

  clearToken: async (key: string): Promise<void> => {
    const chunkCount = await getChunkCount(key);
    await deleteAllVariants(key, chunkCount);
  },
};
