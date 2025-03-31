import { storage } from '../../storage';
import { log } from '../../vite';
import { RoleType } from '@shared/schema';
import { GameState, GamePhase } from './gameState';
import { balanceRoles } from '../utils/roleBalancer';
import { ButtonInteraction, TextChannel, EmbedBuilder } from 'discord.js';
import { getClient } from '../bot';
import { sendRoleAssignment } from '../components/ephemeralMessages';

// Singleton Game Manager
let gameManagerInstance: GameManager | null = null;

export class GameManager {
  private games: Map<number, GameState>;
  private countdownIntervals: Map<number, NodeJS.Timeout>;
  
  constructor() {
    this.games = new Map();
    this.countdownIntervals = new Map();
  }
  
  // Create a new game
  createGame(gameId: number, ownerId: string): GameState {
    const gameState = new GameState(gameId, ownerId);
    this.games.set(gameId, gameState);
    log(`Created game ${gameId} with owner ${ownerId}`, 'game-manager');
    return gameState;
  }
  
  // Get game state
  getGameState(gameId: number): GameState | undefined {
    return this.games.get(gameId);
  }
  
  // Add player to game
  addPlayer(gameId: number, userId: string, username: string): boolean {
    const gameState = this.games.get(gameId);
    if (!gameState) return false;
    
    gameState.addPlayer(userId, username);
    log(`Added player ${username} (${userId}) to game ${gameId}`, 'game-manager');
    return true;
  }
  
  // Remove player from game
  removePlayer(gameId: number, userId: string): boolean {
    const gameState = this.games.get(gameId);
    if (!gameState) return false;
    
    const success = gameState.removePlayer(userId);
    if (success) {
      log(`Removed player ${userId} from game ${gameId}`, 'game-manager');
    }
    return success;
  }
  
  // Start countdown for game
  startCountdown(gameId: number, duration: number = 30): boolean {
    const gameState = this.games.get(gameId);
    if (!gameState) return false;
    
    // Clear any existing countdown
    this.stopCountdown(gameId);
    
    // Set initial countdown time
    gameState.setCountdownTime(duration);
    
    // Create new countdown interval
    const interval = setInterval(async () => {
      const newTime = gameState.decrementCountdown();
      
      // Update countdown in message every second
      try {
        const game = await storage.getGame(gameId);
        if (!game || !game.messageId || !game.channelId) return;
        
        const client = getClient();
        const channel = await client.channels.fetch(game.channelId) as TextChannel;
        if (!channel) return;
        
        const message = await channel.messages.fetch(game.messageId);
        if (!message) return;
        
        // Only update the embed if the game is still in setup phase
        if (game.status === 'setup') {
          const embed = message.embeds[0];
          if (!embed) return;
          
          // Create a new embed based on the existing one
          const minutes = Math.floor(newTime / 60);
          const seconds = newTime % 60;
          const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          
          // Clone the embed data to ensure we have all fields
          const updatedEmbed = EmbedBuilder.from(embed);
          
          // Find the countdown field and update it
          const fields = [...embed.fields];
          const countdownFieldIndex = fields.findIndex(f => f.name === 'العد التنازلي لبدء اللعبة');
          if (countdownFieldIndex !== -1) {
            // Update the field value using the spliceFields method
            updatedEmbed.spliceFields(countdownFieldIndex, 1, { 
              name: 'العد التنازلي لبدء اللعبة', 
              value: timeString 
            });
          }
          
          await message.edit({ embeds: [updatedEmbed] });
        }
      } catch (error) {
        log(`Error updating countdown for game ${gameId}: ${error}`, 'game-manager');
      }
      
      // If countdown reaches 0, check if there are enough players before moving on
      if (newTime <= 0) {
        this.stopCountdown(gameId);
        
        const game = await storage.getGame(gameId);
        if (!game || !game.messageId || !game.channelId || game.status !== 'setup') return;
        
        // Get the players for this game
        const players = await storage.getGamePlayers(gameId);
        
        // Check if there are enough players (at least 3)
        if (players.length < 3) {
          try {
            const client = getClient();
            const channel = await client.channels.fetch(game.channelId) as TextChannel;
            if (!channel) return;
            
            const message = await channel.messages.fetch(game.messageId);
            if (!message) return;
            
            // Create not enough players embed with professional styling
            const notEnoughPlayersEmbed = new EmbedBuilder()
              .setTitle('⚠️ عدد اللاعبين غير كافي')
              .setColor('#FF5555')
              .setDescription(`
                ## تم إلغاء اللعبة بسبب عدم اكتمال العدد
                
                **سبب المشكلة**: انتهى وقت الانتظار ويوجد ${players.length} لاعب فقط في اللعبة.
                **الحل**: تحتاج إلى 3 لاعبين على الأقل لبدء اللعبة.
                
                يمكنك بدء لعبة جديدة والتأكد من وجود عدد كافٍ من اللاعبين.
              `)
              .setFooter({ text: 'سيتم إلغاء اللعبة وحذف هذه الرسالة بعد 5 ثوانٍ' });
            
            // Update the message with the "not enough players" embed
            await message.edit({ embeds: [notEnoughPlayersEmbed], components: [] });
            
            // End the game in storage
            await storage.updateGameStatus(gameId, 'ended');
            
            // Delete the game from the manager
            this.games.delete(gameId);
            
            // Set a timeout to delete the message after 5 seconds
            setTimeout(async () => {
              try {
                await message.delete();
                log(`Deleted not enough players message for game ${gameId}`, 'game-manager');
              } catch (error) {
                log(`Error deleting not enough players message: ${error}`, 'game-manager');
              }
            }, 5000);
            
            log(`Game ${gameId} cancelled due to insufficient players (${players.length})`, 'game-manager');
            return;
          } catch (error) {
            log(`Error handling insufficient players for game ${gameId}: ${error}`, 'game-manager');
            return;
          }
        }
        
        // If we have enough players, move to role configuration
        try {
          await storage.updateGameStatus(gameId, 'configuring');
          
          const client = getClient();
          const channel = await client.channels.fetch(game.channelId) as TextChannel;
          if (!channel) return;
          
          const message = await channel.messages.fetch(game.messageId);
          if (!message) return;
          
          // Update the message to show role config
          const { createRoleConfigEmbed } = await import('../components/roleConfigView');
          const { embed, components } = await createRoleConfigEmbed(gameId);
          
          await message.edit({ embeds: [embed], components });
          
          log(`Game ${gameId} moved to role configuration phase`, 'game-manager');
        } catch (error) {
          log(`Error moving game ${gameId} to role configuration: ${error}`, 'game-manager');
        }
      }
    }, 1000);
    
    this.countdownIntervals.set(gameId, interval);
    log(`Started countdown for game ${gameId}`, 'game-manager');
    return true;
  }
  
