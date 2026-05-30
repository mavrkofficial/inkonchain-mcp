import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { publicClient, getAccount } from '../client.js';
import { storePrivateKey, getPrivateKey } from '../keychain.js';

export const walletTools = [
  {
    name: 'wallet_address',
    description: 'Return the configured EVM wallet address and native Ink ETH balance. Uses EVM_PRIVATE_KEY or the OS keychain entry configured by inkonchain-mcp-setup.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'wallet_create',
    description: 'Create a fresh EVM wallet and store its private key in the OS keychain used by inkonchain-mcp. Refuses to overwrite an existing key unless overwrite=true. Returns the address only by default; set revealPrivateKey=true only during manual setup.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        overwrite: { type: 'boolean', description: 'Allow replacing an existing keychain private key. Defaults to false.' },
        revealPrivateKey: { type: 'boolean', description: 'Return the generated private key in the response. Defaults to false.' },
      },
    },
  },
];

export async function handleWalletTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'wallet_address': {
      const address = await getAccount();
      const balance = await publicClient.getBalance({ address });
      return {
        address,
        nativeBalanceWei: balance.toString(),
        nativeBalanceEth: Number(balance) / 1e18,
      };
    }

    case 'wallet_create': {
      const overwrite = args.overwrite === true;
      const existing = await getPrivateKey();
      if (existing && !overwrite) {
        return {
          created: false,
          address: privateKeyToAccount(existing as `0x${string}`).address,
          message: 'A wallet is already configured. Pass overwrite=true to replace it.',
        };
      }

      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      await storePrivateKey(privateKey);

      return {
        created: true,
        address: account.address,
        privateKey: args.revealPrivateKey === true ? privateKey : undefined,
        warning: args.revealPrivateKey === true
          ? 'Store this private key securely. It will not be shown again unless exported from your keychain.'
          : undefined,
      };
    }

    default:
      throw new Error(`Unknown wallet tool: ${name}`);
  }
}
