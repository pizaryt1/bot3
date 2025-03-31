import { 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder,
  AttachmentBuilder
} from 'discord.js';
import { RoleType } from '@shared/schema';
import { getRoleEmoji, getRoleDisplayName } from './roleConfigView';
import { createRolesDistributionCanvas } from '../utils/canvasGenerator';
import { log } from '../../vite';
import path from 'path';
import { getGameManager } from '../game/gameManager';

// Create the role distribution
export async function createRoleDistributionEmbed(gameId: number, enabledRoles: RoleType[]) {
  try {
    // Get the gamestate to access actual assigned roles
    const gameManager = getGameManager();
    const gameState = gameManager.getGameState(gameId);

    if (!gameState) {
      throw new Error(`Game with ID ${gameId} not found`);
    }

    // Get all players with their assigned roles
    const assignedRoleTypes: RoleType[] = [];
    gameState.getAllPlayers().forEach(player => {
      if (player.role) {
        assignedRoleTypes.push(player.role);
      }
    });
    
    // Generate the role distribution image based on actual assigned roles (not just enabled roles)
    const rolesImageBuffer = await createRolesDistributionCanvas(assignedRoleTypes);
    const rolesAttachment = new AttachmentBuilder(rolesImageBuffer, { name: 'roles-distribution.png' });
    
    // Return only the file, no embed or components
    return {
      files: [rolesAttachment],
      components: [] // No components for this view
    };
  } catch (error) {
    log(`Error creating role distribution: ${error}`, 'discord');
    
    // Return empty in case of error (will be handled in the calling function)
    return {
      files: [],
      components: []
    };
  }
}

// Create embeds for each role to be sent to players
export function createRoleAssignmentEmbed(role: RoleType, description: string, teammates?: string[]) {
  // Get the role image path based on role type
  let roleImagePath = '';
  if (role === 'werewolf') {
    roleImagePath = path.join(process.cwd(), 'attached_assets', 'مستذئب.png');
  } else if (role === 'werewolfLeader') {
    roleImagePath = path.join(process.cwd(), 'attached_assets', 'زعيم المستذئبين.png');
  } else if (role === 'wizard') {
    roleImagePath = path.join(process.cwd(), 'attached_assets', 'الساحر.png');
  } else {
    roleImagePath = path.join(process.cwd(), 'attached_assets', `${getRoleDisplayName(role)}.webp`);
  }
  const roleImageAttachment = new AttachmentBuilder(roleImagePath, { name: `${role}-image.png` });
  
  const embed = new EmbedBuilder()
    .setTitle(`دورك: ${getRoleDisplayName(role)} ${getRoleEmoji(role)}`)
    .setColor(getRoleColor(role))
    .setDescription(description)
    .setImage(`attachment://${role}-image.png`);
  
  // Add role instructions
  embed.addFields({ name: 'مهامك:', value: getRoleInstructions(role) });
  
  // Add teammates field for werewolves
  if (teammates && (role === 'werewolf' || role === 'werewolfLeader')) {
    embed.addFields({ 
      name: 'فريق المستذئبين:', 
      value: teammates.length > 0 ? teammates.join('\n') : 'أنت المستذئب الوحيد!' 
    });
  }
  
  return {
    embed,
    files: [roleImageAttachment]
  };
}

// Helper function to get role color
function getRoleColor(role: RoleType): number {
  switch (role) {
    case 'villager': return 0x57F287; // Green
    case 'werewolf': 
    case 'werewolfLeader': return 0xED4245; // Red
    case 'seer': return 0x5865F2; // Blue
    case 'detective': return 0xFEE75C; // Yellow
    case 'guardian': return 0x57F287; // Green
    case 'sniper': return 0xED4245; // Red
    case 'reviver': return 0x57F287; // Green
    case 'wizard': return 0x9B59B6; // Purple
    default: return 0x95A5A6; // Gray
  }
}

// Helper function to get role instructions
function getRoleInstructions(role: RoleType): string {
  switch (role) {
    case 'villager':
      return 'ليس لديك قدرات خاصة. هدفك هو التعاون مع الآخرين لاكتشاف هوية المستذئبين وإقصائهم قبل أن يقضوا على القرويين.';
    
    case 'werewolf':
      return 'في الليل، ستختار مع باقي المستذئبين ضحية للقضاء عليها. في النهار، تظاهر بأنك قروي عادي وحاول إقناع الآخرين بأنك بريء.';
    
    case 'werewolfLeader':
      return 'أنت قائد المستذئبين. لديك نفس قدرات المستذئب العادي، بالإضافة إلى قدرة خاصة تمكنك من تحويل لاعب آخر إلى مستذئب (مرة واحدة فقط خلال اللعبة).';
    
    case 'seer':
      return 'في كل ليلة، يمكنك اختيار لاعب لتكشف هويته (هل هو مستذئب أم قروي). استخدم هذه المعلومات بحكمة لمساعدة القرويين.';
    
    case 'detective':
      return 'في كل ليلة، يمكنك اختيار لاعب للتحقيق في هويته بشكل دقيق. ستحصل على معلومات أكثر تفصيلاً من العراف.';
    
    case 'guardian':
      return 'في كل ليلة، يمكنك اختيار لاعب لحمايته من هجمات المستذئبين. لا يمكنك حماية نفس الشخص ليلتين متتاليتين.';
    
    case 'sniper':
      return 'لديك طلقتان فقط خلال اللعبة. في أي وقت، يمكنك استخدام طلقة لقتل لاعب تشك فيه. كن حذراً، فقد تقتل قروياً!';
    
    case 'reviver':
      return 'يمكنك إحياء لاعب واحد فقط طوال اللعبة بعد موته. اختر بحكمة من ستعيده للحياة.';
    
    case 'wizard':
      return 'لديك قدرتان يمكنك استخدام كل منهما مرة واحدة فقط: إكسير الحماية (يحمي الجميع لليلة واحدة) والسم (لقتل لاعب مشكوك فيه).';
    
    default:
      return 'لم يتم العثور على تعليمات لهذا الدور.';
  }
}