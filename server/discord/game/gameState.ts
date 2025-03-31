import { RoleType } from '@shared/schema';

// Game phases
export enum GamePhase {
  SETUP = 'setup',
  NIGHT = 'night',
  DAY = 'day',
  VOTING = 'voting',
  ENDED = 'ended'
}

// Player information
export interface Player {
  id: string;
  username: string;
  role?: RoleType;
  isAlive: boolean;
}

// Game status type
export type GameStatus = 'setup' | 'configuring' | 'running' | 'ended';

// Game state class
export class GameState {
  public readonly id: number;
  public readonly ownerId: string;
  public status: GameStatus;
  public phase: GamePhase;
  public day: number;
  public players: Map<string, Player>;
  private countdownTime: number;
  
  constructor(id: number, ownerId: string) {
    this.id = id;
    this.ownerId = ownerId;
    this.status = 'setup';
    this.phase = GamePhase.SETUP;
    this.day = 0;
    this.players = new Map();
    this.countdownTime = 30;
    
    // Add owner as the first player
    this.addPlayer(ownerId, 'Owner'); // Username will be updated later
  }
  
  // Add a player to the game
  addPlayer(id: string, username: string): boolean {
    // Check if player is already in the game
    if (this.players.has(id)) {
      // Update username if needed
      const player = this.players.get(id)!;
      if (player.username !== username) {
        player.username = username;
        this.players.set(id, player);
      }
      return false;
    }
    
    // Add new player
    this.players.set(id, {
      id,
      username,
      isAlive: true
    });
    
    return true;
  }
  
  // Remove a player from the game
  removePlayer(id: string): boolean {
    // Cannot remove the owner
    if (id === this.ownerId) {
      return false;
    }
    
    return this.players.delete(id);
  }
  
  // Set player's role
  setPlayerRole(id: string, role: RoleType): boolean {
    const player = this.players.get(id);
    if (!player) return false;
    
    player.role = role;
    this.players.set(id, player);
    return true;
  }
  
  // Set player's alive status
  setPlayerAlive(id: string, isAlive: boolean): boolean {
    const player = this.players.get(id);
    if (!player) return false;
    
    player.isAlive = isAlive;
    this.players.set(id, player);
    return true;
  }
  
  // Get player by ID
  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }
  
  // Get all players
  getAllPlayers(): Map<string, Player> {
    return this.players;
  }
  
  // Get alive players
  getAlivePlayers(): Player[] {
    return Array.from(this.players.values()).filter(p => p.isAlive);
  }
  
  // Get players by role
  getPlayersByRole(role: RoleType): Player[] {
    return Array.from(this.players.values()).filter(p => p.role === role);
  }
  
  // Set game phase
  setPhase(phase: GamePhase): void {
    this.phase = phase;
  }
  
  // Set game day
  setDay(day: number): void {
    this.day = day;
  }
  
  // Set countdown time
  setCountdownTime(time: number): void {
    this.countdownTime = time;
  }
  
  // Get countdown time
  getCountdownTime(): number {
    return this.countdownTime;
  }
  
  // Decrement countdown time
  decrementCountdown(): number {
    if (this.countdownTime > 0) {
      this.countdownTime--;
    }
    return this.countdownTime;
  }
  
  // Check if game is over
  isGameOver(): boolean {
    // Count alive werewolves and villagers
    const aliveWerewolves = this.getAlivePlayers().filter(p => 
      p.role === 'werewolf' || p.role === 'werewolfLeader'
    ).length;
    
    const aliveVillagers = this.getAlivePlayers().filter(p => 
      p.role !== 'werewolf' && p.role !== 'werewolfLeader'
    ).length;
    
    // Game is over if all werewolves are dead or werewolves equal/outnumber villagers
    return aliveWerewolves === 0 || aliveWerewolves >= aliveVillagers;
  }
  
  // Get winner team
  getWinner(): 'villagers' | 'werewolves' | null {
    if (!this.isGameOver()) return null;
    
    const aliveWerewolves = this.getAlivePlayers().filter(p => 
      p.role === 'werewolf' || p.role === 'werewolfLeader'
    ).length;
    
    return aliveWerewolves === 0 ? 'villagers' : 'werewolves';
  }
}
