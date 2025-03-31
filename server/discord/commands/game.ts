import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  Client, 
  Events, 
  ButtonInteraction,
  Collection,
  ModalSubmitInteraction,
  SelectMenuInteraction
} from 'discord.js';
import { log } from '../../vite';
import { storage } from '../../storage';
import { createInitialGameEmbed } from '../components/initialView';
import { handleRoleConfigViewButtons } from '../components/roleConfigView';
import { handleInitialViewButtons } from '../components/initialView';
import { handleModalSubmit } from '../components/modals';
import { getGameManager } from '../game/gameManager';

// Define command type
interface DiscordCommand {
  data: any; // We use 'any' here to avoid type issues with SlashCommandBuilder
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// Command collection for easy access
export const commands = new Collection<string, DiscordCommand>();

// Create the /game command
const gameCommand = {
  data: new SlashCommandBuilder()
    .setName('game')
    .setDescription('بدء لعبة المستذئب جديدة')
    .setDescriptionLocalizations({
      'en-US': 'Start a new Werewolf game'
    }),
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Create a new game in storage
      const game = await storage.createGame(
        interaction.channelId,
        interaction.user.id
      );
      
      // Initialize the game manager
      const gameManager = getGameManager();
      gameManager.createGame(game.id, interaction.user.id);
      
      // Create the initial embed and send it
      const { embed, components, files } = createInitialGameEmbed(
        interaction.user.id,
        interaction.user.username,
        game.id
      );
      
      await interaction.reply({
        content: "**مرحباً بك في لعبة المستذئب!**",
        files: files,
        embeds: [embed],
        components: components
      });
      
      // Store the message ID for future updates
      const message = await interaction.fetchReply();
      await storage.updateGameMessage(game.id, message.id);
      
      // Add the game owner as the first player
      await storage.addPlayerToGame(game.id, interaction.user.id, interaction.user.username);
      
      // Update the game state
      gameManager.addPlayer(game.id, interaction.user.id, interaction.user.username);
      
      // Setup basic roles
      await storage.setupGameRoles(game.id, [
        { role: 'villager', enabled: true, basic: true },
        { role: 'werewolf', enabled: true, basic: true },
        { role: 'seer', enabled: true, basic: true },
        { role: 'guardian', enabled: true, basic: true },
        { role: 'werewolfLeader', enabled: false, basic: false },
        { role: 'detective', enabled: false, basic: false },
        { role: 'sniper', enabled: false, basic: false },
        { role: 'reviver', enabled: false, basic: false },
        { role: 'wizard', enabled: false, basic: false }
      ]);
      
      // Start the countdown
      gameManager.startCountdown(game.id);
      
      log(`Game ${game.id} started by ${interaction.user.username}`, 'discord-game');
    } catch (error) {
      log(`Error executing game command: ${error}`, 'discord');
      await interaction.reply({
        content: 'حدث خطأ أثناء إنشاء اللعبة. الرجاء المحاولة مرة أخرى.',
        ephemeral: true
      });
    }
  }
};

// Register button interactions
export function registerButtonHandlers(client: Client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    
    const buttonId = interaction.customId;
    
    try {
      if (buttonId.startsWith('game_join_') || 
          buttonId.startsWith('game_leave_') || 
          buttonId.startsWith('game_rules_') || 
          buttonId.startsWith('game_feedback_') ||
          buttonId.startsWith('game_start_')) {
        await handleInitialViewButtons(interaction as ButtonInteraction);
      }
      else if (buttonId.startsWith('role_auto_') || 
               buttonId.startsWith('role_start_') ||
               buttonId.startsWith('role_toggle_')) {
        await handleRoleConfigViewButtons(interaction as ButtonInteraction);
      }
    } catch (error) {
      log(`Error handling button interaction: ${error}`, 'discord');
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'حدث خطأ أثناء معالجة التفاعل. الرجاء المحاولة مرة أخرى.',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: 'حدث خطأ أثناء معالجة التفاعل. الرجاء المحاولة مرة أخرى.',
          ephemeral: true
        });
      }
    }
  });
}

// Register modal submit interactions
export function registerModalHandlers(client: Client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    
    try {
      await handleModalSubmit(interaction as ModalSubmitInteraction);
    } catch (error) {
      log(`Error handling modal submission: ${error}`, 'discord');
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'حدث خطأ أثناء معالجة النموذج. الرجاء المحاولة مرة أخرى.',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: 'حدث خطأ أثناء معالجة النموذج. الرجاء المحاولة مرة أخرى.',
          ephemeral: true
        });
      }
    }
  });
}

// Register select menu interactions
export function registerSelectMenuHandlers(client: Client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isSelectMenu()) return;
    
    try {
      // Handle select menu interactions (if needed)
    } catch (error) {
      log(`Error handling select menu interaction: ${error}`, 'discord');
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'حدث خطأ أثناء معالجة الاختيار. الرجاء المحاولة مرة أخرى.',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: 'حدث خطأ أثناء معالجة الاختيار. الرجاء المحاولة مرة أخرى.',
          ephemeral: true
        });
      }
    }
  });
}

// Register all commands and interaction handlers
export function registerCommands(client: Client) {
  // Register command
  commands.set(gameCommand.data.name, gameCommand);
  
  // Register interaction handlers
  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const command = commands.get(interaction.commandName);
    if (!command) {
      log(`No command matching ${interaction.commandName} was found.`, 'discord');
      return;
    }
    
    try {
      await command.execute(interaction);
    } catch (error) {
      log(`Error executing ${interaction.commandName}: ${error}`, 'discord');
      
      const errorMessage = 'حدث خطأ أثناء تنفيذ هذا الأمر.';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  });
  
  // Register button handlers
  registerButtonHandlers(client);
  
  // Register modal handlers
  registerModalHandlers(client);
  
  // Register select menu handlers
  registerSelectMenuHandlers(client);
  
  log('Registered all commands and interaction handlers', 'discord');
}
