import { 
  ButtonInteraction, 
  ChatInputCommandInteraction, 
  CommandInteraction, 
  MessageComponentInteraction 
} from 'discord.js';
import { log } from '../../vite';

// Type for stored interactions
type StoredInteraction = ButtonInteraction | ChatInputCommandInteraction | MessageComponentInteraction;

// Map to store interactions by user ID
let interactionStorage: Map<string, StoredInteraction> = new Map();

// Initialize the interaction storage
export function initializeInteractionStorage() {
  interactionStorage = new Map();
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

// Get all stored interactions
export function getAllStoredInteractions(): Map<string, StoredInteraction> {
  return interactionStorage;
}

// Clear all stored interactions
export function clearAllStoredInteractions(): void {
  interactionStorage.clear();
  log('Cleared all stored interactions', 'discord');
}
