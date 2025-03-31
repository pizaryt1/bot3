import { 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  ButtonInteraction,
  ChatInputCommandInteraction,
  MessageComponentInteraction,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  SelectMenuComponentOptionData,
  ComponentType,
  TextChannel
} from 'discord.js';
import { storage } from '../../storage';
import { log } from '../../vite';
import { getGameManager } from '../game/gameManager';
import { GamePhase, Player, NightActionTarget, GameState } from '../game/gameState';
import { getClient } from '../bot';
import { storeInteraction, getStoredInteraction } from '../utils/interactionStorage';
import { getRoleDisplayName, getRoleEmoji } from './roleConfigView';
import { RoleType } from '@shared/schema';
import fs from 'fs';
import path from 'path';

/**
 * بدء مرحلة الليل
 */
export async function startNightPhase(gameId: number, interaction: ButtonInteraction | ChatInputCommandInteraction) {
  try {
    // الحصول على حالة اللعبة
    const gameManager = getGameManager();
    const gameState = gameManager.getGameState(gameId);
    
    if (!gameState) {
      throw new Error(`لم يتم العثور على لعبة برقم ${gameId}`);
    }
    
    // تحديث حالة اللعبة
    gameState.setPhase(GamePhase.NIGHT);
    
    // الحصول على معلومات اللعبة من قاعدة البيانات
    const game = await storage.getGame(gameId);
    if (!game || !game.channelId) {
      throw new Error(`لم يتم العثور على معلومات اللعبة ${gameId}`);
    }
    
    // إعادة تعيين إجراءات الليل
    gameState.resetNightActions();
    
    // تهيئة الرسالة
    const client = getClient();
    const channel = await client.channels.fetch(game.channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`لم يتم العثور على القناة ${game.channelId}`);
    }
    
    // إنشاء رسالة بداية الليل
    const nightEmbed = new EmbedBuilder()
      .setTitle(`🌙 بداية الليل - اليوم ${gameState.day}`)
      .setColor('#000033')
      .setDescription(`
      # الليل قد حل على القرية
      
      **حان وقت الأدوار الليلية!** كل لاعب لديه قدرة ليلية سيتلقى رسالة خاصة لاستخدام قدرته.
      
      المستذئبون يستيقظون الآن لاختيار ضحيتهم...
      
      *انتظر حتى ينتهي الجميع من استخدام قدراتهم.*
      `)
      .setImage('attachment://بداية.webp');
    
    // إضافة صورة الليل
    const nightAttachment = new AttachmentBuilder(path.join('attached_assets', 'بداية.webp'));
    
    // إرسال رسالة بداية الليل
    await (channel as TextChannel).send({
      embeds: [nightEmbed],
      files: [nightAttachment]
    });
    
    // إنشاء رسالة عامة عن إجراءات الليل
    const nightActionEmbed = new EmbedBuilder()
      .setTitle(`🔮 إجراءات الليل - اليوم ${gameState.day}`)
      .setColor('#191970')
      .setDescription(`
      # أدوار الليل تنشط الآن...
      
      **العراف** يستخدم قدراته للكشف عن هوية أحد اللاعبين.
      
      **الحارس** يحمي أحد سكان القرية من هجمات الليل.
      
      **المستذئبون** يجتمعون لاختيار ضحيتهم.
      
      **القناص** يستهدف مشتبه به بطلقة واحدة.
      
      **المحقق** يكشف عن انتماءات اللاعبين.
      
      **المنعش** يمكنه إعادة لاعب ميت إلى الحياة.
      
      **الساحر** يختار بين الحماية أو القتل.
      
      *سيتلقى كل لاعب رسالة خاصة لاستخدام قدراته أو لاستلام معلومات خاصة به.*
      `);
    
    // إرسال رسالة عامة عن إجراءات الليل
    await (channel as TextChannel).send({
      embeds: [nightActionEmbed]
    });
    
    // إرسال رسائل الإجراءات الليلية لكل لاعب
    await sendNightActionButtons(gameState);
    
    return true;
  } catch (error) {
    log(`خطأ في بدء مرحلة الليل: ${error}`, 'discord-game');
    return false;
  }
}

/**
 * إرسال أزرار الإجراءات الليلية لكل لاعب حسب دوره
 */
async function sendNightActionButtons(gameState: GameState) {
  const alivePlayers = gameState.getAlivePlayers();
  
  for (const player of alivePlayers) {
    if (!player.role) continue;
    
    // تخزين التفاعل لكل لاعب من أجل إرسال رسائل خاصة لاحقًا
    const interaction = getStoredInteraction(player.id);
    if (!interaction) {
      log(`لم يتم العثور على تفاعل محفوظ للاعب ${player.username} (${player.id})`, 'discord-game');
      continue;
    }
    
    // إرسال رسالة الإجراء المناسبة حسب دور اللاعب
    switch (player.role) {
      case 'werewolf':
      case 'werewolfLeader':
        await sendWerewolfActionMessage(gameState, player);
        break;
        
      case 'seer':
        await sendSeerActionMessage(gameState, player);
        break;
        
      case 'guardian':
        await sendGuardianActionMessage(gameState, player);
        break;
        
      case 'detective':
        await sendDetectiveActionMessage(gameState, player);
        break;
        
      case 'sniper':
        await sendSniperActionMessage(gameState, player);
        break;
        
      case 'reviver':
        await sendReviverActionMessage(gameState, player);
        break;
        
      case 'wizard':
        await sendWizardActionMessage(gameState, player);
        break;
        
      case 'villager':
        // إرسال رسالة انتظار للقرويين العاديين
        await sendVillagerNightMessage(gameState, player);
        break;
    }
  }
}

/**
 * إرسال رسالة إجراء المستذئب
 */
