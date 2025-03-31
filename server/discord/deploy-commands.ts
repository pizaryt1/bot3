import { REST, Routes } from 'discord.js';
import { commands } from './commands/game';
import { log } from '../vite';

export async function deployCommands() {
  if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID) {
    throw new Error('DISCORD_TOKEN and DISCORD_CLIENT_ID are required in environment variables');
  }

  const commandsData = Array.from(commands.values()).map(command => command.data.toJSON());
  
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  try {
    log('Started refreshing application (/) commands.', 'discord');

    // The put method is used to fully refresh all commands with the current set
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commandsData }
    );

    log('Successfully reloaded application (/) commands.', 'discord');
  } catch (error) {
    log(`Error deploying commands: ${error}`, 'discord');
    throw error;
  }
}

// Run the deployment if this file is executed directly
if (require.main === module) {
  deployCommands().catch(error => {
    console.error('Failed to deploy commands:', error);
    process.exit(1);
  });
}
