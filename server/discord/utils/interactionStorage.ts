import { 
  ButtonInteraction, 
  ChatInputCommandInteraction, 
  CommandInteraction, 
  MessageComponentInteraction,
  User,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  DMChannel
} from 'discord.js';
import { log } from '../../vite';
import { getClient } from '../bot';

// Type for stored interactions
type StoredInteraction = ButtonInteraction | ChatInputCommandInteraction | MessageComponentInteraction;

// Map to store interactions by user ID
let interactionStorage: Map<string, StoredInteraction> = new Map();

// Map to store DM channels by user ID
let dmChannelStorage: Map<string, DMChannel> = new Map();

// Initialize the interaction storage
export function initializeInteractionStorage() {
  interactionStorage = new Map();
  dmChannelStorage = new Map();
  log('Interaction storage initialized', 'discord');
}

// Store an interaction for future use
export function storeInteraction(userId: string, interaction: StoredInteraction) {
  interactionStorage.set(userId, interaction);
  log(`Stored interaction for user ${userId}`, 'discord-debug');
  
  // Set a timeout to clean up the interaction after some time
  setTimeout(() => {
    if (interactionStorage.has(userId)) {
      interactionStorage.delete(userId);
      log(`Cleaned up stored interaction for user ${userId}`, 'discord-debug');
    }
  }, 1000 * 60 * 10); // Clean up after 10 minutes
}

// Get a stored interaction
export function getStoredInteraction(userId: string): StoredInteraction | undefined {
  return interactionStorage.get(userId);
}

// Remove a stored interaction
export function removeStoredInteraction(userId: string): boolean {
  return interactionStorage.delete(userId);
}

// Store a DM channel for future use
export async function storeDMChannel(userId: string): Promise<DMChannel | null> {
  try {
    const client = getClient();
    const user = await client.users.fetch(userId);
    if (!user) return null;
    
    const dmChannel = await user.createDM();
    dmChannelStorage.set(userId, dmChannel);
    log(`Stored DM channel for user ${userId}`, 'discord-debug');
    return dmChannel;
  } catch (error) {
    log(`Error storing DM channel for user ${userId}: ${error}`, 'discord');
    return null;
  }
}

// Get a stored DM channel, or create one if it doesn't exist
export async function getDMChannel(userId: string): Promise<DMChannel | null> {
  if (dmChannelStorage.has(userId)) {
    return dmChannelStorage.get(userId) as DMChannel;
  }
  
  return await storeDMChannel(userId);
}

// Send an ephemeral message to a user using their stored interaction
// هذه الوظيفة لا تستخدم الرسائل المباشرة، بل تستخدم الرسائل المخفية في الشات العام فقط
export async function sendEphemeralReply(
  userId: string, 
  content?: string, 
  embeds: EmbedBuilder[] = [], 
  components: Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>> = []
): Promise<boolean> {
  try {
    const interaction = getStoredInteraction(userId);
    if (!interaction) {
      log(`No stored interaction found for user ${userId}, cannot send ephemeral message`, 'discord');
      return false;
    }
    
    // تحقق مما إذا كان التفاعل قد تم الرد عليه بالفعل
    if (interaction.replied) {
      await interaction.followUp({ 
        content, 
        embeds, 
        components,
        ephemeral: true 
      });
    } else {
      await interaction.reply({ 
        content, 
        embeds, 
        components,
        ephemeral: true 
      });
    }
    return true;
  } catch (error) {
    log(`Error sending ephemeral message to user ${userId}: ${error}`, 'discord');
    return false;
  }
}

// Get all stored interactions
export function getAllStoredInteractions(): Map<string, StoredInteraction> {
  return interactionStorage;
}

// Clear all stored interactions
export function clearAllStoredInteractions(): void {
  interactionStorage.clear();
  log('Cleared all stored interactions', 'discord');
}
