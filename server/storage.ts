import { 
  users, 
  games, 
  gamePlayers, 
  gameRoles, 
  type User, 
  type InsertUser, 
  type Game, 
  type GamePlayer, 
  type GameRole, 
  type GameStatus, 
  type RoleType 
} from "@shared/schema";

// Modify the interface with game-related CRUD methods
export interface IStorage {
  // User-related methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Game-related methods
  createGame(channelId: string, ownerId: string): Promise<Game>;
  getGame(id: number): Promise<Game | undefined>;
  updateGameStatus(id: number, status: GameStatus): Promise<Game | undefined>;
  updateGameMessage(id: number, messageId: string): Promise<Game | undefined>;
  endGame(id: number): Promise<Game | undefined>;
  getActiveGames(): Promise<Game[]>;
  
  // Player-related methods
  addPlayerToGame(gameId: number, userId: string, username: string): Promise<GamePlayer>;
  removePlayerFromGame(gameId: number, userId: string): Promise<boolean>;
  getGamePlayers(gameId: number): Promise<GamePlayer[]>;
  updatePlayerRole(gameId: number, userId: string, role: RoleType): Promise<GamePlayer | undefined>;
  updatePlayerStatus(gameId: number, userId: string, isAlive: boolean): Promise<GamePlayer | undefined>;
  storePlayerInteraction(gameId: number, userId: string, interactionId: string): Promise<GamePlayer | undefined>;
  
  // Role-related methods
  setupGameRoles(gameId: number, roles: { role: RoleType, enabled: boolean, basic: boolean }[]): Promise<GameRole[]>;
  updateGameRole(gameId: number, role: RoleType, enabled: boolean): Promise<GameRole | undefined>;
  getGameRoles(gameId: number): Promise<GameRole[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private gamesMap: Map<number, Game>;
  private gamePlayers: Map<number, GamePlayer[]>;
  private gameRoles: Map<number, GameRole[]>;
  private userCurrentId: number;
  private gameCurrentId: number;
  private playerCurrentId: number;
  private roleCurrentId: number;

  constructor() {
    this.users = new Map();
    this.gamesMap = new Map();
    this.gamePlayers = new Map();
    this.gameRoles = new Map();
    this.userCurrentId = 1;
    this.gameCurrentId = 1;
    this.playerCurrentId = 1;
    this.roleCurrentId = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Game methods
  async createGame(channelId: string, ownerId: string): Promise<Game> {
    const id = this.gameCurrentId++;
    const now = new Date();
    const game: Game = {
      id,
      channelId,
      messageId: null,
      ownerId,
      status: "setup",
      startedAt: now,
      endedAt: null,
      settings: null
    };
    this.gamesMap.set(id, game);
    this.gamePlayers.set(id, []);
    this.gameRoles.set(id, []);
    return game;
  }

  async getGame(id: number): Promise<Game | undefined> {
    return this.gamesMap.get(id);
  }

  async updateGameStatus(id: number, status: GameStatus): Promise<Game | undefined> {
    const game = this.gamesMap.get(id);
    if (game) {
      game.status = status;
      this.gamesMap.set(id, game);
      return game;
    }
    return undefined;
  }

  async updateGameMessage(id: number, messageId: string): Promise<Game | undefined> {
    const game = this.gamesMap.get(id);
    if (game) {
      game.messageId = messageId;
      this.gamesMap.set(id, game);
      return game;
    }
    return undefined;
  }

  async endGame(id: number): Promise<Game | undefined> {
    const game = this.gamesMap.get(id);
    if (game) {
      game.status = "ended";
      game.endedAt = new Date();
      this.gamesMap.set(id, game);
      return game;
    }
    return undefined;
  }

  async getActiveGames(): Promise<Game[]> {
    return Array.from(this.gamesMap.values()).filter(
      (game) => game.status !== "ended"
    );
  }

  // Player methods
  async addPlayerToGame(gameId: number, userId: string, username: string): Promise<GamePlayer> {
    const players = this.gamePlayers.get(gameId) || [];
    
    // Check if player is already in the game
    const existingPlayer = players.find(p => p.userId === userId);
    if (existingPlayer) {
      return existingPlayer;
    }
    
    const id = this.playerCurrentId++;
    const player: GamePlayer = {
      id,
      gameId,
      userId,
      username,
      role: null,
      isAlive: true,
      interactionId: null
    };
    
    players.push(player);
    this.gamePlayers.set(gameId, players);
    return player;
  }

  async removePlayerFromGame(gameId: number, userId: string): Promise<boolean> {
    const players = this.gamePlayers.get(gameId);
    if (!players) return false;
    
    const updatedPlayers = players.filter(p => p.userId !== userId);
    if (updatedPlayers.length === players.length) return false;
    
    this.gamePlayers.set(gameId, updatedPlayers);
    return true;
  }

  async getGamePlayers(gameId: number): Promise<GamePlayer[]> {
    return this.gamePlayers.get(gameId) || [];
  }

  async updatePlayerRole(gameId: number, userId: string, role: RoleType): Promise<GamePlayer | undefined> {
    const players = this.gamePlayers.get(gameId);
    if (!players) return undefined;
    
    const playerIndex = players.findIndex(p => p.userId === userId);
    if (playerIndex === -1) return undefined;
    
    players[playerIndex].role = role;
    this.gamePlayers.set(gameId, players);
    return players[playerIndex];
  }

  async updatePlayerStatus(gameId: number, userId: string, isAlive: boolean): Promise<GamePlayer | undefined> {
    const players = this.gamePlayers.get(gameId);
    if (!players) return undefined;
    
    const playerIndex = players.findIndex(p => p.userId === userId);
    if (playerIndex === -1) return undefined;
    
    players[playerIndex].isAlive = isAlive;
    this.gamePlayers.set(gameId, players);
    return players[playerIndex];
  }

  async storePlayerInteraction(gameId: number, userId: string, interactionId: string): Promise<GamePlayer | undefined> {
    const players = this.gamePlayers.get(gameId);
    if (!players) return undefined;
    
    const playerIndex = players.findIndex(p => p.userId === userId);
    if (playerIndex === -1) return undefined;
    
    players[playerIndex].interactionId = interactionId;
    this.gamePlayers.set(gameId, players);
    return players[playerIndex];
  }

  // Role methods
  async setupGameRoles(
    gameId: number, 
    roles: { role: RoleType, enabled: boolean, basic: boolean }[]
  ): Promise<GameRole[]> {
    const gameRoles: GameRole[] = roles.map(r => ({
      id: this.roleCurrentId++,
      gameId,
      roleName: r.role,
      isEnabled: r.enabled,
      isBasic: r.basic
    }));
    
    this.gameRoles.set(gameId, gameRoles);
    return gameRoles;
  }

  async updateGameRole(gameId: number, role: RoleType, enabled: boolean): Promise<GameRole | undefined> {
    const roles = this.gameRoles.get(gameId);
    if (!roles) return undefined;
    
    const roleIndex = roles.findIndex(r => r.roleName === role);
    if (roleIndex === -1) return undefined;
    
    roles[roleIndex].isEnabled = enabled;
    this.gameRoles.set(gameId, roles);
    return roles[roleIndex];
  }

  async getGameRoles(gameId: number): Promise<GameRole[]> {
    return this.gameRoles.get(gameId) || [];
  }
}

export const storage = new MemStorage();
