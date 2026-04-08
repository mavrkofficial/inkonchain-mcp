#!/usr/bin/env node
/**
 * inkonchain-mcp-setup — interactive CLI for storing the EVM private key
 * in the OS keychain (Windows Credential Manager / macOS Keychain /
 * Linux Secret Service via libsecret).
 *
 * Usage:
 *   npx inkonchain-mcp-setup           — store or update the key
 *   npx inkonchain-mcp-setup delete    — remove the stored key
 */

import readline from 'readline';
import { storePrivateKey, deletePrivateKey } from './keychain.js';

function prompt(question: string, { mask = false } = {}): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    if (mask) {
      // Simple mask: echo an asterisk on every keystroke so the terminal
      // doesn't print the real key characters. Not a hardened TTY implementation
      // but good enough for a local setup flow.
      const stdin = process.stdin;
      process.stdout.write(question);
      let buffer = '';
      stdin.setRawMode?.(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      const onData = (key: string) => {
        if (key === '\r' || key === '\n') {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(buffer.trim());
        } else if (key === '\u0003') {
          // Ctrl-C
          process.exit(130);
        } else if (key === '\u007f' || key === '\b') {
          // backspace
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          buffer += key;
          process.stdout.write('*');
        }
      };
      stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function main() {
  const arg = process.argv[2];

  if (arg === 'delete') {
    await deletePrivateKey();
    console.log('✓ EVM private key removed from OS keychain.');
    return;
  }

  console.log('=== inkonchain-mcp — Secure Key Setup ===');
  console.log('');
  console.log('Stores your EVM private key in the OS keychain:');
  console.log('  macOS   → Keychain');
  console.log('  Windows → Credential Manager');
  console.log('  Linux   → Secret Service (libsecret)');
  console.log('');
  console.log('Once set, remove EVM_PRIVATE_KEY from your MCP config (if present).');
  console.log('');

  const key = await prompt('EVM private key (0x...): ', { mask: true });

  if (!key.match(/^0x[0-9a-fA-F]{64}$/)) {
    console.error('\nInvalid key — expected 0x followed by 64 hex characters.');
    process.exit(1);
  }

  await storePrivateKey(key);
  console.log('');
  console.log('✓ Private key stored securely in OS keychain.');
  console.log('  Run: npx inkonchain-mcp');
  console.log('');
  console.log('To remove:  npx inkonchain-mcp-setup delete');
}

main().catch((e) => {
  console.error('Setup failed:', e?.message ?? e);
  process.exit(1);
});