async function sendWerewolfActionMessage(gameState: GameState, player: Player) {
  try {
    // الحصول على التفاعل المخزن للاعب
    const interaction = getStoredInteraction(player.id);
    if (!interaction) return;
    
    // الحصول على قائمة اللاعبين الأحياء للاختيار بينهم
    const alivePlayers = gameState.getAlivePlayers()
      .filter((p: Player) => p.role !== 'werewolf' && p.role !== 'werewolfLeader'); // استبعاد المستذئبين الآخرين
    
    if (alivePlayers.length === 0) {
      // إذا لم يبق لاعبين أحياء للاختيار
      const noTargetsEmbed = new EmbedBuilder()
        .setTitle('🐺 دورك: المستذئب')
        .setColor('#880000')
        .setDescription('لا يوجد لاعبين أحياء يمكنك اختيارهم.');
      
      if (interaction.replied) {
        await interaction.followUp({ embeds: [noTargetsEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [noTargetsEmbed], ephemeral: true });
      }
      
      return;
    }
    
    // إنشاء أزرار اختيار اللاعبين
    const buttonRows: ActionRowBuilder<ButtonBuilder>[] = [];
    
    // إنشاء مجموعات من الأزرار (3 أزرار كحد أقصى في كل صف)
    for (let i = 0; i < alivePlayers.length; i += 3) {
      const currentRow = new ActionRowBuilder<ButtonBuilder>();
      
      // إضافة أزرار للاعبين في هذا الصف
      for (let j = i; j < Math.min(i + 3, alivePlayers.length); j++) {
        const player = alivePlayers[j];
        
        // إنشاء زر لكل لاعب
        const button = new ButtonBuilder()
          .setCustomId(`werewolf_action_${gameState.id}_${player.id}`)
          .setLabel(`${j} ${player.username}`)
          .setStyle(ButtonStyle.Secondary);
        
        currentRow.addComponents(button);
      }
      
      buttonRows.push(currentRow);
    }
    
    // إنشاء رسالة الإجراء
    const actionEmbed = new EmbedBuilder()
      .setTitle('🐺 حان وقت الصيد!')
      .setColor('#880000')
      .setDescription(`
      ## دور المستذئب - وقت الصيد
      
      يمكنك الآن اختيار ضحية الليلة من بين القرويين الأحياء.
      تأكد من التنسيق مع بقية المستذئبين للاتفاق على نفس الهدف.
      
      *اختر بحكمة، فحياة قبيلتك تعتمد على ذلك!*
      `);
    
    // إرسال الرسالة مع أزرار الاختيار
    if (interaction.replied) {
      await interaction.followUp({ embeds: [actionEmbed], components: buttonRows, ephemeral: true });
    } else {
      await interaction.reply({ embeds: [actionEmbed], components: buttonRows, ephemeral: true });
    }
  } catch (error) {
    log(`خطأ في إرسال رسالة إجراء المستذئب: ${error}`, 'discord-game');
  }
}

/**
 * إرسال رسالة إجراء العراف
 */
async function sendSeerActionMessage(gameState: GameState, player: Player) {
  try {
    // الحصول على التفاعل المخزن للاعب
    const interaction = getStoredInteraction(player.id);
    if (!interaction) return;
    
    // الحصول على قائمة اللاعبين الأحياء للاختيار بينهم (باستثناء نفسه)
    const alivePlayers = gameState.getAlivePlayers()
      .filter(p => p.id !== player.id);
    
    if (alivePlayers.length === 0) {
      const noTargetsEmbed = new EmbedBuilder()
        .setTitle('👁️ دورك: العراف')
        .setColor('#4B0082')
        .setDescription('لا يوجد لاعبين أحياء يمكنك اختيارهم.');
      
      if (interaction.replied) {
        await interaction.followUp({ embeds: [noTargetsEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [noTargetsEmbed], ephemeral: true });
      }
      
      return;
    }
    
    // إنشاء أزرار اختيار اللاعبين
    const buttonRows: ActionRowBuilder<ButtonBuilder>[] = [];
    
    // إنشاء مجموعات من الأزرار (3 أزرار كحد أقصى في كل صف)
    for (let i = 0; i < alivePlayers.length; i += 3) {
      const currentRow = new ActionRowBuilder<ButtonBuilder>();
      
      // إضافة أزرار للاعبين في هذا الصف
      for (let j = i; j < Math.min(i + 3, alivePlayers.length); j++) {
        const player = alivePlayers[j];
        
        // إنشاء زر لكل لاعب
        const button = new ButtonBuilder()
          .setCustomId(`seer_action_${gameState.id}_${player.id}`)
          .setLabel(`${j} ${player.username}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('👁️');
        
        currentRow.addComponents(button);
      }
      
      buttonRows.push(currentRow);
    }
    
    // إنشاء رسالة الإجراء
    const actionEmbed = new EmbedBuilder()
      .setTitle('👁️ رؤية العراف')
      .setColor('#4B0082')
      .setDescription(`
      ## قوة الرؤية الخاصة بك
      
      بصفتك العراف، يمكنك كشف هوية أحد اللاعبين الآخرين كل ليلة.
      ستعرف ما إذا كان الشخص الذي اخترته مستذئبًا أم قرويًا.
      
      *استخدم قدرتك بحكمة للمساعدة في كشف المستذئبين!*
      `);
    
    // إرسال الرسالة مع أزرار الاختيار
    if (interaction.replied) {
      await interaction.followUp({ embeds: [actionEmbed], components: buttonRows, ephemeral: true });
    } else {
      await interaction.reply({ embeds: [actionEmbed], components: buttonRows, ephemeral: true });
    }
  } catch (error) {
    log(`خطأ في إرسال رسالة إجراء العراف: ${error}`, 'discord-game');
  }
}

/**
 * إرسال رسالة إجراء الحارس
 */
async function sendGuardianActionMessage(gameState: GameState, player: Player) {
  try {
    // الحصول على التفاعل المخزن للاعب
    const interaction = getStoredInteraction(player.id);
    if (!interaction) return;
    
    // الحصول على قائمة اللاعبين الأحياء للاختيار بينهم
    const alivePlayers = gameState.getAlivePlayers();
    
    if (alivePlayers.length === 0) {
      const noTargetsEmbed = new EmbedBuilder()
        .setTitle('🛡️ دورك: الحارس')
        .setColor('#00688B')
        .setDescription('لا يوجد لاعبين أحياء يمكنك اختيارهم.');
      
      if (interaction.replied) {
        await interaction.followUp({ embeds: [noTargetsEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [noTargetsEmbed], ephemeral: true });
      }
      
      return;
    }
    
    // إنشاء أزرار اختيار اللاعبين
    const buttonRows: ActionRowBuilder<ButtonBuilder>[] = [];
    
    // إنشاء مجموعات من الأزرار (3 أزرار كحد أقصى في كل صف)
    for (let i = 0; i < alivePlayers.length; i += 3) {
      const currentRow = new ActionRowBuilder<ButtonBuilder>();
      
      // إضافة أزرار للاعبين في هذا الصف
      for (let j = i; j < Math.min(i + 3, alivePlayers.length); j++) {
        const player = alivePlayers[j];
        
        // إنشاء زر لكل لاعب
        const button = new ButtonBuilder()
          .setCustomId(`guardian_action_${gameState.id}_${player.id}`)
          .setLabel(`${j} ${player.username}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🛡️');
        
        currentRow.addComponents(button);
      }
      
      buttonRows.push(currentRow);
    }
    
    // إنشاء رسالة الإجراء
    const actionEmbed = new EmbedBuilder()
      .setTitle('🛡️ حماية الحارس')
      .setColor('#00688B')
      .setDescription(`
      ## حان وقت الحماية
      
      كحارس، دورك هو حماية أحد اللاعبين من الموت هذه الليلة.
      اختر بحكمة - قد تنقذ حياة قروي بريء أو تحمي دورًا مهمًا!
      
      *لا يمكنك حماية نفس الشخص ليلتين متتاليتين.*
      `);
    
    // إرسال الرسالة مع أزرار الاختيار
    if (interaction.replied) {
      await interaction.followUp({ embeds: [actionEmbed], components: buttonRows, ephemeral: true });
    } else {
      await interaction.reply({ embeds: [actionEmbed], components: buttonRows, ephemeral: true });
    }
  } catch (error) {
    log(`خطأ في إرسال رسالة إجراء الحارس: ${error}`, 'discord-game');
  }
}

/**
 * إرسال رسالة إجراء المحقق
 */
async function sendDetectiveActionMessage(gameState: GameState, player: Player) {
  try {
    // الحصول على التفاعل المخزن للاعب
    const interaction = getStoredInteraction(player.id);
    if (!interaction) return;
    
    // الحصول على قائمة اللاعبين الأحياء للاختيار بينهم (باستثناء نفسه)
    const alivePlayers = gameState.getAlivePlayers()
      .filter(p => p.id !== player.id);
    
    if (alivePlayers.length === 0) {
      const noTargetsEmbed = new EmbedBuilder()
        .setTitle('🔍 دورك: المحقق')
        .setColor('#008080')
        .setDescription('لا يوجد لاعبين أحياء يمكنك اختيارهم.');
      
      if (interaction.replied) {
        await interaction.followUp({ embeds: [noTargetsEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [noTargetsEmbed], ephemeral: true });
      }
      
      return;
    }
    
    // إنشاء أزرار اختيار اللاعبين
    const buttonRows: ActionRowBuilder<ButtonBuilder>[] = [];
    
    // إنشاء مجموعات من الأزرار (3 أزرار كحد أقصى في كل صف)
    for (let i = 0; i < alivePlayers.length; i += 3) {
      const currentRow = new ActionRowBuilder<ButtonBuilder>();
      
      // إضافة أزرار للاعبين في هذا الصف
      for (let j = i; j < Math.min(i + 3, alivePlayers.length); j++) {
        const player = alivePlayers[j];
        
        // إنشاء زر لكل لاعب
        const button = new ButtonBuilder()
          .setCustomId(`detective_action_${gameState.id}_${player.id}`)
          .setLabel(`${j} ${player.username}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔍');
        
        currentRow.addComponents(button);
      }
      
      buttonRows.push(currentRow);
    }
    
    // إنشاء رسالة الإجراء
    const actionEmbed = new EmbedBuilder()
      .setTitle('🔍 تحقيق المحقق')
      .setColor('#008080')
      .setDescription(`
      ## تحقيق دقيق
      
      كمحقق، يمكنك معرفة الدور المحدد لأي لاعب خلال الليل.
      ستحصل على معلومات تفصيلية أكثر من العراف!
      
      *استخدم هذه المعلومات بحكمة، فقد تكون حاسمة لإنقاذ القرية.*
      `);
    
    // إرسال الرسالة مع أزرار الاختيار
    if (interaction.replied) {
      await interaction.followUp({ embeds: [actionEmbed], components: buttonRows, ephemeral: true });
    } else {
      await interaction.reply({ embeds: [actionEmbed], components: buttonRows, ephemeral: true });
    }
  } catch (error) {
    log(`خطأ في إرسال رسالة إجراء المحقق: ${error}`, 'discord-game');
  }
}

/**
 * إرسال رسالة إجراء القناص
 */
async function sendSniperActionMessage(gameState: GameState, player: Player) {
  try {
    // الحصول على التفاعل المخزن للاعب
    const interaction = getStoredInteraction(player.id);
    if (!interaction) return;
    
    // الحصول على قائمة اللاعبين الأحياء للاختيار بينهم (باستثناء نفسه)
    const alivePlayers = gameState.getAlivePlayers()
      .filter(p => p.id !== player.id);
    
    if (alivePlayers.length === 0) {
      const noTargetsEmbed = new EmbedBuilder()
        .setTitle('🎯 دورك: القناص')
        .setColor('#8B4513')
        .setDescription('لا يوجد لاعبين أحياء يمكنك اختيارهم.');
      
      if (interaction.replied) {
        await interaction.followUp({ embeds: [noTargetsEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [noTargetsEmbed], ephemeral: true });
      }
      
      return;
    }
    
    // إنشاء أزرار اختيار اللاعبين
    const buttonRows: ActionRowBuilder<ButtonBuilder>[] = [];
    
    // إنشاء مجموعات من الأزرار (3 أزرار كحد أقصى في كل صف)
    for (let i = 0; i < alivePlayers.length; i += 3) {
      const currentRow = new ActionRowBuilder<ButtonBuilder>();
      
      // إضافة أزرار للاعبين في هذا الصف
      for (let j = i; j < Math.min(i + 3, alivePlayers.length); j++) {
        const player = alivePlayers[j];
        
        // إنشاء زر لكل لاعب
        const button = new ButtonBuilder()
          .setCustomId(`sniper_action_${gameState.id}_${player.id}`)
          .setLabel(`${j} ${player.username}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎯');
        
        currentRow.addComponents(button);
      }
      
      buttonRows.push(currentRow);
    }
    
    // إضافة زر "تخطي" في صف جديد
    const skipRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`sniper_action_${gameState.id}_skip`)
          .setLabel('لا تطلق النار')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⏭️')
      );
    
    buttonRows.push(skipRow);
    
    // إنشاء رسالة الإجراء
    const actionEmbed = new EmbedBuilder()
      .setTitle('🎯 طلقة القناص')
      .setColor('#8B4513')
      .setDescription(`
      ## اختر هدفك بحذر
      
      كقناص، لديك عدد محدود من الطلقات للاستخدام خلال اللعبة.
      يمكنك اختيار إطلاق النار على أحد اللاعبين أو الاحتفاظ برصاصتك لليلة أخرى.
      
      *تذكر: لديك طلقتان فقط طوال اللعبة، فاستخدمهما بحكمة.*
      `);
    
    // إرسال الرسالة مع أزرار الاختيار
    if (interaction.replied) {
      await interaction.followUp({ embeds: [actionEmbed], components: buttonRows, ephemeral: true });
    } else {
      await interaction.reply({ embeds: [actionEmbed], components: buttonRows, ephemeral: true });
    }
  } catch (error) {
    log(`خطأ في إرسال رسالة إجراء القناص: ${error}`, 'discord-game');
  }
}

/**
 * إرسال رسالة انتظار للقرويين العاديين أثناء الليل
 */
async function sendVillagerNightMessage(gameState: GameState, player: Player) {
  try {
    // الحصول على التفاعل المخزن للاعب
    const interaction = getStoredInteraction(player.id);
    if (!interaction) return;
    
    // إنشاء رسالة الانتظار للقروي
    const villagerEmbed = new EmbedBuilder()
      .setTitle('🛌 وقت النوم للقرويين')
      .setColor('#2E8B57')
      .setDescription(`
      ## القرية نائمة والمستذئبون مستيقظون
      
      أنت قروي عادي وليس لديك قدرات خاصة في الليل.
      خلد للنوم والراحة بينما يستخدم الآخرون قدراتهم الخاصة.
      
      **يرجى الانتظار حتى تنتهي المرحلة الليلية.**
      
      *تذكر: في النقاش النهاري، يجب عليك المشاركة في النقاش والتصويت ضد المستذئبين المشتبه بهم!*
      `);
    
    // إرسال الرسالة للقروي
    if (interaction.replied) {
      await interaction.followUp({ embeds: [villagerEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [villagerEmbed], ephemeral: true });
    }
  } catch (error) {
    log(`خطأ في إرسال رسالة الانتظار للقروي: ${error}`, 'discord-game');
  }
}

/**
 * إرسال رسالة إجراء المنعش
 */
async function sendReviverActionMessage(gameState: GameState, player: Player) {
  try {
    // الحصول على التفاعل المخزن للاعب
    const interaction = getStoredInteraction(player.id);
    if (!interaction) return;
    
    // الحصول على قائمة اللاعبين الميتين للاختيار بينهم
    const deadPlayers = Array.from(gameState.players.values())
      .filter(p => !p.isAlive);
    
    // إنشاء أزرار اختيار اللاعبين الميتين
    const buttonRows: ActionRowBuilder<ButtonBuilder>[] = [];
    
    // إنشاء مجموعات من الأزرار (3 أزرار كحد أقصى في كل صف)
    for (let i = 0; i < deadPlayers.length; i += 3) {
      const currentRow = new ActionRowBuilder<ButtonBuilder>();
      
      // إضافة أزرار للاعبين في هذا الصف
      for (let j = i; j < Math.min(i + 3, deadPlayers.length); j++) {
        const player = deadPlayers[j];
        
        // إنشاء زر لكل لاعب
        const button = new ButtonBuilder()
          .setCustomId(`reviver_action_${gameState.id}_${player.id}`)
          .setLabel(`${j} ${player.username}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('💓');
        
        currentRow.addComponents(button);
      }
      
      buttonRows.push(currentRow);
    }
    
    // إضافة زر "تخطي" في صف جديد
    const skipRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`reviver_action_${gameState.id}_skip`)
          .setLabel('لا تحيي أحداً')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⏭️')
      );
    
    buttonRows.push(skipRow);
    

    
    // إنشاء رسالة الإجراء
    const actionEmbed = new EmbedBuilder()
      .setTitle('💓 قوة الإحياء')
      .setColor('#FF69B4')
      .setDescription(`
      ## قدرة الإحياء
      
      كمنعش، يمكنك إعادة أحد اللاعبين الميتين إلى الحياة.
      تذكر أن هذه القدرة يمكن استخدامها مرة واحدة فقط خلال اللعبة.
      
      *اختر بحكمة من تريد إحياءه، أو احتفظ بقدرتك لوقت لاحق.*
      `);
    
    // إرسال الرسالة مع أزرار الاختيار
    if (interaction.replied) {
      await interaction.followUp({ embeds: [actionEmbed], components: buttonRows, ephemeral: true });
    } else {
      await interaction.reply({ embeds: [actionEmbed], components: buttonRows, ephemeral: true });
    }
  } catch (error) {
    log(`خطأ في إرسال رسالة إجراء المنعش: ${error}`, 'discord-game');
  }
}

/**
 * إرسال رسالة إجراء الساحر
 */
async function sendWizardActionMessage(gameState: GameState, player: Player) {
  try {
    // الحصول على التفاعل المخزن للاعب
    const interaction = getStoredInteraction(player.id);
    if (!interaction) return;
    
    // الحصول على قائمة اللاعبين الأحياء للاختيار بينهم
    const alivePlayers = gameState.getAlivePlayers()
      .filter(p => p.id !== player.id);
    
    const actionEmbed = new EmbedBuilder()
      .setTitle('🧙 سحر الساحر')
      .setColor('#9932CC')
      .setDescription(`
      ## قوى السحر
      
      كساحر، لديك قدرتان قويتان:
      1. **إكسير الحماية**: يمكنك حماية نفسك أو أي لاعب آخر من الموت لليلة واحدة.
      2. **السم القاتل**: يمكنك قتل أي لاعب تختاره.
      
      يمكنك استخدام كل قدرة مرة واحدة فقط خلال اللعبة.
      
      *كن حذرًا في اختياراتك، فهذه القوى قد تغير مصير اللعبة!*
      `);
    
    // إنشاء أزرار الاختيار
    const protectionButton = new ButtonBuilder()
      .setCustomId(`wizard_protect_${gameState.id}`)
      .setLabel('استخدام إكسير الحماية')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🧪');
    
    const poisonButton = new ButtonBuilder()
      .setCustomId(`wizard_poison_${gameState.id}`)
      .setLabel('استخدام السم القاتل')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('☠️');
    
    const skipButton = new ButtonBuilder()
      .setCustomId(`wizard_skip_${gameState.id}`)
      .setLabel('عدم استخدام أي قدرة')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⏭️');
    
    // إنشاء صف الأزرار
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(protectionButton, poisonButton, skipButton);
    
    // إرسال الرسالة مع الأزرار
    if (interaction.replied) {
      await interaction.followUp({ embeds: [actionEmbed], components: [row], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [actionEmbed], components: [row], ephemeral: true });
    }
  } catch (error) {
    log(`خطأ في إرسال رسالة إجراء الساحر: ${error}`, 'discord-game');
  }
}

/**
 * بدء مرحلة النهار
 */
export async function startDayPhase(gameId: number, interaction: ButtonInteraction | ChatInputCommandInteraction, victim?: Player, wasProtected?: boolean) {
  try {
    // الحصول على حالة اللعبة
    const gameManager = getGameManager();
    const gameState = gameManager.getGameState(gameId);
    
    if (!gameState) {
      throw new Error(`لم يتم العثور على لعبة برقم ${gameId}`);
    }
    
    // تحديث حالة اللعبة
    gameState.setPhase(GamePhase.DAY);
    
    // الحصول على معلومات اللعبة من قاعدة البيانات
    const game = await storage.getGame(gameId);
    if (!game || !game.channelId) {
      throw new Error(`لم يتم العثور على معلومات اللعبة ${gameId}`);
    }
    
    // تهيئة الرسالة
    const client = getClient();
    const channel = await client.channels.fetch(game.channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`لم يتم العثور على القناة ${game.channelId}`);
    }
    
    // تحضير رسالة النهار بناء على نتائج الليل
    let dayEmbed: EmbedBuilder;
    let dayAttachment: AttachmentBuilder;
    
    if (victim && !wasProtected) {
      // حالة وجود ضحية
      dayEmbed = new EmbedBuilder()
        .setTitle(`☀️ بداية النهار - اليوم ${gameState.day}`)
        .setColor('#FFD700')
        .setDescription(`
        # أشرقت الشمس على قتيل جديد!
        
        **${victim.username}** وُجِد ميتًا هذا الصباح...
        
        لقد كان **${getRoleDisplayName(victim.role as RoleType)}** ${getRoleEmoji(victim.role as RoleType)}
        
        *على القرية أن تناقش من هو المسؤول عن هذه الجريمة وما حدث في الليل.*
        
        **كل شخص يجب أن يتحدث عما حدث له أثناء الليل لكشف المستذئبين.**
        
        *نقاش مفتوح لمدة 60 ثانية...*
        `)
        .setImage('attachment://القتل.png');
      
      dayAttachment = new AttachmentBuilder(path.join('attached_assets', 'القتل.png'));
      
      // تحديث حالة اللاعب في قاعدة البيانات
      await storage.updatePlayerStatus(gameId, victim.id, false);
      
      // تحديث حالة اللاعب في ذاكرة اللعبة
      gameState.setPlayerAlive(victim.id, false);
    } else if (victim && wasProtected) {
      // حالة حماية الضحية
      dayEmbed = new EmbedBuilder()
        .setTitle(`☀️ بداية النهار - اليوم ${gameState.day}`)
        .setColor('#FFD700')
        .setDescription(`
        # لقد نجا الجميع!
        
        بفضل حماية خفية، نجا **${victim.username}** من هجوم الليلة الماضية!
        
        *على القرية أن تناقش من يمكن أن يكون المستذئب بينهم وما حدث في الليل.*
        
        **كل شخص يجب أن يتحدث عما حدث له أثناء الليل لكشف المستذئبين.**
        
        *نقاش مفتوح لمدة 60 ثانية...*
        `)
        .setImage('attachment://حماية.png');
      
      dayAttachment = new AttachmentBuilder(path.join('attached_assets', 'حماية.png'));
    } else {
      // حالة عدم وجود ضحية
      dayEmbed = new EmbedBuilder()
        .setTitle(`☀️ بداية النهار - اليوم ${gameState.day}`)
        .setColor('#FFD700')
        .setDescription(`
        # أشرقت الشمس على القرية
        
        لقد مرت الليلة بسلام، ولم يُقتل أحد!
        
        *على القرية أن تناقش من يمكن أن يكون المستذئب بينهم وما حدث في الليل.*
        
        **كل شخص يجب أن يتحدث عما حدث له أثناء الليل لكشف المستذئبين.**
        
        *نقاش مفتوح لمدة 60 ثانية...*
        `);
      
      dayAttachment = new AttachmentBuilder(path.join('attached_assets', 'بداية.webp'));
    }
    
    // إضافة زر إنهاء النقاش (متاح فقط لمالك اللعبة)
    const endDiscussionButton = new ButtonBuilder()
      .setCustomId(`end_discussion_${gameId}`)
      .setLabel('إنهاء النقاش')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⏭️');
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(endDiscussionButton);
    
    // إرسال رسالة النهار
    const dayMessage = await (channel as TextChannel).send({
      embeds: [dayEmbed],
      files: [dayAttachment],
      components: [row]
    });
    
    // تفقد ما إذا كانت اللعبة قد انتهت بعد موت اللاعب
    if (gameState.isGameOver()) {
      setTimeout(() => {
        endGame(gameState, interaction);
      }, 3000);
      return;
    }

    // مؤقت الوقت المتبقي للنقاش
    let timeLeft = 60; // 60 ثانية
    
    // إنشاء رسالة المؤقت
    const timerEmbed = new EmbedBuilder()
      .setTitle('⏱️ الوقت المتبقي للنقاش')
      .setColor('#FFD700')
      .setDescription(`**${timeLeft} ثانية**\n\nبعد انتهاء الوقت، سيبدأ التصويت تلقائيًا.`);
    
    const timerMessage = await (channel as TextChannel).send({
      embeds: [timerEmbed]
    });
    
    // المسجات التشويقية للنقاش
    const suspenseMessages = [
      '👁️ **عيون المستذئبين تراقب الجميع... من تشك فيه؟**',
      '🤔 **ألم تلاحظوا سلوك أحدهم المريب أثناء الليل؟**',
      '💬 **هل يقول الجميع الحقيقة؟ انتبهوا للتناقضات...**',
      '🔍 **الحقيقة تختبئ في التفاصيل الصغيرة... استمعوا جيدًا!**',
      '⚠️ **لا تدعوا المستذئبين يخدعونكم. فكروا في كل احتمال!**',
      '🗯️ **من الصامت بينكم؟ ربما يخفي شيئًا مهمًا...**',
      '🌙 **ماذا رأيتم في الليل؟ كل معلومة قد تكون مفتاح النجاة!**'
    ];
    
    // خلط الرسائل التشويقية
    suspenseMessages.sort(() => Math.random() - 0.5);
    
    // مؤقت لتحديث الوقت المتبقي ونشر رسائل التشويق
    const timer = setInterval(async () => {
      timeLeft--;
      
      // تحديث رسالة المؤقت
      timerEmbed.setDescription(`**${timeLeft} ثانية**\n\nبعد انتهاء الوقت، سيبدأ التصويت تلقائيًا.`);
      await timerMessage.edit({ embeds: [timerEmbed] });
      
      // نشر رسائل تشويقية كل 8 ثواني
      if (timeLeft % 8 === 0 && timeLeft > 0) {
        const suspenseIndex = Math.floor((60 - timeLeft) / 8) % suspenseMessages.length;
        
        // تحقق من اللاعبين الذين لم يتحدثوا بعد
        const alivePlayers = gameState.getAlivePlayers();
        let quiet = false;
        let quietPlayer = null;
        
        // هنا يمكن إضافة منطق لتحديد اللاعبين الصامتين بشكل عشوائي
        if (alivePlayers.length > 0 && Math.random() > 0.7) {
          quietPlayer = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
          quiet = true;
        }
        
        const suspenseEmbed = new EmbedBuilder()
          .setColor('#FFB900')
          .setTitle('💭 أفكار القرية');
        
        if (quiet && quietPlayer) {
          suspenseEmbed.setDescription(`${suspenseMessages[suspenseIndex]}\n\n👀 **<@${quietPlayer.id}> لم يتحدث كثيرًا... ربما يخفي شيئًا؟**`);
        } else {
          suspenseEmbed.setDescription(suspenseMessages[suspenseIndex]);
        }
        
        await (channel as TextChannel).send({ embeds: [suspenseEmbed] });
      }
      
      // إذا انتهى الوقت، بدء التصويت تلقائيًا
      if (timeLeft <= 0) {
        clearInterval(timer);
        await (channel as TextChannel).send({
          embeds: [
            new EmbedBuilder()
              .setTitle('⌛ انتهى وقت النقاش!')
              .setColor('#FF6B00')
              .setDescription('**حان وقت التصويت! أدلوا بأصواتكم للتخلص من أحد المشتبه فيهم.**')
          ]
        });
        
        // بدء مرحلة التصويت
        await startVotingPhase(gameId, interaction);
      }
    }, 1000);
    
    // تسجيل المؤقت في حالة اللعبة لإيقافه إذا تم إنهاء النقاش مبكرًا
    gameState.discussionTimer = timer;
    
    return true;
  } catch (error) {
    log(`خطأ في بدء مرحلة النهار: ${error}`, 'discord-game');
    return false;
  }
}

/**
 * بدء مرحلة التصويت
 */
export async function startVotingPhase(gameId: number, interaction: ButtonInteraction | ChatInputCommandInteraction) {
  try {
    // الحصول على حالة اللعبة
    const gameManager = getGameManager();
    const gameState = gameManager.getGameState(gameId);
    
    if (!gameState) {
      throw new Error(`لم يتم العثور على لعبة برقم ${gameId}`);
    }
    
    // تحديث حالة اللعبة
    gameState.setPhase(GamePhase.VOTING);
    gameState.resetVotes();
    
    // الحصول على معلومات اللعبة من قاعدة البيانات
    const game = await storage.getGame(gameId);
    if (!game || !game.channelId) {
      throw new Error(`لم يتم العثور على معلومات اللعبة ${gameId}`);
    }
    
    // تهيئة الرسالة
    const client = getClient();
    const channel = await client.channels.fetch(game.channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`لم يتم العثور على القناة ${game.channelId}`);
    }
    
    // إنشاء رسالة التصويت
    const votingEmbed = new EmbedBuilder()
      .setTitle(`🗳️ مرحلة التصويت - اليوم ${gameState.day}`)
      .setColor('#1E90FF')
      .setDescription(`
      # حان وقت التصويت!
      
      قررت القرية التصويت للتخلص من أحد السكان المشتبه بهم.
      
      **كل لاعب سيتلقى رسالة خاصة للتصويت.**
      
      *اختر بحكمة - حياة القرية تعتمد على قراراتكم!*
      `);
    
    // إضافة زر إنهاء التصويت
    const endVotingButton = new ButtonBuilder()
      .setCustomId(`end_voting_${gameId}`)
      .setLabel('إنهاء التصويت')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('✅');
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(endVotingButton);
    
    // إرسال رسالة التصويت
    await (channel as TextChannel).send({
      embeds: [votingEmbed],
      components: [row]
    });
    
    // إرسال خيارات التصويت لكل لاعب
    await sendVotingOptions(gameState);
    
    return true;
  } catch (error) {
    log(`خطأ في بدء مرحلة التصويت: ${error}`, 'discord-game');
    return false;
  }
}

/**
 * إرسال خيارات التصويت لكل لاعب حي
 */
async function sendVotingOptions(gameState: GameState) {
  const alivePlayers = gameState.getAlivePlayers();
  
  for (const voter of alivePlayers) {
    try {
      // الحصول على التفاعل المخزن للاعب
      const interaction = getStoredInteraction(voter.id);
      if (!interaction) {
        log(`لم يتم العثور على تفاعل محفوظ للاعب ${voter.username} (${voter.id})`, 'discord-game');
        continue;
      }
      
      // الحصول على قائمة اللاعبين الأحياء الآخرين للتصويت عليهم
      const voteCandidates = alivePlayers.filter(p => p.id !== voter.id);
      
      if (voteCandidates.length === 0) {
        const noCandidatesEmbed = new EmbedBuilder()
          .setTitle('🗳️ التصويت')
          .setColor('#1E90FF')
          .setDescription('لا يوجد مرشحين للتصويت.');
        
        if (interaction.replied) {
          await interaction.followUp({ embeds: [noCandidatesEmbed], ephemeral: true });
        } else {
          await interaction.reply({ embeds: [noCandidatesEmbed], ephemeral: true });
        }
        
        continue;
      }
      
      // إنشاء أزرار تصويت لكل لاعب
      const buttonRows: ActionRowBuilder<ButtonBuilder>[] = [];
      
      // إنشاء مجموعات من الأزرار (5 أزرار كحد أقصى في كل صف)
      for (let i = 0; i < voteCandidates.length; i += 3) {
        const currentRow = new ActionRowBuilder<ButtonBuilder>();
        
        // إضافة أزرار للاعبين في هذا الصف (كحد أقصى 3 لاعبين في صف واحد)
        for (let j = i; j < Math.min(i + 3, voteCandidates.length); j++) {
          const player = voteCandidates[j];
          // إنشاء زر لكل لاعب
          const button = new ButtonBuilder()
            .setCustomId(`vote_player_${gameState.id}_${player.id}`)
            .setLabel(`${j} ${player.username}`)
            .setStyle(ButtonStyle.Secondary);
          
          currentRow.addComponents(button);
        }
        
        buttonRows.push(currentRow);
      }
      
      // إنشاء رسالة التصويت
      const voteEmbed = new EmbedBuilder()
        .setTitle('🗳️ صوت الآن!')
        .setColor('#1E90FF')
        .setDescription(`
        ## حان وقت التصويت
        
        اختر لاعباً تشك في أنه مستذئب للتصويت ضده.
        أكثر لاعب يحصل على أصوات سيتم طرده من القرية.
        
        *تذكر أن تصويتك قد يحدد مصير القرية!*
        `);
      
      // إرسال رسالة التصويت
      if (interaction.replied) {
        await interaction.followUp({ embeds: [voteEmbed], components: buttonRows, ephemeral: true });
      } else {
        await interaction.reply({ embeds: [voteEmbed], components: buttonRows, ephemeral: true });
      }
    } catch (error) {
      log(`خطأ في إرسال خيارات التصويت للاعب ${voter.username}: ${error}`, 'discord-game');
    }
  }
}

/**
 * معالجة نتائج التصويت وطرد اللاعب
 */
export async function handleVotingResults(gameId: number, interaction: ButtonInteraction | ChatInputCommandInteraction) {
  try {
    // الحصول على حالة اللعبة
    const gameManager = getGameManager();
    const gameState = gameManager.getGameState(gameId);
    
    if (!gameState) {
      throw new Error(`لم يتم العثور على لعبة برقم ${gameId}`);
    }
    
    // الحصول على اللاعب الذي حصل على أكثر الأصوات
    const mostVotedPlayer = gameState.getMostVotedPlayer();
    
    // الحصول على معلومات اللعبة من قاعدة البيانات
    const game = await storage.getGame(gameId);
    if (!game || !game.channelId) {
      throw new Error(`لم يتم العثور على معلومات اللعبة ${gameId}`);
    }
    
    // تهيئة القناة
    const client = getClient();
    const channel = await client.channels.fetch(game.channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`لم يتم العثور على القناة ${game.channelId}`);
    }
    
    // تحضير رسالة نتائج التصويت
    let votingResultsEmbed: EmbedBuilder;
    let votingAttachment: AttachmentBuilder | undefined;
    
    if (!mostVotedPlayer) {
      // حالة عدم وجود أصوات أو تعادل
      votingResultsEmbed = new EmbedBuilder()
        .setTitle(`📊 نتائج التصويت - اليوم ${gameState.day}`)
        .setColor('#1E90FF')
        .setDescription(`
        # لم يتم طرد أي لاعب!
        
        لم يتم التوصل إلى اتفاق على من يجب طرده، أو لم يتم الإدلاء بأي صوت.
        
        *القرية في خطر... المستذئبون يتربصون!*
        `);
    } else {
      // حالة وجود نتيجة للتصويت
      const isWerewolf = mostVotedPlayer.role === 'werewolf' || mostVotedPlayer.role === 'werewolfLeader';
      
      // تحديث حالة اللاعب الذي تم طرده
      await storage.updatePlayerStatus(gameId, mostVotedPlayer.id, false);
      gameState.setPlayerAlive(mostVotedPlayer.id, false);
      
      // إرسال رسالة الطرد للاعب
      await sendEliminationMessage(mostVotedPlayer);
      
      // تحضير رسالة النتائج
      votingResultsEmbed = new EmbedBuilder()
        .setTitle(`📊 نتائج التصويت - اليوم ${gameState.day}`)
        .setColor('#1E90FF')
        .setDescription(`
        # تم طرد ${mostVotedPlayer.username}!
        
        القرية قررت طرد **${mostVotedPlayer.username}** بعد التصويت.
        
        تبين أنه كان **${getRoleDisplayName(mostVotedPlayer.role as RoleType)}** ${getRoleEmoji(mostVotedPlayer.role as RoleType)}
        
        *${isWerewolf ? 'أحسنتم! لقد تخلصتم من أحد المستذئبين.' : 'للأسف، لقد طردتم أحد القرويين الأبرياء.'}*
        `);
      
      // اختيار الصورة المناسبة
      const imagePath = isWerewolf ? 'طرد مستذئب.png' : 'طرد قروي.png';
      votingAttachment = new AttachmentBuilder(path.join('attached_assets', imagePath));
      votingResultsEmbed.setImage(`attachment://${imagePath}`);
    }
    
    // إضافة زر بدء الليلة التالية
    const nextPhaseButton = new ButtonBuilder()
      .setCustomId(`start_night_${gameId}`)
      .setLabel('بدء الليلة التالية')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🌙');
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(nextPhaseButton);
    
    // إرسال رسالة النتائج
    if (!mostVotedPlayer) {
      // إذا لم يكن هناك لاعب تم التصويت عليه (تعادل أو عدم وجود أصوات)
      await (channel as TextChannel).send({
        embeds: [votingResultsEmbed],
        components: [row]
      });
    } else {
      // إذا كان هناك لاعب تم التصويت عليه مع الصورة
      await (channel as TextChannel).send({
        embeds: [votingResultsEmbed],
        files: votingAttachment ? [votingAttachment] : undefined,
        components: [row]
      });
    }
    
    // تفقد ما إذا كانت اللعبة قد انتهت بعد طرد اللاعب
    if (gameState.isGameOver()) {
      setTimeout(() => {
        endGame(gameState, interaction);
      }, 3000);
      return;
    }
    
    // تحضير اللعبة للمرحلة التالية
    gameState.prepareNextPhase();
    
    return true;
  } catch (error) {
    log(`خطأ في معالجة نتائج التصويت: ${error}`, 'discord-game');
    return false;
  }
}

/**
 * إرسال رسالة للاعب الذي تم طرده
 */
async function sendEliminationMessage(player: Player) {
  try {
    // الحصول على التفاعل المخزن للاعب
    const interaction = getStoredInteraction(player.id);
    if (!interaction) return;
    
    // إنشاء رسالة الإقصاء
    const eliminationEmbed = new EmbedBuilder()
      .setTitle('⚰️ لقد تم طردك من القرية')
      .setColor('#FF0000')
      .setDescription(`
      # تم طردك!
      
      بعد تصويت القرية، تم طردك من اللعبة.
      
      **كنت تلعب دور: ${getRoleDisplayName(player.role as RoleType)} ${getRoleEmoji(player.role as RoleType)}**
      
      *لا تكشف عن دورك للاعبين الآخرين! يمكنك الاستمرار في مشاهدة اللعبة، لكن لا يمكنك المشاركة بعد الآن.*
      `);
    
    // إرسال الرسالة للاعب
    if (interaction.replied) {
      await interaction.followUp({ embeds: [eliminationEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [eliminationEmbed], ephemeral: true });
    }
  } catch (error) {
    log(`خطأ في إرسال رسالة الطرد للاعب ${player.username}: ${error}`, 'discord-game');
  }
}

/**
 * نهاية اللعبة
 */
export async function endGame(gameState: GameState, interaction: ButtonInteraction | ChatInputCommandInteraction) {
  try {
    // تحديث حالة اللعبة
    gameState.setPhase(GamePhase.ENDED);
    
    // الحصول على الفريق الفائز
    const winner = gameState.getWinner();
    
    // الحصول على معلومات اللعبة من قاعدة البيانات
    const game = await storage.getGame(gameState.id);
    if (!game || !game.channelId) {
      throw new Error(`لم يتم العثور على معلومات اللعبة ${gameState.id}`);
    }
    
    // تهيئة القناة
    const client = getClient();
    const channel = await client.channels.fetch(game.channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`لم يتم العثور على القناة ${game.channelId}`);
    }
    
    // تحديث حالة اللعبة في قاعدة البيانات
    await storage.updateGameStatus(gameState.id, 'ended');
    
    // إعادة تعيين حالة اللعبة في مدير اللعبة
    const gameManager = getGameManager();
    await gameManager.resetGame(gameState.id);
    
    if (!winner) {
      // حالة غير متوقعة - لا يوجد فائز
      const errorEmbed = new EmbedBuilder()
        .setTitle('⚠️ نهاية اللعبة')
        .setColor('#FF0000')
        .setDescription('حدث خطأ غير متوقع عند تحديد الفائز.');
      
      await (channel as TextChannel).send({ embeds: [errorEmbed] });
      return;
    }
    
    // إنشاء رسالة نهاية اللعبة
    const endGameEmbed = new EmbedBuilder()
      .setTitle('🏆 نهاية اللعبة')
      .setColor(winner === 'villagers' ? '#00FF00' : '#FF0000');
    
    let winnerMessage: string;
    let winImage: string;
    
    if (winner === 'villagers') {
      winnerMessage = `
      # انتصر القرويون! 🎉
      
      تمكن القرويون من اكتشاف وطرد جميع المستذئبين.
      القرية آمنة مرة أخرى بفضل يقظة وذكاء أهلها!
      
      **مبروك للقرويين!**
      `;
      winImage = 'فوز القرويون.png';
    } else {
      winnerMessage = `
      # انتصر المستذئبون! 🐺
      
      نجح المستذئبون في القضاء على عدد كافٍ من القرويين.
      المستذئبون يسيطرون الآن على القرية!
      
      **مبروك للمستذئبين!**
      `;
      winImage = 'فوز المستذئبين.png';
    }
    
    endGameEmbed.setDescription(winnerMessage);
    endGameEmbed.setImage(`attachment://${winImage}`);
    
    // إضافة بيانات أدوار اللاعبين
    const playerRoles = Array.from(gameState.players.values())
      .map(p => `${p.username}: ${getRoleEmoji(p.role as RoleType)} ${getRoleDisplayName(p.role as RoleType)} ${p.isAlive ? '(حي)' : '(ميت)'}`);
    
    endGameEmbed.addFields({ name: 'أدوار اللاعبين', value: playerRoles.join('\n') });
    
    // إضافة زر لعبة جديدة
    const newGameButton = new ButtonBuilder()
      .setCustomId(`new_game_${gameState.id}`)
      .setLabel('بدء لعبة جديدة')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎮');
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(newGameButton);
    
    // إنشاء مرفق الصورة
    const winAttachment = new AttachmentBuilder(path.join('attached_assets', winImage));
    
    // إرسال رسالة نهاية اللعبة
    await (channel as TextChannel).send({
      embeds: [endGameEmbed],
      files: [winAttachment],
      components: [row]
    });
    
    return true;
  } catch (error) {
    log(`خطأ في إنهاء اللعبة: ${error}`, 'discord-game');
    return false;
  }
}

/**
 * تسجيل معالجات أزرار مراحل اللعبة
 */
export function registerGamePhaseButtons(client: any) {
  client.on('interactionCreate', async (interaction: any) => {
    // تجاهل التفاعلات غير المدعومة
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    
    try {
      // استخراج معرف اللعبة من معرف الزر
      const customId = interaction.customId;
      const parts = customId.split('_');
      const gameId = parseInt(parts[parts.length - 1]);
      
      if (isNaN(gameId)) return;
      
      // الحصول على حالة اللعبة
      const gameManager = getGameManager();
      const gameState = gameManager.getGameState(gameId);
      
      if (!gameState) return;
      
      // تخزين التفاعل للاستخدام لاحقًا
      storeInteraction(interaction.user.id, interaction);
      
      // معالجة تفاعلات الأزرار لمراحل اللعبة
      if (customId.startsWith('start_night_')) {
        // بدء مرحلة الليل
        await interaction.deferUpdate();
        startNightPhase(gameId, interaction);
      }
      else if (customId.startsWith('end_discussion_')) {
        // إنهاء النقاش والانتقال إلى مرحلة التصويت
        // التحقق من أن الضاغط على الزر هو مالك اللعبة
        if (interaction.user.id !== gameState.ownerId) {
          await interaction.reply({
            content: 'فقط مالك اللعبة يمكنه إنهاء النقاش',
            ephemeral: true
          });
          return;
        }
        
        // إيقاف المؤقت إذا كان موجودًا
        if (gameState.discussionTimer) {
          clearInterval(gameState.discussionTimer);
        }
        
        await interaction.deferUpdate();
        
        // إرسال رسالة بإنهاء النقاش
        const game = await storage.getGame(gameId);
        if (game && game.channelId) {
          const client = getClient();
          const channel = await client.channels.fetch(game.channelId);
          if (channel && channel.isTextBased()) {
            await (channel as TextChannel).send({
              embeds: [
                new EmbedBuilder()
                  .setTitle('⏹️ تم إنهاء النقاش')
                  .setColor('#FF6B00')
                  .setDescription('**قرر مالك اللعبة إنهاء النقاش مبكرًا. حان وقت التصويت!**')
              ]
            });
          }
        }
        
        // بدء مرحلة التصويت
        startVotingPhase(gameId, interaction);
      }
      else if (customId.startsWith('start_voting_')) {
        // بدء مرحلة التصويت
        await interaction.deferUpdate();
        startVotingPhase(gameId, interaction);
      }
      else if (customId.startsWith('end_voting_')) {
        // إنهاء التصويت ومعالجة النتائج
        await interaction.deferUpdate();
        handleVotingResults(gameId, interaction);
      }
      else if (customId.startsWith('new_game_')) {
        // بدء لعبة جديدة بعد انتهاء اللعبة الحالية
        const game = await storage.getGame(gameId);
        if (!game || !game.channelId) return;
        
        // استخدام أمر /game لبدء لعبة جديدة
        await interaction.reply({
          content: 'لبدء لعبة جديدة، استخدم الأمر `/game`',
          ephemeral: true
        });
      }
      // معالجة إجراءات الدور الليلي
      else if (customId.startsWith('werewolf_action_') && interaction.isButton()) {
        // إجراء المستذئب - اختيار ضحية باستخدام الأزرار
        const parts = customId.split('_');
        const targetId = parts[parts.length - 1];
        
        // الحصول على اللاعب المستهدف
        const target = gameState.getPlayer(targetId);
        if (!target) return;
        
        // تسجيل إجراء المستذئب
        gameState.addNightAction(interaction.user.id, {
          targetId,
          actionType: 'kill'
        });
        
        // تعيين الضحية الحالية
        gameState.setWerewolfVictim(targetId);
        
        // إرسال تأكيد الإجراء
        await interaction.update({
          content: `تم اختيار **${target.username}** كضحية للمستذئبين هذه الليلة.`,
          components: [],
          embeds: []
        });
        
        // إذا كانت جميع الإجراءات الليلية قد تمت، انتقل إلى مرحلة النهار
        if (gameState.areAllNightActionsDone()) {
          // إحضار الضحية المستهدفة
          const victim = gameState.getPlayer(gameState.currentNightVictim as string);
          const wasProtected = victim?.protected || false;
          
          // بدء مرحلة النهار بعد مهلة قصيرة
          setTimeout(() => {
            startDayPhase(gameId, interaction, victim, wasProtected);
          }, 2000);
        }
      }
      else if (customId.startsWith('seer_action_') && interaction.isButton()) {
        // إجراء العراف - كشف هوية لاعب باستخدام الأزرار
        const parts = customId.split('_');
        const targetId = parts[parts.length - 1];
        
        // الحصول على اللاعب المستهدف
        const target = gameState.getPlayer(targetId);
        if (!target) return;
        
        // تسجيل إجراء العراف
        gameState.addNightAction(interaction.user.id, {
          targetId,
          actionType: 'reveal'
        });
        
        // تحديد ما إذا كان الهدف مستذئبًا
        const isWerewolf = target.role === 'werewolf' || target.role === 'werewolfLeader';
        
        // إنشاء رسالة نتيجة الكشف
        const resultEmbed = new EmbedBuilder()
          .setTitle('👁️ نتيجة الرؤية')
          .setColor(isWerewolf ? '#FF0000' : '#00FF00')
          .setDescription(`
          ## رؤيتك كشفت الحقيقة!
          
          بعد التركيز على **${target.username}**، تكشفت لك الحقيقة:
          
          **${target.username}** هو **${isWerewolf ? 'مستذئب! 🐺' : 'قروي عادي. 👨‍🌾'}**
          
          *استخدم هذه المعلومات بحكمة لمساعدة القرية.*
          `);
        
        // إرسال نتيجة الكشف
        await interaction.update({
          embeds: [resultEmbed],
          components: [],
          content: null
        });
        
        // إذا كانت جميع الإجراءات الليلية قد تمت، انتقل إلى مرحلة النهار
        if (gameState.areAllNightActionsDone()) {
          // إحضار الضحية المستهدفة
          const victim = gameState.getPlayer(gameState.currentNightVictim as string);
          const wasProtected = victim?.protected || false;
          
          // بدء مرحلة النهار بعد مهلة قصيرة
          setTimeout(() => {
            startDayPhase(gameId, interaction, victim, wasProtected);
          }, 2000);
        }
      }
      else if (customId.startsWith('guardian_action_') && interaction.isButton()) {
        // إجراء الحارس - حماية لاعب
        const parts = customId.split('_');
        const targetId = parts[parts.length - 1];
        
        // الحصول على اللاعب المستهدف
        const target = gameState.getPlayer(targetId);
        if (!target) return;
        
        // تسجيل إجراء الحارس
        gameState.addNightAction(interaction.user.id, {
          targetId,
          actionType: 'protect'
        });
        
        // تعيين حالة الحماية للاعب المستهدف
        if (target) {
          target.protected = true;
          gameState.players.set(targetId, target);
        }
        
        // إرسال تأكيد الإجراء
        await interaction.update({
          content: `تم اختيار **${target.username}** للحماية هذه الليلة.`,
          components: [],
          embeds: []
        });
        
        // إذا كانت جميع الإجراءات الليلية قد تمت، انتقل إلى مرحلة النهار
        if (gameState.areAllNightActionsDone()) {
          // إحضار الضحية المستهدفة
          const victim = gameState.getPlayer(gameState.currentNightVictim as string);
          const wasProtected = victim?.protected || false;
          
          // بدء مرحلة النهار بعد مهلة قصيرة
          setTimeout(() => {
            startDayPhase(gameId, interaction, victim, wasProtected);
          }, 2000);
        }
      }
      else if (customId.startsWith('detective_action_') && interaction.isButton()) {
        // إجراء المحقق - كشف الدور المحدد
        const parts = customId.split('_');
        const targetId = parts[parts.length - 1];
        
        // الحصول على اللاعب المستهدف
        const target = gameState.getPlayer(targetId);
        if (!target) return;
        
        // تسجيل إجراء المحقق
        gameState.addNightAction(interaction.user.id, {
          targetId,
          actionType: 'investigate'
        });
        
        // إنشاء رسالة نتيجة التحقيق
        const resultEmbed = new EmbedBuilder()
          .setTitle('🔍 نتيجة التحقيق')
          .setColor('#008080')
          .setDescription(`
          ## اكتشفت الحقيقة الكاملة!
          
          بعد تحقيق دقيق مع **${target.username}**، اكتشفت:
          
          **${target.username}** هو **${getRoleDisplayName(target.role as RoleType)} ${getRoleEmoji(target.role as RoleType)}**
          
          *هذه معلومات قيمة يمكنك استخدامها لصالح القرية.*
          `);
        
        // إرسال نتيجة التحقيق
        await interaction.update({
          embeds: [resultEmbed],
          components: [],
          content: null
        });
        
        // إذا كانت جميع الإجراءات الليلية قد تمت، انتقل إلى مرحلة النهار
        if (gameState.areAllNightActionsDone()) {
          // إحضار الضحية المستهدفة
          const victim = gameState.getPlayer(gameState.currentNightVictim as string);
          const wasProtected = victim?.protected || false;
          
          // بدء مرحلة النهار بعد مهلة قصيرة
          setTimeout(() => {
            startDayPhase(gameId, interaction, victim, wasProtected);
          }, 2000);
        }
      }
      else if (customId.startsWith('sniper_action_') && interaction.isButton()) {
        // إجراء القناص - إطلاق النار على لاعب
        const parts = customId.split('_');
        const targetId = parts[parts.length - 1];
        
        // التحقق مما إذا كان اللاعب قد اختار التخطي
        if (targetId === 'skip') {
          // تسجيل إجراء التخطي
          gameState.addNightAction(interaction.user.id, {
            targetId: 'skip',
            actionType: 'skip_shot'
          });
          
          // إرسال تأكيد الإجراء
          await interaction.update({
            content: `قررت الاحتفاظ برصاصتك لليلة أخرى.`,
            components: [],
            embeds: []
          });
        } else {
          // الحصول على اللاعب المستهدف
          const target = gameState.getPlayer(targetId);
          if (!target) return;
          
          // تسجيل إجراء القناص
          gameState.addNightAction(interaction.user.id, {
            targetId,
            actionType: 'shoot'
          });
          
          // تحديد ما إذا كان الهدف مستذئبًا
          const isWerewolf = target.role === 'werewolf' || target.role === 'werewolfLeader';
          
          // قم بتحديث حالة اللاعب المستهدف
          if (!target.protected) {
            target.isAlive = false;
            gameState.players.set(targetId, target);
            
            // تحديث حالة اللاعب في قاعدة البيانات
            await storage.updatePlayerStatus(gameId, targetId, false);
          }
          
          // إنشاء رسالة نتيجة إطلاق النار
          const resultEmbed = new EmbedBuilder()
            .setTitle('🎯 نتيجة الطلقة')
            .setColor(isWerewolf ? '#00FF00' : '#FF0000')
            .setDescription(`
            ## أطلقت النار!
            
            لقد أطلقت النار على **${target.username}**!
            
            ${target.protected ? 
              `**لكن يبدو أن شيئًا ما منع الطلقة من إصابته!**` : 
              `**${target.username}** كان **${getRoleDisplayName(target.role as RoleType)} ${getRoleEmoji(target.role as RoleType)}**`
            }
            
            *لقد استخدمت إحدى رصاصتيك المحدودة.*
            `);
          
          // إرسال نتيجة إطلاق النار
          await interaction.update({
            embeds: [resultEmbed],
            components: [],
            content: null
          });
          
          // إرسال رسالة للضحية
          if (!target.protected) {
            await sendEliminationMessage(target);
          }
        }
        
        // إذا كانت جميع الإجراءات الليلية قد تمت، انتقل إلى مرحلة النهار
        if (gameState.areAllNightActionsDone()) {
          // إحضار الضحية المستهدفة
          const victim = gameState.getPlayer(gameState.currentNightVictim as string);
          const wasProtected = victim?.protected || false;
          
          // تفقد ما إذا كانت اللعبة قد انتهت بعد إطلاق النار
          if (gameState.isGameOver()) {
            setTimeout(() => {
              endGame(gameState, interaction);
            }, 3000);
            return;
          }
          
          // بدء مرحلة النهار بعد مهلة قصيرة
          setTimeout(() => {
            startDayPhase(gameId, interaction, victim, wasProtected);
          }, 2000);
        }
      }
      else if (customId.startsWith('reviver_action_') && interaction.isButton()) {
        // إجراء المنعش - إحياء لاعب
        const parts = customId.split('_');
        const targetId = parts[parts.length - 1];
        
        // التحقق مما إذا كان اللاعب قد اختار التخطي
        if (targetId === 'skip') {
          // تسجيل إجراء التخطي
          gameState.addNightAction(interaction.user.id, {
            targetId: 'skip',
            actionType: 'skip_revive'
          });
          
          // إرسال تأكيد الإجراء
          await interaction.update({
            content: `قررت الاحتفاظ بقدرة الإحياء لوقت لاحق.`,
            components: [],
            embeds: []
          });
        } else {
          // الحصول على اللاعب المستهدف
          const target = gameState.getPlayer(targetId);
          if (!target) return;
          
          // تسجيل إجراء المنعش
          gameState.addNightAction(interaction.user.id, {
            targetId,
            actionType: 'revive'
          });
          
          // تحديث حالة اللاعب المستهدف
          target.isAlive = true;
          gameState.players.set(targetId, target);
          
          // تحديث حالة اللاعب في قاعدة البيانات
          await storage.updatePlayerStatus(gameId, targetId, true);
          
          // إنشاء رسالة نتيجة الإحياء
          const resultEmbed = new EmbedBuilder()
            .setTitle('💓 نتيجة الإحياء')
            .setColor('#FF69B4')
            .setDescription(`
            ## أعدت الحياة!
            
            لقد نجحت في إحياء **${target.username}**!
            
            **${target.username}** سيعود للعبة في اليوم القادم.
            
            *لقد استخدمت قدرة الإحياء الخاصة بك.*
            `);
          
          // إرسال نتيجة الإحياء
          await interaction.update({
            embeds: [resultEmbed],
            components: [],
            content: null
          });
          
          // إرسال رسالة للاعب الذي تم إحياؤه
          const revivedEmbed = new EmbedBuilder()
            .setTitle('✨ لقد تمت إعادتك للحياة!')
            .setColor('#00FF00')
            .setDescription(`
            # أنت حي مرة أخرى!
            
            **المنعش** استخدم قدرته الخاصة لإعادتك إلى الحياة.
            
            ستتمكن من المشاركة في اللعبة مرة أخرى في اليوم القادم.
            
            *لا تضيع فرصتك الثانية!*
            `);
          
          // إرسال الرسالة للاعب المحيا
          const targetInteraction = getStoredInteraction(targetId);
          if (targetInteraction) {
            if (targetInteraction.replied) {
              await targetInteraction.followUp({ embeds: [revivedEmbed], ephemeral: true });
            } else {
              await targetInteraction.reply({ embeds: [revivedEmbed], ephemeral: true });
            }
          }
        }
        
        // إذا كانت جميع الإجراءات الليلية قد تمت، انتقل إلى مرحلة النهار
        if (gameState.areAllNightActionsDone()) {
          // إحضار الضحية المستهدفة
          const victim = gameState.getPlayer(gameState.currentNightVictim as string);
          const wasProtected = victim?.protected || false;
          
          // بدء مرحلة النهار بعد مهلة قصيرة
          setTimeout(() => {
            startDayPhase(gameId, interaction, victim, wasProtected);
          }, 2000);
        }
      }
      else if (customId.startsWith('wizard_') && interaction.isButton()) {
        // إجراءات الساحر
        const action = customId.split('_')[1];
        
        if (action === 'skip') {
          // تسجيل إجراء التخطي
          gameState.addNightAction(interaction.user.id, {
            targetId: 'skip',
            actionType: 'skip_wizard'
          });
          
          // إرسال تأكيد الإجراء
          await interaction.update({
            content: `قررت عدم استخدام أي قدرة هذه الليلة.`,
            components: [],
            embeds: []
          });
        }
        else if (action === 'protect') {
          // إجراء الحماية - إظهار قائمة اللاعبين للحماية
          const alivePlayers = gameState.getAlivePlayers();
          
          // إنشاء قائمة منسدلة للاختيار بين اللاعبين
          const selectOptions: SelectMenuComponentOptionData[] = alivePlayers.map(p => ({
            label: p.username,
            value: p.id,
            description: `حماية ${p.username} من الموت هذه الليلة`,
            emoji: '🧪'
          }));
          
          // إنشاء قائمة منسدلة
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`wizard_protect_select_${gameState.id}`)
            .setPlaceholder('اختر لاعب لحمايته')
            .addOptions(selectOptions);
          
          // إنشاء صف الأزرار
          const row = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(selectMenu);
          
          // إرسال قائمة الاختيار
          await interaction.update({
            content: 'اختر لاعباً لحمايته باستخدام إكسير الحماية:',
            components: [row],
            embeds: []
          });
        }
        else if (action === 'poison') {
          // إجراء التسميم - إظهار قائمة اللاعبين للقتل
          const alivePlayers = gameState.getAlivePlayers()
            .filter(p => p.id !== interaction.user.id); // استبعاد نفسك
          
          // إنشاء قائمة منسدلة للاختيار بين اللاعبين
          const selectOptions: SelectMenuComponentOptionData[] = alivePlayers.map(p => ({
            label: p.username,
            value: p.id,
            description: `تسميم ${p.username}`,
            emoji: '☠️'
          }));
          
          // إنشاء قائمة منسدلة
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`wizard_poison_select_${gameState.id}`)
            .setPlaceholder('اختر لاعب لتسميمه')
            .addOptions(selectOptions);
          
          // إنشاء صف الأزرار
          const row = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(selectMenu);
          
          // إرسال قائمة الاختيار
          await interaction.update({
            content: 'اختر لاعباً لتسميمه باستخدام السم القاتل:',
            components: [row],
            embeds: []
          });
        }
      }
      else if (customId.startsWith('wizard_protect_select_') && interaction.isStringSelectMenu()) {
        // إجراء حماية الساحر - تنفيذ الحماية
        const targetId = interaction.values[0];
        
        // الحصول على اللاعب المستهدف
        const target = gameState.getPlayer(targetId);
        if (!target) return;
        
        // تسجيل إجراء الساحر
        gameState.addNightAction(interaction.user.id, {
          targetId,
          actionType: 'wizard_protect'
        });
        
        // تعيين حالة الحماية للاعب المستهدف
        if (target) {
          target.protected = true;
          gameState.players.set(targetId, target);
        }
        
        // إرسال تأكيد الإجراء
        await interaction.update({
          content: `تم حماية **${target.username}** باستخدام إكسير الحماية.`,
          components: [],
          embeds: []
        });
        
        // إذا كانت جميع الإجراءات الليلية قد تمت، انتقل إلى مرحلة النهار
        if (gameState.areAllNightActionsDone()) {
          // إحضار الضحية المستهدفة
          const victim = gameState.getPlayer(gameState.currentNightVictim as string);
          const wasProtected = victim?.protected || false;
          
          // بدء مرحلة النهار بعد مهلة قصيرة
          setTimeout(() => {
            startDayPhase(gameId, interaction, victim, wasProtected);
          }, 2000);
        }
      }
      else if (customId.startsWith('wizard_poison_select_') && interaction.isStringSelectMenu()) {
        // إجراء تسميم الساحر - تنفيذ القتل
        const targetId = interaction.values[0];
        
        // الحصول على اللاعب المستهدف
        const target = gameState.getPlayer(targetId);
        if (!target) return;
        
        // تسجيل إجراء الساحر
        gameState.addNightAction(interaction.user.id, {
          targetId,
          actionType: 'wizard_poison'
        });
        
        // قم بتحديث حالة اللاعب المستهدف إذا لم يكن محميًا
        if (!target.protected) {
          target.isAlive = false;
          gameState.players.set(targetId, target);
          
          // تحديث حالة اللاعب في قاعدة البيانات
          await storage.updatePlayerStatus(gameId, targetId, false);
        }
        
        // إنشاء رسالة نتيجة التسميم
        const resultEmbed = new EmbedBuilder()
          .setTitle('☠️ نتيجة التسميم')
          .setColor('#9932CC')
          .setDescription(`
          ## لقد استخدمت السم القاتل!
          
          لقد قمت بتسميم **${target.username}**!
          
          ${target.protected ? 
            `**لكن يبدو أن شيئًا ما منع السم من التأثير عليه!**` : 
            `**${target.username}** كان **${getRoleDisplayName(target.role as RoleType)} ${getRoleEmoji(target.role as RoleType)}**`
          }
          
          *لقد استخدمت السم القاتل الخاص بك.*
          `);
        
        // إرسال نتيجة التسميم
        await interaction.update({
          embeds: [resultEmbed],
          components: [],
          content: null
        });
        
        // إرسال رسالة للضحية
        if (!target.protected) {
          await sendEliminationMessage(target);
        }
        
        // إذا كانت جميع الإجراءات الليلية قد تمت، انتقل إلى مرحلة النهار
        if (gameState.areAllNightActionsDone()) {
          // إحضار الضحية المستهدفة
          const victim = gameState.getPlayer(gameState.currentNightVictim as string);
          const wasProtected = victim?.protected || false;
          
          // تفقد ما إذا كانت اللعبة قد انتهت بعد التسميم
          if (gameState.isGameOver()) {
            setTimeout(() => {
              endGame(gameState, interaction);
            }, 3000);
            return;
          }
          
          // بدء مرحلة النهار بعد مهلة قصيرة
          setTimeout(() => {
            startDayPhase(gameId, interaction, victim, wasProtected);
          }, 2000);
        }
      }
      else if (customId.startsWith('vote_player_') && interaction.isButton()) {
        // إجراء التصويت على لاعب
        const parts = customId.split('_');
        const targetId = parts[parts.length - 1];
        
        // الحصول على اللاعب المستهدف
        const target = gameState.getPlayer(targetId);
        if (!target) return;
        
        // تسجيل التصويت (إزالة التصويت السابق إذا وجد)
        if (gameState.votes.has(interaction.user.id)) {
          gameState.removeVote(interaction.user.id);
        }
        
        // إضافة التصويت الجديد
        gameState.addVote(interaction.user.id, targetId);
        
        // إرسال تأكيد التصويت
        await interaction.update({
          content: `تم التصويت ضد **${target.username}**. يمكنك تغيير صوتك قبل انتهاء فترة التصويت.`,
          components: [],
          embeds: []
        });
        
        // إذا كان جميع اللاعبين الأحياء قد صوتوا، اعرض نتائج التصويت
        if (gameState.areAllVotesDone()) {
          // بدء معالجة نتائج التصويت بعد مهلة قصيرة
          setTimeout(() => {
            handleVotingResults(gameId, interaction);
          }, 2000);
        }
      }
      
    } catch (error) {
      log(`خطأ في معالجة تفاعلات مراحل اللعبة: ${error}`, 'discord-game');
      
      // محاولة إرسال رسالة خطأ للمستخدم
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: 'حدث خطأ أثناء معالجة إجراءك. الرجاء المحاولة مرة أخرى.',
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: 'حدث خطأ أثناء معالجة إجراءك. الرجاء المحاولة مرة أخرى.',
            ephemeral: true
          });
        }
      } catch (replyError) {
        log(`خطأ في إرسال رسالة الخطأ: ${replyError}`, 'discord-game');
      }
    }
  });
}