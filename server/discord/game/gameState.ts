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
  // للتتبع إذا قام اللاعب بإجراء في الليل
  nightActionDone?: boolean;
  // للتتبع إذا قام اللاعب بالتصويت
  voted?: boolean;
  // لتخزين معرّف اللاعب الذي صوت له
  votedFor?: string;
  // لتخزين العدد الإجمالي للأصوات ضد هذا اللاعب
  voteCount?: number;
  // لمعرفة إذا كان اللاعب محميًا من قبل الحارس
  protected?: boolean;
}

// نوع هدف إجراء ليلي
export interface NightActionTarget {
  targetId: string;
  actionType: string;
  successful?: boolean;
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
  // خاص بإجراءات الليل
  public nightActions: Map<string, NightActionTarget>;
  // خاص بالتصويت
  public votes: Map<string, string>;
  // لتخزين ضحية المستذئبين في الليلة الحالية
  public currentNightVictim: string | null;
  // مؤقت مرحلة النقاش
  public discussionTimer?: NodeJS.Timeout;
  // مؤقت مرحلة التصويت
  public votingTimer?: NodeJS.Timeout;
  
  constructor(id: number, ownerId: string) {
    this.id = id;
    this.ownerId = ownerId;
    this.status = 'setup';
    this.phase = GamePhase.SETUP;
    this.day = 0;
    this.players = new Map();
    this.countdownTime = 30;
    this.nightActions = new Map();
    this.votes = new Map();
    this.currentNightVictim = null;
    
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
  
  // ============= وظائف مرحلة الليل =============
  
  // تسجيل إجراء ليلي
  addNightAction(playerId: string, target: NightActionTarget): void {
    this.nightActions.set(playerId, target);
    
    // تحديث حالة اللاعب للإشارة إلى أنه قام بإجراء ليلي
    const player = this.players.get(playerId);
    if (player) {
      player.nightActionDone = true;
      this.players.set(playerId, player);
    }
  }
  
  // تعيين الضحية الحالية للمستذئبين
  setWerewolfVictim(victimId: string | null): void {
    this.currentNightVictim = victimId;
  }
  
  // إعادة تعيين جميع الإجراءات الليلية عند بداية ليلة جديدة
  resetNightActions(): void {
    this.nightActions.clear();
    this.currentNightVictim = null;
    
    // إعادة تعيين حالة الإجراءات الليلية لجميع اللاعبين
    Array.from(this.players.keys()).forEach(id => {
      const player = this.players.get(id);
      if (player) {
        player.nightActionDone = false;
        player.protected = false;
        this.players.set(id, player);
      }
    });
  }
  
  // فحص ما إذا كان جميع اللاعبين الأحياء الذين لديهم إجراءات ليلية قد قاموا بها
  areAllNightActionsDone(): boolean {
    const alivePlayers = this.getAlivePlayers();
    
    // اللاعبون الذين لديهم إجراءات ليلية ولم يقوموا بها بعد
    const pendingPlayers = alivePlayers.filter(player => {
      // المستذئبين دائماً لديهم إجراء ليلي
      if ((player.role === 'werewolf' || player.role === 'werewolfLeader') && !player.nightActionDone) {
        return true;
      }
      
      // الأدوار الأخرى التي لها إجراءات ليلية
      if (['seer', 'guardian', 'detective', 'sniper', 'reviver', 'wizard'].includes(player.role || '') && !player.nightActionDone) {
        return true;
      }
      
      return false;
    });
    
    return pendingPlayers.length === 0;
  }
  
  // ============= وظائف مرحلة التصويت =============
  
  // تسجيل تصويت
  addVote(voterId: string, targetId: string): void {
    // تخزين التصويت
    this.votes.set(voterId, targetId);
    
    // تحديث حالة المصوت
    const voter = this.players.get(voterId);
    if (voter) {
      voter.voted = true;
      voter.votedFor = targetId;
      this.players.set(voterId, voter);
    }
    
    // زيادة عدد الأصوات للهدف
    const target = this.players.get(targetId);
    if (target) {
      target.voteCount = (target.voteCount || 0) + 1;
      this.players.set(targetId, target);
    }
  }
  
  // إزالة تصويت (إذا غير اللاعب تصويته)
  removeVote(voterId: string): void {
    const previousVote = this.votes.get(voterId);
    if (previousVote) {
      // تقليل عدد الأصوات للهدف السابق
      const target = this.players.get(previousVote);
      if (target && target.voteCount && target.voteCount > 0) {
        target.voteCount--;
        this.players.set(previousVote, target);
      }
    }
    
    // إزالة التصويت
    this.votes.delete(voterId);
    
    // تحديث حالة المصوت
    const voter = this.players.get(voterId);
    if (voter) {
      voter.voted = false;
      voter.votedFor = undefined;
      this.players.set(voterId, voter);
    }
  }
  
  // إعادة تعيين جميع التصويتات لبدء تصويت جديد
  resetVotes(): void {
    this.votes.clear();
    
    // إعادة تعيين حالات التصويت لجميع اللاعبين
    Array.from(this.players.keys()).forEach(id => {
      const player = this.players.get(id);
      if (player) {
        player.voted = false;
        player.votedFor = undefined;
        player.voteCount = 0;
        this.players.set(id, player);
      }
    });
  }
  
  // تحقق مما إذا كان جميع اللاعبين الأحياء قد صوتوا
  areAllVotesDone(): boolean {
    const alivePlayers = this.getAlivePlayers();
    const pendingVoters = alivePlayers.filter(player => !player.voted);
    return pendingVoters.length === 0;
  }
  
  // الحصول على اللاعب الذي حصل على أكثر عدد من الأصوات
  getMostVotedPlayer(): Player | null {
    const alivePlayers = this.getAlivePlayers();
    
    // فرز اللاعبين حسب عدد الأصوات بترتيب تنازلي
    const sortedPlayers = [...alivePlayers].sort((a, b) => {
      return (b.voteCount || 0) - (a.voteCount || 0);
    });
    
    // إذا لا يوجد لاعبين أو لم يصوت أحد
    if (sortedPlayers.length === 0 || (sortedPlayers[0].voteCount || 0) === 0) {
      return null;
    }
    
    // في حالة التعادل، اختر عشوائياً
    const highestVotes = sortedPlayers[0].voteCount || 0;
    const tiedPlayers = sortedPlayers.filter(p => (p.voteCount || 0) === highestVotes);
    
    if (tiedPlayers.length > 1) {
      const randomIndex = Math.floor(Math.random() * tiedPlayers.length);
      return tiedPlayers[randomIndex];
    }
    
    return sortedPlayers[0];
  }
  
  // إعادة تعيين اللعبة للمرحلة التالية
  prepareNextPhase(): void {
    if (this.phase === GamePhase.NIGHT) {
      // انتقال من الليل إلى النهار
      this.phase = GamePhase.DAY;
    } else if (this.phase === GamePhase.DAY) {
      // انتقال من النهار إلى التصويت
      this.phase = GamePhase.VOTING;
      this.resetVotes();
    } else if (this.phase === GamePhase.VOTING) {
      // انتقال من التصويت إلى الليل
      this.phase = GamePhase.NIGHT;
      this.day++;
      this.resetNightActions();
    }
  }
}
