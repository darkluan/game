import { Client } from '@colyseus/sdk';
import { runtimeConfig } from '@/lib/runtimeConfig';

/** The one connection factory to the game server. */
export const colyseus = new Client(runtimeConfig.serverUrl);

/** Close code the server uses when the same player connects again from another tab. */
export const CLOSE_REPLACED = 4001;
