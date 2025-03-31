import { 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  ButtonInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  ChannelType,
  TextChannel
} from 'discord.js';
import { storage } from '../../storage';
import { log } from '../../vite';
import { getGameManager } from '../game/gameManager';
import { RoleType } from '@shared/schema';
import { createRoleDistributionEmbed } from './roleDistributionView';
import { getOptimalRoles, balanceRoles } from '../utils/roleBalancer';
import { storeInteraction } from '../utils/interactionStorage';
import { startNightPhase } from './gamePhaseManager';

// دالة مساعدة لعرض التوزيع المثالي للأدوار بناءً على عدد اللاعبين
function getIdealRoleDistribution(playerCount: number): string {
  // استخدام مصفوفة من جميع الأدوار الممكنة لحساب التوزيع المثالي
  const allPossibleRoles: RoleType[] = [
    'villager', 'werewolf', 'werewolfLeader', 'seer', 
    'guardian', 'detective', 'sniper', 'reviver', 'wizard'
  ];
  
  // الحصول على التوزيع المثالي
  const roleDistribution = balanceRoles(playerCount, allPossibleRoles);
  
  // بناء نص وصفي للتوزيع
  let distributionText = '';
  
  // إضافة أدوار المستذئبين أولاً
  const werewolfRoles = [
    { role: 'werewolf', count: roleDistribution.werewolf },
    { role: 'werewolfLeader', count: roleDistribution.werewolfLeader }
  ].filter(r => r.count > 0);
  
  if (werewolfRoles.length > 0) {
    distributionText += '**فريق المستذئبين:**\n';
    werewolfRoles.forEach(r => {
      distributionText += `${getRoleEmoji(r.role as RoleType)} ${getRoleDisplayName(r.role as RoleType)}: ${r.count}\n`;
    });
  }
  
  // إضافة أدوار القرية
  const villageRoles = [
    { role: 'villager', count: roleDistribution.villager },
    { role: 'seer', count: roleDistribution.seer },
    { role: 'guardian', count: roleDistribution.guardian },
    { role: 'detective', count: roleDistribution.detective },
    { role: 'sniper', count: roleDistribution.sniper },
    { role: 'reviver', count: roleDistribution.reviver },
    { role: 'wizard', count: roleDistribution.wizard }
  ].filter(r => r.count > 0);
  
  if (villageRoles.length > 0) {
    distributionText += '**فريق القرية:**\n';
    villageRoles.forEach(r => {
      distributionText += `${getRoleEmoji(r.role as RoleType)} ${getRoleDisplayName(r.role as RoleType)}: ${r.count}\n`;
    });
  }
  
  return distributionText;
}

// Create the role configuration embed
export async function createRoleConfigEmbed(gameId: number) {
  const game = await storage.getGame(gameId);
  if (!game) {
    throw new Error(`Game with ID ${gameId} not found`);
  }
  
  const players = await storage.getGamePlayers(gameId);
  const roles = await storage.getGameRoles(gameId);
  
  // Get basic roles
  const basicRoles = roles.filter(r => r.isBasic);
  const additionalRoles = roles.filter(r => !r.isBasic);
  
  // Create the embed
  const embed = new EmbedBuilder()
    .setTitle('إعدادات الأدوار')
    .setColor('#FF7B1C')
    .setDescription(`يمكنك تفعيل أو تعطيل الأدوار الإضافية حسب رغبتك. عدد اللاعبين: ${players.length}`)
    .addFields(
      { 
        name: 'الأدوار الأساسية', 
        value: basicRoles.map(r => `${getRoleEmoji(r.roleName as RoleType)} **${getRoleDisplayName(r.roleName as RoleType)}**: أساسي`).join('\n') 
      },
      { 
        name: 'الأدوار الإضافية', 
        value: additionalRoles.length > 0 
          ? additionalRoles.map(r => 
              `${getRoleEmoji(r.roleName as RoleType)} **${getRoleDisplayName(r.roleName as RoleType)}**: ${r.isEnabled ? '✅ مفعل' : '❌ معطل'}`
            ).join('\n')
          : 'لا توجد أدوار إضافية متاحة.' 
      },
      {
        name: 'توازن الأدوار',
        value: 'سيتم تحديد توازن الأدوار بشكل أساسي حسب عدد اللاعبين، مع مراعاة الأدوار المفعلة.\n' +
               `🌟 **التوزيع المثالي لـ ${players.length} لاعبين:**\n` +
               getIdealRoleDistribution(players.length)
      }
    )
    .setFooter({ text: 'للمالك فقط - قم بتفعيل الأدوار التي ترغب بها ثم ابدأ الجولة' });

  // Create role toggle buttons for additional roles
  const roleToggleRows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();
  let buttonCount = 0;

  for (const role of additionalRoles) {
    // Create a button for each additional role
    const button = new ButtonBuilder()
      .setCustomId(`role_toggle_${role.roleName}_${gameId}`)
      .setLabel(getRoleDisplayName(role.roleName as RoleType))
      .setStyle(role.isEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji(getRoleEmoji(role.roleName as RoleType));
    
    currentRow.addComponents(button);
    buttonCount++;
    
    // Maximum 5 buttons per row
    if (buttonCount === 5) {
      roleToggleRows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
      buttonCount = 0;
    }
  }
  
  // Add the last row if it has any buttons
  if (buttonCount > 0) {
    roleToggleRows.push(currentRow);
  }
  
  // Create action buttons
  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`role_auto_${gameId}`)
        .setLabel('تعيين تلقائي')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🧩'),
      new ButtonBuilder()
        .setCustomId(`role_start_${gameId}`)
        .setLabel('بدء الجولة')
        .setStyle(ButtonStyle.Success)
        .setEmoji('▶️')
    );
  
  // Combine all rows
  const components = [...roleToggleRows, actionRow];
  
  return {
    embed: embed,
    components: components
  };
}

