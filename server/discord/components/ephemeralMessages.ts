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
  ChatInputCommandInteraction,
  TextChannel
} from 'discord.js';
import { RoleType } from '@shared/schema';
import { getStoredInteraction } from '../utils/interactionStorage';
import { createRoleAssignmentEmbed } from './roleDistributionView';
import { log } from '../../vite';
import { storage } from '../../storage';
import { getClient } from '../bot';

// إرسال رسالة مخفية باستخدام التفاعل المخزّن
export async function sendEphemeralReply(
  userId: string,
  content?: string,
  embeds?: EmbedBuilder[],
  components?: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[],
  files?: any[]
) {
  try {
    const interaction = getStoredInteraction(userId);
    
    if (!interaction) {
      log(`لا يوجد تفاعل مخزن للمستخدم ${userId}`, 'discord');
      return false;
    }
    
    // التحقق مما إذا كان التفاعل قد تم الرد عليه مسبقًا
    if (interaction.replied) {
      await interaction.followUp({
        content,
        embeds,
        components,
        files,
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content,
        embeds,
        components,
        files,
        ephemeral: true
      });
    }
    
    return true;
  } catch (error) {
    log(`خطأ في إرسال رسالة مخفية للمستخدم ${userId}: ${error}`, 'discord');
    return false;
  }
}

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
    const content = `تم تعيينك كـ ${getRoleDisplayName(role)}`;
    
    // محاولة أولى - الطريقة الجديدة باستخدام التفاعل المخزن
    const interaction = getStoredInteraction(userId);
    
    if (interaction) {
      try {
        // التحقق مما إذا كان التفاعل قد تم الرد عليه مسبقًا
        if (interaction.replied) {
          await interaction.followUp({ 
            content: content,
            embeds: [embed],
            files: files,
            ephemeral: true 
          });
          log(`Role assignment sent to ${username} (${userId}) via followUp`, 'discord-debug');
          return true;
        } else {
          await interaction.reply({ 
            content: content,
            embeds: [embed],
            files: files,
            ephemeral: true 
          });
          log(`Role assignment sent to ${username} (${userId}) via reply`, 'discord-debug');
          return true;
        }
      } catch (interactionError) {
        log(`Error using stored interaction for role assignment to ${userId}: ${interactionError}`, 'discord');
      }
    }
    
    // تخطي محاولة الرسائل المخفية المباشرة نظرًا لأننا أزلنا الدالة
    // استخدام sendEphemeralMessage بدلاً
    try {
      const success = await sendEphemeralMessage(
        userId, 
        content, 
        embed,
        []
      );
      
      if (success) {
        log(`Role assignment sent to ${username} (${userId}) via ephemeral message`, 'discord-debug');
        return true;
      }
    } catch (ephemeralError) {
      log(`Error sending ephemeral message to ${userId}: ${ephemeralError}`, 'discord');
    }
    
    // محاولة ثالثة - إرسال رسالة عامة مباشرة إلى القناة
    try {
      // نحتاج إلى معرفة أي لعبة ينتمي إليها هذا اللاعب
      const games = await storage.getActiveGames();
      for (const game of games) {
        const players = await storage.getGamePlayers(game.id);
        const player = players.find((p: any) => p.userId === userId);
        
        if (player) {
          // وجدنا اللاعب في هذه اللعبة، نحاول إرسال رسالة إلى القناة
          const channel = await getClient().channels.fetch(game.channelId) as TextChannel;
          if (channel) {
            await channel.send({
              content: `<@${userId}> تم تعيين دورك! تحقق من الرسائل المباشرة للتفاصيل.`
            });
            
            // ثم نرسل رسالة مباشرة
            const user = await getClient().users.fetch(userId);
            if (user) {
              await user.send({
                content: content,
                embeds: [embed],
                files: files
              });
              log(`Role assignment sent to ${username} (${userId}) via direct message`, 'discord-debug');
              return true;
            }
          }
        }
      }
    } catch (channelError) {
      log(`Error sending channel message to ${userId}: ${channelError}`, 'discord');
    }
    
    log(`Failed to send role assignment to ${username} (${userId}) - all methods failed`, 'discord');
    return false;
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