  // Stop countdown for game
  stopCountdown(gameId: number): boolean {
    const interval = this.countdownIntervals.get(gameId);
    if (interval) {
      clearInterval(interval);
      this.countdownIntervals.delete(gameId);
      log(`Stopped countdown for game ${gameId}`, 'game-manager');
      return true;
    }
    return false;
  }
  
  // Get current countdown time
  getCountdownTime(gameId: number): number | null {
    const gameState = this.games.get(gameId);
    if (!gameState) return null;
    
    return gameState.getCountdownTime();
  }
  
  // Assign roles to players
  async assignRoles(gameId: number, enabledRoles: RoleType[]): Promise<boolean> {
    const gameState = this.games.get(gameId);
    if (!gameState) return false;
    
    // Get players from storage instead of using Map.length
    const gamePlayers = await storage.getGamePlayers(gameId);
    const playerCount = gamePlayers.length;
    
    log(`Role balance for ${playerCount} players: ${JSON.stringify(balanceRoles(playerCount, enabledRoles))}`, 'discord-game');
    
    // Balance roles based on player count and enabled roles
    const roleDistribution = balanceRoles(playerCount, enabledRoles);
    
    // Create role assignment array
    const roleAssignments: RoleType[] = [];
    
    // Add roles according to distribution
    Object.entries(roleDistribution).forEach(([role, count]) => {
      if (count && count > 0) {
        for (let i = 0; i < count; i++) {
          roleAssignments.push(role as RoleType);
        }
      }
    });
    
    // Shuffle role assignments
    this.shuffleArray(roleAssignments);
    
    // Assign roles to players
    for (let i = 0; i < gamePlayers.length; i++) {
      const player = gamePlayers[i];
      const role = roleAssignments[i];
      
      // Update player role in game state
      gameState.setPlayerRole(player.userId, role);
      
      // Update player role in storage
      await storage.updatePlayerRole(gameId, player.userId, role);
    }
    
    // Update game state
    gameState.setPhase(GamePhase.NIGHT);
    gameState.setDay(1);
    
    log(`Assigned roles for game ${gameId}`, 'game-manager');
    return true;
  }
  
  // Send role assignments to all players
  async sendRoleAssignments(gameId: number): Promise<boolean> {
    const gameState = this.games.get(gameId);
    if (!gameState) return false;
    
    // Get players from storage to ensure consistency
    const gamePlayers = await storage.getGamePlayers(gameId);
    
    // Get all werewolves for team information
    const werewolves = gamePlayers
      .filter(p => p.role === 'werewolf' || p.role === 'werewolfLeader')
      .map(p => `<@${p.userId}> (${p.username})`);
    
    // Send role information to each player
    for (const player of gamePlayers) {
      const role = player.role;
      if (!role) continue;
      
      // Validate that role is a valid RoleType
      const validRoles: RoleType[] = ['villager', 'werewolf', 'werewolfLeader', 'seer', 'detective', 'guardian', 'sniper', 'reviver', 'wizard'];
      if (!validRoles.includes(role as RoleType)) {
        log(`Invalid role type for player ${player.username}: ${role}`, 'game-manager');
        continue;
      }
      
      // If player is a werewolf, include team information
      const isWerewolf = role === 'werewolf' || role === 'werewolfLeader';
      const teammates = isWerewolf ? werewolves.filter(w => !w.includes(player.userId)) : undefined;
      
      try {
        // Send role assignment with role as RoleType
        const success = await sendRoleAssignment(
          player.userId,
          player.username,
          role as RoleType,
          teammates
        );
        
        if (!success) {
          log(`Failed to send role assignment to player ${player.username} (${player.userId})`, 'game-manager');
        }
      } catch (error) {
        log(`Error sending role assignment to player ${player.username} (${player.userId}): ${error}`, 'game-manager');
      }
    }
    
    log(`Sent role assignments for game ${gameId}`, 'game-manager');
    return true;
  }
  
  // Helper method to shuffle an array
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

// Initialize the game manager as a singleton
export function initializeGameManager(): GameManager {
  if (!gameManagerInstance) {
    gameManagerInstance = new GameManager();
    log('Game manager initialized', 'game-manager');
  }
  return gameManagerInstance;
}

// Get the game manager instance
export function getGameManager(): GameManager {
  if (!gameManagerInstance) {
    return initializeGameManager();
  }
  return gameManagerInstance;
}
