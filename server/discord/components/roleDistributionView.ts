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

// Create the role distribution embed
export async function createRoleDistributionEmbed(gameId: number, enabledRoles: RoleType[]) {
  try {
    // Generate the role distribution image
    const rolesImageBuffer = await createRolesDistributionCanvas(enabledRoles);
    const rolesAttachment = new AttachmentBuilder(rolesImageBuffer, { name: 'roles-distribution.png' });
    
    // Create the embed
    const embed = new EmbedBuilder()
      .setTitle('توزيع الأدوار')
      .setColor('#FF7B1C')
      .setDescription('تم توزيع الأدوار على جميع اللاعبين. سيتم إرسال دورك لك برسالة خاصة.')
      .setImage('attachment://roles-distribution.png')
      .addFields(
        { 
          name: 'الأدوار النشطة', 
          value: enabledRoles.map(role => `${getRoleEmoji(role)} **${getRoleDisplayName(role)}**`).join('\n')
        },
        {
          name: 'بدء اللعبة',
          value: 'ستبدأ اللعبة خلال 5 ثوانٍ...'
        }
      );
    
    // No action buttons needed for this view
    return {
      embed: embed,
      components: [], // No components for this view
      files: [rolesAttachment]
    };
  } catch (error) {
    log(`Error creating role distribution embed: ${error}`, 'discord');
    
    // Fallback without image if there's an error
    const embed = new EmbedBuilder()
      .setTitle('توزيع الأدوار')
      .setColor('#FF7B1C')
      .setDescription('تم توزيع الأدوار على جميع اللاعبين. سيتم إرسال دورك لك برسالة خاصة.')
      .addFields(
        { 
          name: 'الأدوار النشطة', 
          value: enabledRoles.map(role => `${getRoleEmoji(role)} **${getRoleDisplayName(role)}**`).join('\n')
        },
        {
          name: 'بدء اللعبة',
          value: 'ستبدأ اللعبة خلال 5 ثوانٍ...'
        }
      );
    
    return {
      embed: embed,
      components: [] // No components for this view
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