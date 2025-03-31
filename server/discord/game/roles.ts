import { RoleType } from '@shared/schema';

// تعريف نموذج الدور
interface Role {
  id: RoleType;
  name: string;
  description: string;
  team: 'villagers' | 'werewolves';
  nightAction: boolean;
  actionDescription?: string;
  image: string;
  icon: string;
  color: number;
}

// دليل الأدوار
const roles: Record<RoleType, Role> = {
  villager: {
    id: 'villager',
    name: 'قروي',
    description: 'أنت قروي عادي، مهمتك هي اكتشاف المستذئبين والتصويت ضدهم',
    team: 'villagers',
    nightAction: false,
    image: 'القروي.webp',
    icon: 'رمز القروي.png',
    color: 0x57F287 // لون أخضر
  },
  
  werewolf: {
    id: 'werewolf',
    name: 'مستذئب',
    description: 'أنت مستذئب، مهمتك هي التظاهر كقروي والقضاء على سكان القرية ليلاً',
    team: 'werewolves',
    nightAction: true,
    actionDescription: 'التصويت مع المستذئبين الآخرين لاختيار ضحية',
    image: 'مستذئب.png',
    icon: 'رمز المستذئب.png',
    color: 0xED4245 // لون أحمر
  },
  
  werewolfLeader: {
    id: 'werewolfLeader',
    name: 'زعيم المستذئبين',
    description: 'أنت زعيم المستذئبين، لديك القرار النهائي في اختيار الضحية',
    team: 'werewolves',
    nightAction: true,
    actionDescription: 'اختيار ضحية للقتل بالتشاور مع المستذئبين الآخرين',
    image: 'زعيم المستذئبين.png',
    icon: 'رمز زعيم المستذئبين.png',
    color: 0xED4245 // لون أحمر
  },
  
  seer: {
    id: 'seer',
    name: 'العراف',
    description: 'أنت العراف، يمكنك معرفة هوية لاعب واحد كل ليلة',
    team: 'villagers',
    nightAction: true,
    actionDescription: 'اختيار لاعب لمعرفة إذا كان مستذئبًا أم لا',
    image: 'العراف.webp',
    icon: 'رمز العراف.png',
    color: 0x5865F2 // لون أزرق
  },
  
  guardian: {
    id: 'guardian',
    name: 'الحارس',
    description: 'أنت الحارس، يمكنك حماية لاعب واحد من هجوم المستذئبين كل ليلة',
    team: 'villagers',
    nightAction: true,
    actionDescription: 'اختيار لاعب لحمايته من هجوم المستذئبين',
    image: 'الحارس.webp',
    icon: 'رمز الحارس.png',
    color: 0x3498DB // لون أزرق فاتح
  },
  
  detective: {
    id: 'detective',
    name: 'المحقق',
    description: 'أنت المحقق، يمكنك التحقق من هوية لاعب واحد كل ليلة',
    team: 'villagers',
    nightAction: true,
    actionDescription: 'اختيار لاعب للتحقق من هويته',
    image: 'المحقق.webp',
    icon: 'رمز المحقق.png',
    color: 0x9B59B6 // لون أرجواني
  },
  
  sniper: {
    id: 'sniper',
    name: 'القناص',
    description: 'أنت القناص، يمكنك قتل لاعب واحد فقط خلال اللعبة',
    team: 'villagers',
    nightAction: true,
    actionDescription: 'اختيار لاعب لقتله (مرة واحدة فقط في اللعبة)',
    image: 'القناص.webp',
    icon: 'رمز القناص.png',
    color: 0xE67E22 // لون برتقالي
  },
  
  reviver: {
    id: 'reviver',
    name: 'المنعش',
    description: 'أنت المنعش، يمكنك إحياء لاعب ميت مرة واحدة خلال اللعبة',
    team: 'villagers',
    nightAction: true,
    actionDescription: 'اختيار لاعب ميت لإحيائه (مرة واحدة فقط في اللعبة)',
    image: 'المنعش.webp',
    icon: 'رمز المنعش.png',
    color: 0x1ABC9C // لون أخضر مزرق
  },
  
  wizard: {
    id: 'wizard',
    name: 'الساحر',
    description: 'أنت الساحر، يمكنك استخدام إكسير الحياة أو السم مرة واحدة لكل منهما خلال اللعبة',
    team: 'villagers',
    nightAction: true,
    actionDescription: 'إنقاذ الضحية باستخدام إكسير الحياة أو قتل لاعب باستخدام السم',
    image: 'الساحر.png',
    icon: 'رمز الساحر.png',
    color: 0xFF9800 // لون برتقالي
  }
};

/**
 * الحصول على معلومات دور معين
 */
export function getRole(role: RoleType): Role {
  return roles[role];
}

/**
 * الحصول على قائمة جميع الأدوار المتاحة
 */
export function getAllRoles(): Role[] {
  return Object.values(roles);
}

/**
 * الحصول على قائمة الأدوار الأساسية
 */
export function getBasicRoles(): Role[] {
  return [
    roles.villager,
    roles.werewolf,
    roles.werewolfLeader,
    roles.seer
  ];
}

/**
 * الحصول على قائمة الأدوار الخاصة
 */
export function getSpecialRoles(): Role[] {
  return [
    roles.guardian,
    roles.detective,
    roles.sniper,
    roles.reviver,
    roles.wizard
  ];
}

/**
 * الحصول على قائمة أدوار القرويين
 */
export function getVillagerRoles(): Role[] {
  return Object.values(roles).filter(role => role.team === 'villagers');
}

/**
 * الحصول على قائمة أدوار المستذئبين
 */
export function getWerewolfRoles(): Role[] {
  return Object.values(roles).filter(role => role.team === 'werewolves');
}