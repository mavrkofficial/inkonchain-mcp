const SERVICE = 'inkonchain-mcp';
const ACCOUNT = 'evm-private-key';

let _cached: string | null | undefined = undefined;

// keytar is a CJS module; dynamic import wraps it under .default in ESM
async function loadKeytar() {
  const mod = await import('keytar');
  return (mod as unknown as { default: typeof mod }).default ?? mod;
}

/**
 * Get the EVM private key. Priority:
 * 1. EVM_PRIVATE_KEY env var (allows override / server deployments)
 * 2. OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
 *
 * Also checks the legacy `moltiverse-mcp` keychain service as a fallback so
 * existing users migrating from moltiverse-mcp don't have to re-run setup.
 */
export async function getPrivateKey(): Promise<string | null> {
  if (_cached !== undefined) return _cached;

  const envKey = process.env.EVM_PRIVATE_KEY;
  if (envKey) {
    _cached = envKey;
    return _cached;
  }

  try {
    const keytar = await loadKeytar();
    // Primary: inkonchain-mcp service
    _cached = await keytar.getPassword(SERVICE, ACCOUNT);
    // Fallback: legacy moltiverse-mcp service (for smooth migration)
    if (!_cached) {
      _cached = await keytar.getPassword('moltiverse-mcp', ACCOUNT);
    }
  } catch {
    _cached = null;
  }

  return _cached;
}

export async function storePrivateKey(key: string): Promise<void> {
  const keytar = await loadKeytar();
  await keytar.setPassword(SERVICE, ACCOUNT, key);
  // Invalidate the in-memory cache so the next getPrivateKey() re-resolves to the
  // newly stored key. Without this, a wallet_create within a running server would
  // keep signing as the previously cached wallet until the process restarts.
  _cached = undefined;
}

export async function deletePrivateKey(): Promise<void> {
  const keytar = await loadKeytar();
  await keytar.deletePassword(SERVICE, ACCOUNT);
  _cached = undefined; // invalidate cache so the next read re-resolves
}
