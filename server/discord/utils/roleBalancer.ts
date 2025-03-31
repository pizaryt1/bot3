import { RoleType } from '@shared/schema';
import { log } from '../../vite';

// Determine optimal role distribution based on player count
export function getOptimalRoles(playerCount: number): Record<RoleType, boolean> {
  // Default roles (all disabled except basic ones)
  const roles: Record<RoleType, boolean> = {
    villager: true,      // Always enabled (basic)
    werewolf: true,      // Always enabled (basic)
    seer: true,          // Always enabled (basic)
    guardian: true,      // Always enabled (basic)
    werewolfLeader: false,
    detective: false,
    sniper: false,
    reviver: false,
    wizard: false
  };
  
  // For small games (3-5 players), keep it simple
  if (playerCount <= 5) {
    return roles;
  }
  
  // For medium games (6-8 players), add some additional roles
  if (playerCount <= 8) {
    roles.detective = true;
    roles.werewolfLeader = playerCount >= 7;
    return roles;
  }
  
  // For large games (9+ players), add more roles
  roles.detective = true;
  roles.werewolfLeader = true;
  
  if (playerCount >= 9) {
    roles.sniper = true;
  }
  
  if (playerCount >= 10) {
    roles.reviver = true;
  }
  
  if (playerCount >= 12) {
    roles.wizard = true;
  }
  
  return roles;
}

