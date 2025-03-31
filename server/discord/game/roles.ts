import { RoleType } from '@shared/schema';

// Role information
export interface Role {
  name: RoleType;
  arabicName: string;
  team: 'village' | 'werewolf';
  description: string;
  emoji: string;
  color: string;
  priority: number; // For night phase order
  isBasic: boolean;
}

// Define all roles
export const ROLES: Record<RoleType, Role> = {
  villager: {
    name: 'villager',
    arabicName: 'القروي',
    team: 'village',
    description: 'لا يمتلك المهارات الخاصة، ولكن هدفه هو التعاون مع باقي القرويين لكشف المستذئبين وطردهم.',
    emoji: '🧑‍🌾',
    color: '#57F287',
    priority: 0,
    isBasic: true
  },
  
  werewolf: {
    name: 'werewolf',
    arabicName: 'المستذئب',
    team: 'werewolf',
    description: 'يعمل ضمن فريق المستذئبين، ويختار لاعبًا لقتله في مرحلة الليل. يجب أن يظل مخفيًا ويخدع القرويين.',
    emoji: '🐺',
    color: '#ED4245',
    priority: 10,
    isBasic: true
  },
  
  werewolfLeader: {
    name: 'werewolfLeader',
    arabicName: 'زعيم المستذئبين',
    team: 'werewolf',
    description: 'يمتلك القدرة على تحويل لاعب آخر إلى مستذئب (لمرة واحدة فقط خلال اللعبة).',
    emoji: '👑',
    color: '#8B0000',
    priority: 11,
    isBasic: false
  },
  
  seer: {
    name: 'seer',
    arabicName: 'العراف',
    team: 'village',
    description: 'يستطيع كشف هوية أي لاعب في كل ليلة (هل هو مستذئب أم قروي).',
    emoji: '👁️',
    color: '#5865F2',
    priority: 20,
    isBasic: true
  },
  
  detective: {
    name: 'detective',
    arabicName: 'المحقق',
    team: 'village',
    description: 'يستطيع كشف هوية لاعب بشكل دقيق خلال مرحلة الليل.',
    emoji: '🔍',
    color: '#FEE75C',
    priority: 25,
    isBasic: false
  },
  
  guardian: {
    name: 'guardian',
    arabicName: 'الحارس',
    team: 'village',
    description: 'يختار لاعبًا واحدًا لحمايته من القتل خلال الليل، ولا يمكنه حماية نفس الشخص ليلتين متتاليتين.',
    emoji: '🛡️',
    color: '#57F287',
    priority: 30,
    isBasic: true
  },
  
  sniper: {
    name: 'sniper',
    arabicName: 'القناص',
    team: 'village',
    description: 'يمتلك طلقتين يمكنه استخدامهما لقتل لاعب. يجب عليه أن يكون دقيقًا في اختيار هدفه.',
    emoji: '🎯',
    color: '#FF7B1C',
    priority: 35,
    isBasic: false
  },
  
  reviver: {
    name: 'reviver',
    arabicName: 'المنعش',
    team: 'village',
    description: 'يمكنه إحياء لاعب قُتل خلال الليل مرة واحدة طوال اللعبة.',
    emoji: '💓',
    color: '#57F287',
    priority: 40,
    isBasic: false
  },
  
  wizard: {
    name: 'wizard',
    arabicName: 'الساحر',
    team: 'village',
    description: 'يمتلك إكسيرًا يمكنه استخدامه لحماية كل اللاعبين من القتل في مرحلة الليل، أو استخدام سم لقتل لاعب معين.',
    emoji: '🧙',
    color: '#9B59B6',
    priority: 45,
    isBasic: false
  }
};

// Get all roles
export function getAllRoles(): Role[] {
  return Object.values(ROLES);
}

// Get basic roles
export function getBasicRoles(): Role[] {
  return Object.values(ROLES).filter(role => role.isBasic);
}

// Get additional roles
export function getAdditionalRoles(): Role[] {
  return Object.values(ROLES).filter(role => !role.isBasic);
}

// Get village team roles
export function getVillageRoles(): Role[] {
  return Object.values(ROLES).filter(role => role.team === 'village');
}

// Get werewolf team roles
export function getWerewolfRoles(): Role[] {
  return Object.values(ROLES).filter(role => role.team === 'werewolf');
}

// Get role by name
export function getRole(name: RoleType): Role {
  return ROLES[name];
}
