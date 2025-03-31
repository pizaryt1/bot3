import { 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  ButtonInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType
} from 'discord.js';
import { storage } from '../../storage';
import { log } from '../../vite';
import { getGameManager } from '../game/gameManager';
import { RoleType } from '@shared/schema';
import { createRoleDistributionEmbed } from './roleDistributionView';
import { getOptimalRoles, balanceRoles } from '../utils/roleBalancer';
import { storeInteraction } from '../utils/interactionStorage';

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
      await interaction.reply({
        content: 'يجب أن يكون هناك على الأقل 3 لاعبين لبدء اللعبة.',
        ephemeral: true
      });
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
    
    // Add a notice about how roles are distributed
    await interaction.followUp({
      content: `⚠️ **ملاحظة هامة**: سيتم توزيع الأدوار بشكل أساسي حسب عدد اللاعبين (${players.length} لاعبين) مع مراعاة الأدوار المفعلة. التوزيع النهائي قد يختلف عن الأدوار المفعلة إذا تطلب ذلك توازن اللعبة.`,
      ephemeral: true
    });
    
    // Assign roles to players
    gameManager.assignRoles(gameId, enabledRoles);
    
    // Create the role distribution embed
    const { embed, components, files } = await createRoleDistributionEmbed(gameId, enabledRoles);
    
    // Update the game message
    await interaction.update({
      embeds: [embed],
      components: components || [],
      files: files || []
    });
    
    // Send role assignments to players
    setTimeout(() => {
      gameManager.sendRoleAssignments(gameId);
    }, 5000); // 5 seconds delay
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
