import { 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  ButtonInteraction,
  User,
  AttachmentBuilder,
  GuildMember
} from 'discord.js';
import { storage } from '../../storage';
import { log } from '../../vite';
import { getGameManager } from '../game/gameManager';
import { getStoredInteraction, storeInteraction, storeUserForGame } from '../utils/interactionStorage';
import { createRoleConfigEmbed } from './roleConfigView';
import { createFeedbackModal } from './modals';
import path from 'path';

// Create the initial game embed
export function createInitialGameEmbed(ownerId: string, ownerUsername: string, gameId: number) {
  // Load the startup image
  const startupImagePath = path.join(process.cwd(), 'attached_assets', 'بداية.webp');
  const startupAttachment = new AttachmentBuilder(startupImagePath, { name: 'game-start.webp' });
  
  // Create the embed
  const embed = new EmbedBuilder()
    .setTitle('لعبة المستذئب')
    .setColor('#5865F2')
    .setDescription('لعبة المستذئب هي لعبة تفاعلية اجتماعية حيث يجب على القرويين اكتشاف وإقصاء المستذئبين قبل أن يتمكنوا من القضاء على جميع القرويين.')
    .addFields(
      { name: 'الأدوار الأساسية', value: 
        '🧑‍🌾 **القروي (Villager)**: لا يمتلك مهارات خاصة، يتعاون مع القرويين لكشف المستذئبين.\n' +
        '🐺 **المستذئب (Werewolf)**: يختار ضحية كل ليلة ويعمل على عدم كشف هويته.\n' +
        '🛡️ **الحارس (Guardian)**: يحمي لاعبًا كل ليلة من هجوم المستذئبين.\n' +
        '👁️ **العراف (Seer)**: يستطيع كشف هوية لاعب واحد كل ليلة.'
      },
      { name: 'اللاعبون المنضمون', value: `<@${ownerId}> (المالك)` },
      { name: 'العد التنازلي لبدء اللعبة', value: '00:30' }
    )
    .setFooter({ text: 'تم برمجة اللعبة بواسطة 7MOD' });

  // Create buttons
  const buttons1 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`game_join_${gameId}`)
        .setLabel('انضمام')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎮'),
      new ButtonBuilder()
        .setCustomId(`game_leave_${gameId}`)
        .setLabel('خروج')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🚪')
    );

  const buttons2 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`game_start_${gameId}`)
        .setLabel('بدء اللعبة')
        .setStyle(ButtonStyle.Success)
        .setEmoji('▶️'),
      new ButtonBuilder()
        .setCustomId(`game_rules_${gameId}`)
        .setLabel('عرض القواعد')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📜'),
      new ButtonBuilder()
        .setCustomId(`game_feedback_${gameId}`)
        .setLabel('إرسال اقتراح أو شكوى')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💬')
    );

  return {
    embed: embed,
    components: [buttons1, buttons2],
    files: [startupAttachment]
  };
}

// Update the player list in the embed
export async function updatePlayerList(gameId: number, interaction: ButtonInteraction) {
  try {
    const game = await storage.getGame(gameId);
    if (!game || !game.messageId) return;

    const players = await storage.getGamePlayers(gameId);
    const owner = players.find(p => p.userId === game.ownerId);
    
    if (!owner) return;

    let playerList = `<@${owner.userId}> (المالك)`;
    players
      .filter(p => p.userId !== game.ownerId)
      .forEach(player => {
        playerList += `\n<@${player.userId}>`;
      });
    
    const channel = interaction.channel;
    if (!channel) return;
    
    const message = await channel.messages.fetch(game.messageId);
    if (!message) return;
    
    const embed = EmbedBuilder.from(message.embeds[0])
      .spliceFields(1, 1, { name: 'اللاعبون المنضمون', value: playerList });
    
    const gameManager = getGameManager();
    const countdownTime = gameManager.getCountdownTime(gameId);
    if (countdownTime !== null) {
      const minutes = Math.floor(countdownTime / 60);
      const seconds = countdownTime % 60;
      const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      embed.spliceFields(2, 1, { name: 'العد التنازلي لبدء اللعبة', value: timeString });
    }
    
    await message.edit({ embeds: [embed], components: message.components });
  } catch (error) {
    log(`Error updating player list: ${error}`, 'discord');
  }
}