// Determine the actual number of each role based on player count and enabled roles
export function balanceRoles(
  playerCount: number, 
  enabledRoles: RoleType[]
): Record<RoleType, number> {
  const roleCount: Record<RoleType, number> = {
    villager: 0,
    werewolf: 0,
    seer: 0,
    guardian: 0,
    werewolfLeader: 0,
    detective: 0,
    sniper: 0,
    reviver: 0,
    wizard: 0
  };
  
  // ---- تحديد الأدوار الأمثل بناءً على عدد اللاعبين أولاً ----
  
  // تحديد عدد المستذئبين الكلي والأدوار الأساسية المطلوبة بناءً على عدد اللاعبين
  let totalWerewolves = 0;
  const optimalRoles: Record<string, boolean> = {
    seer: false,
    guardian: false,
    werewolfLeader: false,
    detective: false,
    sniper: false,
    reviver: false,
    wizard: false
  };
  
  // تحديد الأدوار المطلوبة بناءً على عدد اللاعبين فقط
  if (playerCount <= 4) {
    // 3-4 لاعبين: مستذئب واحد، عراف، حارس
    totalWerewolves = 1;
    optimalRoles.seer = true;
    optimalRoles.guardian = true;
  } else if (playerCount <= 6) {
    // 5-6 لاعبين: مستذئبان، عراف، حارس
    totalWerewolves = 2;
    optimalRoles.seer = true;
    optimalRoles.guardian = true;
  } else if (playerCount <= 8) {
    // 7-8 لاعبين: مستذئبان، عراف، حارس، محقق، زعيم المستذئبين
    totalWerewolves = 2;
    optimalRoles.seer = true;
    optimalRoles.guardian = true;
    optimalRoles.detective = true;
    optimalRoles.werewolfLeader = true;
  } else if (playerCount <= 10) {
    // 9-10 لاعبين: 3 مستذئبين، عراف، حارس، محقق، قناص، زعيم المستذئبين
    totalWerewolves = 3;
    optimalRoles.seer = true;
    optimalRoles.guardian = true; 
    optimalRoles.detective = true;
    optimalRoles.sniper = true;
    optimalRoles.werewolfLeader = true;
  } else {
    // 11+ لاعبين: 3-4 مستذئبين، وكل الأدوار المتقدمة
    totalWerewolves = Math.min(4, Math.floor(playerCount / 3));
    optimalRoles.seer = true;
    optimalRoles.guardian = true;
    optimalRoles.detective = true;
    optimalRoles.sniper = true;
    optimalRoles.reviver = true;
    optimalRoles.wizard = true;
    optimalRoles.werewolfLeader = true;
  }
  
  // ---- التحقق من الأدوار المفعلة ----
  
  // تقسيم الأدوار المفعلة إلى مجموعات (مستذئبين، قرية، قروي)
  const enabledWerewolves: RoleType[] = [];
  const enabledVillageRoles: RoleType[] = [];
  let isVillagerEnabled = false;
  
  enabledRoles.forEach(role => {
    if (role === 'werewolf' || role === 'werewolfLeader') {
      enabledWerewolves.push(role);
    } else if (role === 'villager') {
      isVillagerEnabled = true;
    } else {
      enabledVillageRoles.push(role);
    }
  });
  
  // إذا لم يكن دور القروي مفعلاً، نقوم بتفعيله تلقائياً لأنه ضروري
  if (!isVillagerEnabled) {
    enabledRoles.push('villager');
  }
  
  // ---- تطبيق توزيع الأدوار المتوازن ----
  
  // 1. توزيع أدوار المستذئبين
  
  // إذا كان زعيم المستذئبين مطلوباً ومفعلاً، نضيفه
  if (optimalRoles.werewolfLeader && enabledWerewolves.includes('werewolfLeader')) {
    roleCount.werewolfLeader = 1;
    totalWerewolves -= 1;
  }
  
  // إضافة باقي المستذئبين العاديين إذا كانوا مفعلين
  if (totalWerewolves > 0 && enabledWerewolves.includes('werewolf')) {
    roleCount.werewolf = totalWerewolves;
  } else if (totalWerewolves > 0) {
    // إذا لم يكن دور المستذئب مفعلاً، نستبدله بقرويين
    log(`Warning: werewolf role not enabled but needed for balance`, 'discord-game');
    roleCount.villager += totalWerewolves;
    totalWerewolves = 0;
  }
  
  // 2. توزيع أدوار القرية الخاصة
  
  // ضمان وجود الأدوار الأساسية أولاً (عراف وحارس)
  if (optimalRoles.seer && enabledVillageRoles.includes('seer')) {
    roleCount.seer = 1;
  } else if (optimalRoles.seer) {
    // إذا لم يكن العراف مفعلاً لكنه مطلوب، نستبدله بقروي
    log(`Warning: seer role not enabled but needed for balance`, 'discord-game');
    roleCount.villager += 1;
  }
  
  if (optimalRoles.guardian && enabledVillageRoles.includes('guardian')) {
    roleCount.guardian = 1;
  } else if (optimalRoles.guardian) {
    // إذا لم يكن الحارس مفعلاً لكنه مطلوب، نستبدله بقروي
    log(`Warning: guardian role not enabled but needed for balance`, 'discord-game');
    roleCount.villager += 1;
  }
  
  // إضافة باقي الأدوار المتقدمة إذا كانت مطلوبة ومفعلة
  if (optimalRoles.detective && enabledVillageRoles.includes('detective')) {
    roleCount.detective = 1;
  }
  
  if (optimalRoles.sniper && enabledVillageRoles.includes('sniper')) {
    roleCount.sniper = 1;
  }
  
  if (optimalRoles.reviver && enabledVillageRoles.includes('reviver')) {
    roleCount.reviver = 1;
  }
  
  if (optimalRoles.wizard && enabledVillageRoles.includes('wizard')) {
    roleCount.wizard = 1;
  }
  
  // 3. إكمال بقية اللاعبين كقرويين عاديين
  const assignedRoles = Object.values(roleCount).reduce((sum, count) => sum + count, 0);
  roleCount.villager += (playerCount - assignedRoles);
  
  // التأكد من أن عدد القرويين لا يمكن أن يكون سالباً
  if (roleCount.villager < 0) {
    log(`Error in role balance: got negative villager count`, 'discord-game');
    roleCount.villager = 0;
  }
  
  // تسجيل توزيع الأدوار
  log(`Role balance for ${playerCount} players: ${JSON.stringify(roleCount)}`, 'discord-game');
  
  return roleCount;
}
