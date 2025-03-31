import { 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  CommandInteraction,
  ButtonInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageComponentInteraction,
  ChatInputCommandInteraction
} from 'discord.js';
import { RoleType } from '@shared/schema';
import { getStoredInteraction } from '../utils/interactionStorage';
import { createRoleAssignmentEmbed } from './roleDistributionView';
import { log } from '../../vite';

// Send ephemeral message to a player using their stored interaction
export async function sendEphemeralMessage(
  userId: string, 
  content: string,
  embed?: EmbedBuilder,
  components?: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[]
) {
  try {
    const interaction = getStoredInteraction(userId);
    
    if (!interaction) {
      log(`No stored interaction found for user ${userId}`, 'discord');
      return false;
    }
    
    // Check if the interaction has already been replied to
    if (interaction.replied) {
      await interaction.followUp({ 
        content, 
        embeds: embed ? [embed] : undefined,
        components,
        ephemeral: true 
      });
    } else {
      await interaction.reply({ 
        content, 
        embeds: embed ? [embed] : undefined,
        components,
        ephemeral: true 
      });
    }
    
    return true;
  } catch (error) {
    log(`Error sending ephemeral message to ${userId}: ${error}`, 'discord');
    return false;
  }
}

// Send role assignment to a player
export async function sendRoleAssignment(
  userId: string,
  username: string,
  role: RoleType,
  teammates?: string[]
) {
  try {
    const roleDescription = getRoleDescription(role);
    const { embed, files } = createRoleAssignmentEmbed(role, roleDescription, teammates);
    
    // Get stored interaction for the user
    const interaction = getStoredInteraction(userId);
    
    if (!interaction) {
      log(`No stored interaction found for user ${userId}`, 'discord');
      return false;
    }
    
    // Check if the interaction has already been replied to
    if (interaction.replied) {
      await interaction.followUp({ 
        content: `تم تعيينك كـ ${getRoleDisplayName(role)}`,
        embeds: [embed],
        files: files,
        ephemeral: true 
      });
    } else {
      await interaction.reply({ 
        content: `تم تعيينك كـ ${getRoleDisplayName(role)}`,
        embeds: [embed],
        files: files,
        ephemeral: true 
      });
    }
    
    return true;
  } catch (error) {
    log(`Error sending role assignment to ${userId}: ${error}`, 'discord');
    return false;
  }
}

// Get localized role display name
function getRoleDisplayName(role: RoleType): string {
  switch (role) {
    case 'villager': return 'القروي';
    case 'werewolf': return 'المستذئب';
    case 'werewolfLeader': return 'زعيم المستذئبين';
    case 'seer': return 'العراف';
    case 'detective': return 'المحقق';
    case 'guardian': return 'الحارس';
    case 'sniper': return 'القناص';
    case 'reviver': return 'المنعش';
    case 'wizard': return 'الساحر';
    default: return role;
  }
}

// Get role description for the player's role card
function getRoleDescription(role: RoleType): string {
  switch (role) {
    case 'villager':
      return 'أنت قروي عادي، مهمتك اكتشاف المستذئبين ومساعدة القرية على البقاء.';
    
    case 'werewolf':
      return 'الظلام يحيط بالغابة، ولقد تم اختيارك لتكون من بين المستذئبين...';
    
    case 'werewolfLeader':
      return 'أنت زعيم المستذئبين، لديك القدرة على تحويل أحد القرويين إلى مستذئب...';
    
    case 'seer':
      return 'النجوم تتحدث إليك، وبقدرتك على الرؤية يمكنك كشف الحقائق المخفية...';
    
    case 'detective':
      return 'عينك الفاحصة ترى ما لا يراه الآخرون، يمكنك التحقيق بدقة في هويات اللاعبين...';
    
    case 'guardian':
      return 'درعك المقدس يحمي القرويين، كل ليلة يمكنك حماية أحدهم من الموت...';
    
    case 'sniper':
      return 'بندقيتك جاهزة، لديك فرصتان فقط لإطلاق النار، فاختر هدفك بحكمة...';
    
    case 'reviver':
      return 'بين يديك القدرة على إعادة الحياة، يمكنك إنقاذ روح واحدة من الموت...';
    
    case 'wizard':
      return 'تمتلك قوى السحر العظيمة، إكسير الحماية والسم القاتل بين يديك...';
    
    default:
      return 'لم يتم تحديد وصف لهذا الدور.';
  }
}