// Handle button interactions for the initial view
export async function handleInitialViewButtons(interaction: ButtonInteraction) {
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
  
  const gameManager = getGameManager();
  
  // Join button
  if (customId.startsWith('game_join_')) {
    if (game.status !== 'setup') {
      await interaction.reply({
        content: 'لا يمكنك الانضمام إلى اللعبة بعد بدئها.',
        ephemeral: true
      });
      return;
    }
    
    // استخدام الاسم الظاهر (DisplayName) بدلاً من اسم المستخدم العادي
    const displayName = interaction.user.globalName || interaction.user.username;
    
    const player = await storage.addPlayerToGame(gameId, interaction.user.id, displayName);
    gameManager.addPlayer(gameId, interaction.user.id, displayName);
    
    // تخزين معلومات المستخدم وقناة اللعبة
    storeUserForGame(gameId, interaction.user.id, displayName, interaction.channelId);
    
    await updatePlayerList(gameId, interaction);
    
    // تخزين التفاعل قبل استجابة التفاعل
    storeInteraction(interaction.user.id, interaction);
    
    // إرسال رسالة مخفية تؤكد الانضمام
    await interaction.reply({
      content: `تم انضمامك إلى اللعبة ${game.id} بنجاح!`,
      ephemeral: true
    });
  }
  // Leave button
  else if (customId.startsWith('game_leave_')) {
    if (game.status !== 'setup') {
      await interaction.reply({
        content: 'لا يمكنك الخروج من اللعبة بعد بدئها.',
        ephemeral: true
      });
      return;
    }
    
    // Game owner can't leave
    if (interaction.user.id === game.ownerId) {
      await interaction.reply({
        content: 'لا يمكن لمالك اللعبة الخروج. يمكنك إلغاء اللعبة بدلاً من ذلك.',
        ephemeral: true
      });
      return;
    }
    
    const success = await storage.removePlayerFromGame(gameId, interaction.user.id);
    if (success) {
      gameManager.removePlayer(gameId, interaction.user.id);
      await updatePlayerList(gameId, interaction);
      
      await interaction.reply({
        content: 'تم الخروج من اللعبة بنجاح.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'لم تكن منضمًا إلى هذه اللعبة.',
        ephemeral: true
      });
    }
  }
  // Start game button (only for owner)
  else if (customId.startsWith('game_start_')) {
    if (interaction.user.id !== game.ownerId) {
      await interaction.reply({
        content: 'فقط مالك اللعبة يمكنه بدء اللعبة.',
        ephemeral: true
      });
      return;
    }
    
    if (game.status !== 'setup') {
      await interaction.reply({
        content: 'اللعبة قد بدأت بالفعل.',
        ephemeral: true
      });
      return;
    }
    
    const players = await storage.getGamePlayers(gameId);
    if (players.length < 3) {
      await interaction.reply({
        content: 'يجب أن يكون هناك على الأقل 3 لاعبين لبدء اللعبة.',
        ephemeral: true
      });
      return;
    }
    
    // ابدأ الرد على التفاعل بالتأجيل لمنع أخطاء التوقيت
    await interaction.deferUpdate();
    
    // Store interaction for the game owner before updating the status
    storeInteraction(interaction.user.id, interaction);
    log(`Stored interaction for game owner ${interaction.user.username} (${interaction.user.id})`, 'discord-debug');
    
    // Update game status to configuring - this is important to keep it in configuration mode
    await storage.updateGameStatus(gameId, 'configuring');
    
    // Get the game state from game manager and update the status there too
    const gameManager = getGameManager();
    const gameState = gameManager.getGameState(gameId);
    if (gameState) {
      gameState.status = 'configuring';
      
      // Stop the countdown
      gameManager.stopCountdown(gameId);
    }
    
    try {
      // Move to role config view
      const { embed, components } = await createRoleConfigEmbed(gameId);
      
      // استخدم editReply بدلاً من update لأننا استخدمنا deferUpdate
      await interaction.editReply({
        embeds: [embed],
        components: components
      });
    } catch (error) {
      log(`Error updating to role config view: ${error}`, 'discord-game');
      
      // في حالة حدوث خطأ، حاول الاستجابة مع رسالة بسيطة
      try {
        await interaction.followUp({
          content: 'حدث خطأ أثناء الانتقال إلى إعدادات الأدوار. يرجى المحاولة مرة أخرى.',
          ephemeral: true
        });
      } catch (followUpError) {
        log(`Error sending follow-up message: ${followUpError}`, 'discord-game');
      }
    }
  }
  // Rules button
  else if (customId.startsWith('game_rules_')) {
    const rulesEmbed = new EmbedBuilder()
      .setTitle('قواعد لعبة المستذئب')
      .setColor('#5865F2')
      .setDescription('نظرة عامة على قواعد اللعبة والأدوار المختلفة.')
      .addFields(
        { name: 'نظرة عامة', value: 
          'لعبة المستذئب هي لعبة اجتماعية تفاعلية تدور أحداثها في قرية يسكنها قرويون ومستذئبون متخفون. تنقسم اللعبة إلى مراحل نهار وليل، حيث يحاول القرويون كشف المستذئبين خلال النهار، بينما يقوم المستذئبون باختيار ضحية ليقتلوها في الليل.'
        },
        { name: 'مراحل اللعبة', value:
          '**مرحلة الليل**: يستيقظ كل دور حسب ترتيب معين لتنفيذ مهامه الخاصة. المستذئبون يختارون ضحية، العراف يكشف هوية لاعب، الحارس يحمي لاعبًا، وهكذا.\n\n' +
          '**مرحلة النهار**: يستيقظ الجميع ويكتشفون من قُتل في الليل. ثم يتناقشون لمعرفة من هو المستذئب، وفي النهاية يصوتون على طرد لاعب واحد.'
        },
        { name: 'الأدوار', value:
          '🧑‍🌾 **القروي (Villager)**: لا يمتلك المهارات الخاصة، ولكن هدفه هو التعاون مع باقي القرويين لكشف المستذئبين وطردهم.\n\n' +
          '🐺 **المستذئب (Werewolf)**: يعمل ضمن فريق المستذئبين، ويختار لاعبًا لقتله في مرحلة الليل. يجب أن يظل مخفيًا ويخدع القرويين.\n\n' +
          '👑 **زعيم المستذئبين (Werewolf Leader)**: يمتلك القدرة على تحويل لاعب آخر إلى مستذئب (لمرة واحدة فقط خلال اللعبة).\n\n' +
          '👁️ **العراف (Seer)**: يستطيع كشف هوية أي لاعب في كل ليلة (هل هو مستذئب أم قروي).\n\n' +
          '🔍 **المحقق (Detective)**: يستطيع كشف هوية لاعب بشكل دقيق خلال مرحلة الليل.\n\n' +
          '🛡️ **الحارس (Guardian)**: يختار لاعبًا واحدًا لحمايته من القتل خلال الليل، ولا يمكنه حماية نفس الشخص ليلتين متتاليتين.\n\n' +
          '🎯 **القناص (Sniper)**: يمتلك طلقتين يمكنه استخدامهما لقتل لاعب. يجب عليه أن يكون دقيقًا في اختيار هدفه.\n\n' +
          '💓 **المنعش (Reviver)**: يمكنه إحياء لاعب قُتل خلال الليل مرة واحدة طوال اللعبة.\n\n' +
          '🧙 **الساحر (Wizard)**: يمتلك إكسيرًا يمكنه استخدامه لحماية كل اللاعبين من القتل في مرحلة الليل، أو استخدام سم لقتل لاعب معين. يمكنه استخدام كل مهارة مرة واحدة.'
        },
        { name: 'شروط الفوز', value:
          '**فوز القرويين**: يفوز القرويون إذا تمكنوا من طرد جميع المستذئبين.\n\n' +
          '**فوز المستذئبين**: يفوز المستذئبون إذا تمكنوا من قتل عدد كافٍ من القرويين بحيث يتساوى عددهم مع عدد القرويين المتبقين.'
        }
      );
    
    await interaction.reply({
      embeds: [rulesEmbed],
      ephemeral: true
    });
  }
  // Feedback button
  else if (customId.startsWith('game_feedback_')) {
    const modal = createFeedbackModal(gameId);
    await interaction.showModal(modal);
  }
}