// Handle button interactions for the role config view
export async function handleRoleConfigViewButtons(interaction: ButtonInteraction) {
  const customId = interaction.customId;
  const gameId = parseInt(customId.split('_').pop() || '0');
  
  if (isNaN(gameId) || gameId <= 0) {
    await interaction.reply({
      content: 'خطأ في معرف اللعبة.',
      ephemeral: true
    });
    return;
  }
  
  const game = await storage.getGame(gameId);
  if (!game) {
    await interaction.reply({
      content: 'لم يتم العثور على اللعبة.',
      ephemeral: true
    });
    return;
  }
  
  // Only the game owner can interact with these buttons
  if (interaction.user.id !== game.ownerId) {
    await interaction.reply({
      content: 'فقط مالك اللعبة يمكنه تغيير إعدادات الأدوار.',
      ephemeral: true
    });
    return;
  }
  
  // Toggle role button
  if (customId.startsWith('role_toggle_')) {
    const roleName = customId.split('_')[2] as RoleType;
    
    // Get current role status
    const roles = await storage.getGameRoles(gameId);
    const role = roles.find(r => r.roleName === roleName);
    
    if (!role) {
      await interaction.reply({
        content: 'لم يتم العثور على الدور.',
        ephemeral: true
      });
      return;
    }
    
    // Toggle role enabled status
    const newStatus = !role.isEnabled;
    await storage.updateGameRole(gameId, roleName, newStatus);
    
    // Update the embed
    const { embed, components } = await createRoleConfigEmbed(gameId);
    
    await interaction.update({
      embeds: [embed],
      components: components
    });
  }
  // Auto-assign roles button
  else if (customId.startsWith('role_auto_')) {
    const players = await storage.getGamePlayers(gameId);
    
    // Determine optimal role distribution based on player count
    const optimalRoles = getOptimalRoles(players.length);
    
    // Update all roles
    for (const [role, enabled] of Object.entries(optimalRoles)) {
      await storage.updateGameRole(gameId, role as RoleType, enabled);
    }
    
    // Update the embed
    const { embed, components } = await createRoleConfigEmbed(gameId);
    
    await interaction.update({
      embeds: [embed],
      components: components
    });
    
    await interaction.followUp({
      content: 'تم تعيين الأدوار تلقائيًا بناءً على عدد اللاعبين.',
      ephemeral: true
    });
  }
  // Start game button
  else if (customId.startsWith('role_start_')) {
    const players = await storage.getGamePlayers(gameId);
    if (players.length < 3) {
      // إنشاء إمبيد احترافي يوضح عدم اكتمال عدد اللاعبين
      const notEnoughPlayersEmbed = new EmbedBuilder()
        .setTitle('⚠️ عدد اللاعبين غير كافي')
        .setColor('#FF5555')
        .setDescription(`
          ## عذراً، لا يمكن بدء اللعبة
          
          **سبب المشكلة**: يوجد حالياً ${players.length} لاعب فقط في اللعبة.
          **الحل**: تحتاج إلى 3 لاعبين على الأقل لبدء اللعبة.
          
          قم بدعوة المزيد من اللاعبين للانضمام إلى اللعبة ثم حاول مرة أخرى.
        `)
        .setFooter({ text: 'سيتم إلغاء هذه المحاولة تلقائياً بعد 5 ثوانٍ' });
      
      // أرسل الإمبيد كرسالة عامة (ليست خاصة) لكل اللاعبين ليروا المشكلة
      const reply = await interaction.reply({
        embeds: [notEnoughPlayersEmbed],
        ephemeral: false
      });
      
      // بعد 5 ثوانٍ، قم بحذف الرسالة وإلغاء اللعبة
      setTimeout(async () => {
        try {
          // حذف الرسالة
          await reply.delete();
          
          // إرسال رسالة متابعة خاصة للمالك فقط
          await interaction.followUp({
            content: 'تم إلغاء محاولة بدء اللعبة بسبب عدم وجود عدد كافٍ من اللاعبين. يمكنك المحاولة مرة أخرى عندما ينضم المزيد من اللاعبين.',
            ephemeral: true
          });
        } catch (error) {
          log(`Error deleting not enough players message: ${error}`, 'discord-game');
        }
      }, 5000);
      
      return;
    }

    // Store interaction for the game owner
    if (interaction.user.id === game.ownerId) {
      storeInteraction(interaction.user.id, interaction);
      log(`Stored interaction for game owner ${interaction.user.username} (${interaction.user.id})`, 'discord-debug');
    }
    
    // Update game status
    await storage.updateGameStatus(gameId, 'running');
    
    // Get enabled roles
    const roleRecords = await storage.getGameRoles(gameId);
    const enabledRoles = roleRecords.filter(r => r.isEnabled).map(r => r.roleName as RoleType);
    
    // Get the game manager and assign roles
    const gameManager = getGameManager();
    const gameState = gameManager.getGameState(gameId);
    
    if (!gameState) {
      await interaction.reply({
        content: 'حدث خطأ أثناء بدء اللعبة.',
        ephemeral: true
      });
      return;
    }
    
    // First, defer the reply to the interaction to avoid timeout
    await interaction.deferUpdate();
    
    // Add a notice about how roles are distributed (ephemeral message only to the game owner)
    try {
      await interaction.followUp({
        content: `⚠️ **ملاحظة هامة**: سيتم توزيع الأدوار بشكل أساسي حسب عدد اللاعبين (${players.length} لاعبين) مع مراعاة الأدوار المفعلة. التوزيع النهائي قد يختلف عن الأدوار المفعلة إذا تطلب ذلك توازن اللعبة.`,
        ephemeral: true
      });
    } catch (error) {
      log(`Error sending followUp message: ${error}`, 'discord-game');
    }
    
    // Assign roles to players
    gameManager.assignRoles(gameId, enabledRoles);
    
    // Try to delete all previous messages to keep the channel clean
    try {
      // Get the channel and the message
      const channel = interaction.channel;
      if (channel && channel.isTextBased()) {
        // We'll clear our own previous message by editing it to a simple "starting game" message
        await interaction.editReply({
          content: `⏳ **جاري بدء اللعبة...**`,
          components: [],
          embeds: []
        });
      }
    } catch (error) {
      log(`Error clearing messages: ${error}`, 'discord-game');
    }
    
    // Store the message ID without sending an extra message
    try {
      // Get the current message ID for future reference
      const message = await interaction.fetchReply();
      await storage.updateGameMessage(gameId, message.id);
    } catch (error) {
      log(`Error updating game message: ${error}`, 'discord-game');
    }
    
    // After 5 seconds, show the role distribution image with a good message
    setTimeout(async () => {
      try {
        // Get the distribution image based on actual assigned roles
        const { files, components } = await createRoleDistributionEmbed(gameId, enabledRoles);
        
        // Send the image with a professional message using followUp
        await interaction.followUp({
          content: `# 🎭 توزيع الأدوار

تم توزيع الأدوار على جميع اللاعبين بنجاح! تحقق من الرسالة الخاصة بك لمعرفة دورك.
*كن حذراً من كشف دورك للآخرين! 🤫*

**تذكير بالقواعد**: 
• المستذئبون يعرفون بعضهم البعض
• القرويون يجب عليهم اكتشاف من هم المستذئبون
• كل دور له قدرات خاصة، راجع تفاصيل دورك في الرسالة الخاصة`,
          files: files,
          components: components || []
        });
      } catch (error) {
        log(`Error sending role distribution image: ${error}`, 'discord-game');
      }
    }, 5000);
    
    // Send role assignments to players
    setTimeout(() => {
      gameManager.sendRoleAssignments(gameId);
      
      // بعد إرسال الأدوار، ابدأ مرحلة الليل الأولى
      setTimeout(async () => {
        try {
          await startNightPhase(gameId, interaction);
        } catch (error) {
          log(`Error starting first night phase: ${error}`, 'discord-game');
        }
      }, 5000); // بدء الليل بعد 5 ثوانٍ من إرسال الأدوار
    }, 8000); // تأخير أطول قليلاً للتأكد من أن الصورة تم عرضها أولاً
  }
}

// Helper functions for role display
export function getRoleEmoji(role: RoleType): string {
  switch (role) {
    case 'villager': return '🧑‍🌾';
    case 'werewolf': return '🐺';
    case 'werewolfLeader': return '👑';
    case 'seer': return '👁️';
    case 'detective': return '🔍';
    case 'guardian': return '🛡️';
    case 'sniper': return '🎯';
    case 'reviver': return '💓';
    case 'wizard': return '🧙';
    default: return '❓';
  }
}

export function getRoleDisplayName(role: RoleType): string {
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
