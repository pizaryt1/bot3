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
  
  // تقسيم الأدوار المفعلة إلى أدوار قرية وأدوار مستذئبين
  const villageRoles: RoleType[] = [];
  const werewolfRoles: RoleType[] = [];
  
  enabledRoles.forEach(role => {
    if (role === 'werewolf' || role === 'werewolfLeader') {
      werewolfRoles.push(role);
    } else if (role !== 'villager') { // استبعاد دور القروي العادي من القائمة
      villageRoles.push(role);
    }
  });
  
  // ----- الطريقة الجديدة المعتمدة فقط على عدد اللاعبين -----
  
  // تحديد عدد المستذئبين الكلي والأدوار الأساسية المطلوبة بناءً على عدد اللاعبين
  let totalWerewolves = 0;
  let needSeer = false;
  let needGuardian = false;
  let needDetective = false;
  let needSniper = false;
  let needReviver = false;
  let needWizard = false;
  
  // تحديد الأدوار المطلوبة بناءً على عدد اللاعبين فقط
  if (playerCount <= 4) {
    // 3-4 لاعبين: مستذئب واحد، عراف، حارس
    totalWerewolves = 1;
    needSeer = true;
    needGuardian = true;
  } else if (playerCount <= 6) {
    // 5-6 لاعبين: مستذئبان، عراف، حارس
    totalWerewolves = 2;
    needSeer = true;
    needGuardian = true;
  } else if (playerCount <= 8) {
    // 7-8 لاعبين: مستذئبان، عراف، حارس، محقق
    totalWerewolves = 2;
    needSeer = true;
    needGuardian = true;
    needDetective = true;
  } else if (playerCount <= 10) {
    // 9-10 لاعبين: 3 مستذئبين، عراف، حارس، محقق، قناص
    totalWerewolves = 3;
    needSeer = true;
    needGuardian = true; 
    needDetective = true;
    needSniper = true;
  } else {
    // 11+ لاعبين: 3-4 مستذئبين، وكل الأدوار المتقدمة
    totalWerewolves = Math.min(4, Math.floor(playerCount / 3));
    needSeer = true;
    needGuardian = true;
    needDetective = true;
    needSniper = true;
    needReviver = true;
    needWizard = true;
  }
  
  // توزيع أدوار المستذئبين - مع إعطاء الأولوية لزعيم المستذئبين
  if (totalWerewolves > 0 && werewolfRoles.includes('werewolfLeader')) {
    roleCount.werewolfLeader = 1;
    totalWerewolves -= 1;
  }
  
  // إضافة باقي المستذئبين العاديين إن وجدوا
  if (totalWerewolves > 0 && werewolfRoles.includes('werewolf')) {
    roleCount.werewolf = totalWerewolves;
  } else {
    // إذا لم يتم تفعيل دور المستذئب العادي، نستخدم القرويين كبديل
    // ولكن نحافظ على الحد الأدنى لعدد المستذئبين
    totalWerewolves = 0;
  }
  
  // توزيع أدوار القرية الخاصة فقط إذا كانت مفعلة
  if (needSeer && villageRoles.includes('seer')) {
    roleCount.seer = 1;
  }
  
  if (needGuardian && villageRoles.includes('guardian')) {
    roleCount.guardian = 1;
  }
  
  if (needDetective && villageRoles.includes('detective')) {
    roleCount.detective = 1;
  }
  
  if (needSniper && villageRoles.includes('sniper')) {
    roleCount.sniper = 1;
  }
  
  if (needReviver && villageRoles.includes('reviver')) {
    roleCount.reviver = 1;
  }
  
  if (needWizard && villageRoles.includes('wizard')) {
    roleCount.wizard = 1;
  }
  
  // حساب عدد الأدوار المخصصة وإكمال بقية اللاعبين كقرويين عاديين
  const assignedRoles = Object.values(roleCount).reduce((sum, count) => sum + count, 0);
  roleCount.villager = playerCount - assignedRoles;
  
  // تسجيل توزيع الأدوار
  log(`Role balance for ${playerCount} players: ${JSON.stringify(roleCount)}`, 'discord-game');
  
  return roleCount;
}
