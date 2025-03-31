import { Client, Events, GatewayIntentBits, Collection } from 'discord.js';
import { log } from '../vite';
import { registerCommands } from './commands/game';
import { initializeInteractionStorage } from './utils/interactionStorage';
import { initializeGameManager } from './game/gameManager';

// Create a new client instance
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ] 
});

// Initialize and export client
export const startBot = async () => {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN is required in environment variables');
  }

  // Initialize services
  initializeInteractionStorage();
  initializeGameManager();

  // Register commands and handlers
  registerCommands(client);

  // When the client is ready, run this code (only once)
  client.once(Events.ClientReady, (readyClient) => {
    log(`Discord bot logged in as ${readyClient.user.tag}`, 'discord');
  });

  // Error handling
  client.on(Events.Error, (error) => {
    log(`Discord client error: ${error.message}`, 'discord');
  });

  client.on(Events.Warn, (warning) => {
    log(`Discord client warning: ${warning}`, 'discord');
  });

  client.on(Events.Debug, (info) => {
    if (process.env.NODE_ENV === 'development') {
      log(`Discord debug: ${info}`, 'discord-debug');
    }
  });

  // Login to Discord with your client's token
  await client.login(process.env.DISCORD_TOKEN);
  
  return client;
};

export const getClient = () => client;
