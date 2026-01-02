/*
 * Ticket Bot Manager - Bot Entrypoint
 * Updated: Add safer debug environment logging and additional Discord client listeners
 * - Does NOT log the token value (only whether it is present)
 */

import { Client, GatewayIntentBits } from 'discord.js';

// Simple logger wrapper to centralize debug control
const isDebug = Boolean(process.env.DEBUG && process.env.DEBUG !== '0');
const log = {
  debug: (...args: unknown[]) => {
    if (isDebug) console.debug('[debug]', ...args);
  },
  info: (...args: unknown[]) => console.info('[info]', ...args),
  warn: (...args: unknown[]) => console.warn('[warn]', ...args),
  error: (...args: unknown[]) => console.error('[error]', ...args),
};

function safeEnvSummary() {
  // Only include non-sensitive environment info. DO NOT include token contents.
  return {
    NODE_ENV: process.env.NODE_ENV ?? '(unset)',
    DEBUG: process.env.DEBUG ?? '(unset)',
    DISCORD_TOKEN_PRESENT: !!process.env.DISCORD_TOKEN,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID ?? '(unset)',
    GUILD_ID: process.env.GUILD_ID ?? '(unset)',
  };
}

async function startBot() {
  log.info('Starting Ticket Bot Manager...');
  log.debug('Environment summary:', safeEnvSummary());

  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    log.error('DISCORD_TOKEN is not set. Aborting start.');
    throw new Error('Missing DISCORD_TOKEN');
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  // Core ready listener
  client.once('ready', () => {
    log.info(`Discord client ready. User: ${client.user?.tag ?? '(unknown)'}`);
  });

  // Surface common runtime and login issues
  client.on('error', (err) => {
    log.error('Discord client encountered an error:', err);
  });

  client.on('warn', (info) => {
    log.warn('Discord client warning:', info);
  });

  // Shard-related listeners (helpful when running sharded or on larger bots)
  // Some events may not fire for single-shard bots but adding them helps surface problems when they do.
  // Type definitions for some events may not exist depending on discord.js version, so cast to any where necessary.
  (client as any).on?.('shardError', (error: Error, shardId: number) => {
    log.error(`Shard ${shardId} error:`, error);
  });

  (client as any).on?.('shardDisconnect', (event: any, shardId: number) => {
    log.warn(`Shard ${shardId} disconnected. Event:`, event);
  });

  (client as any).on?.('shardReconnecting', (shardId: number) => {
    log.warn(`Shard ${shardId} reconnecting...`);
  });

  (client as any).on?.('shardReady', (shardId: number) => {
    log.info(`Shard ${shardId} ready.`);
  });

  // Debug event can be very verbose; only attach when DEBUG is enabled.
  if (isDebug) {
    // Some versions of discord.js emit a 'debug' event on the Client. Use any to avoid TS errors.
    (client as any).on?.('debug', (message: string) => {
      // Make sure not to accidentally log the token by filtering common messages that may include it.
      // This is a conservative approach: ignore any debug message that contains the literal 'token' keyword.
      if (typeof message === 'string' && /token/i.test(message)) {
        log.debug('[debug] (filtered potentially sensitive debug message)');
      } else {
        log.debug('[discord debug]', message);
      }
    });
  }

  // Catch-all for unhandled rejections and uncaught exceptions to give visibility in logs.
  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    log.error('Uncaught Exception:', err);
    // Depending on the deployment, you may want to exit here to let a process manager restart the service.
  });

  try {
    log.info('Logging in to Discord (token presence only: %s)', !!token);
    await client.login(token);
    log.info('Login attempt finished.');
  } catch (loginErr) {
    // Ensure we don't print the token or any sensitive data on login failure.
    log.error('Failed to login to Discord. Error:', loginErr);
    throw loginErr;
  }

  return client;
}

// If this module is executed directly, start the bot. Allow requiring the module in tests without side-effects.
if (require.main === module) {
  startBot().catch((err) => {
    log.error('Bot failed to start:', err);
    // Exit with non-zero to indicate failure to any supervising process
    process.exit(1);
  });
}

export default startBot;
