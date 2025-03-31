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
  TextChannel,
  Events
} from 'discord.js';
import { storage } from '../../storage';
import { log } from '../../vite';
import { getGameManager } from '../game/gameManager';
import { GamePhase, Player, NightActionTarget, GameState } from '../game/gameState';
import { getClient } from '../bot';
import { storeInteraction, getStoredInteraction } from '../utils/interactionStorage';
import { sendEphemeralMessage, sendEphemeralReply } from './ephemeralMessages';
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
    // الحصول على قائمة اللاعبين الأحياء للاختيار بينهم
    const alivePlayers = gameState.getAlivePlayers()
      .filter((p: Player) => p.role !== 'werewolf' && p.role !== 'werewolfLeader'); // استبعاد المستذئبين الآخرين
    
    if (alivePlayers.length === 0) {
      // إذا لم يبق لاعبين أحياء للاختيار
      const noTargetsEmbed = new EmbedBuilder()
        .setTitle('🐺 دورك: المستذئب')
        .setColor('#880000')
        .setDescription('لا يوجد لاعبين أحياء يمكنك اختيارهم.');
      
      // إرسال الرسالة باستخدام الرسائل المخفية في الشات العام
      await sendEphemeralReply(player.id, undefined, [noTargetsEmbed]);
      return;
    }
    
    // إنشاء أزرار اختيار اللاعبين
    const buttonRows: ActionRowBuilder<ButtonBuilder>[] = [];
    
    // إنشاء مجموعات من الأزرار (3 أزرار كحد أقصى في كل صف)
    for (let i = 0; i < alivePlayers.length; i += 3) {
      const currentRow = new ActionRowBuilder<ButtonBuilder>();
      
      // إضافة أزرار للاعبين في هذا الصف
      for (let j = i; j < Math.min(i + 3, alivePlayers.length); j++) {
        const p = alivePlayers[j];
        
        // إنشاء زر لكل لاعب
        const button = new ButtonBuilder()
          .setCustomId(`werewolf_action_${gameState.id}_${p.id}`)
          .setLabel(`${j+1} ${p.username}`)
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
    
    // إرسال الرسالة باستخدام الرسائل المخفية في الشات العام
    const success = await sendEphemeralReply(
      player.id, 
      undefined, 
      [actionEmbed], 
      buttonRows as Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>
    );
    
    if (success) {
      log(`تم إرسال رسالة إجراء المستذئب إلى ${player.username} عبر الرسائل المخفية`, 'discord-debug');
    } else {
      log(`فشل في إرسال رسالة إجراء المستذئب إلى ${player.username} - لا يوجد تفاعل مخزن`, 'discord-game');
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
    // الحصول على قائمة اللاعبين الأحياء للاختيار بينهم (باستثناء نفسه)
    const alivePlayers = gameState.getAlivePlayers()
      .filter(p => p.id !== player.id);
    
    if (alivePlayers.length === 0) {
      const noTargetsEmbed = new EmbedBuilder()
        .setTitle('👁️ دورك: العراف')
        .setColor('#4B0082')
        .setDescription('لا يوجد لاعبين أحياء يمكنك اختيارهم.');
      
      // إرسال الرسالة باستخدام الرسائل المخفية في الشات العام
      await sendEphemeralReply(player.id, undefined, [noTargetsEmbed]);
      return;
    }
    
    // إنشاء أزرار اختيار اللاعبين
    const buttonRows: ActionRowBuilder<ButtonBuilder>[] = [];
    
    // إنشاء مجموعات من الأزرار (3 أزرار كحد أقصى في كل صف)
    for (let i = 0; i < alivePlayers.length; i += 3) {
      const currentRow = new ActionRowBuilder<ButtonBuilder>();
      
      // إضافة أزرار للاعبين في هذا الصف
      for (let j = i; j < Math.min(i + 3, alivePlayers.length); j++) {
        const p = alivePlayers[j];
        
        // إنشاء زر لكل لاعب
        const button = new ButtonBuilder()
          .setCustomId(`seer_action_${gameState.id}_${p.id}`)
          .setLabel(`${j+1} ${p.username}`)
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
    
    // إرسال الرسالة باستخدام الرسائل المخفية في الشات العام
    const success = await sendEphemeralReply(
      player.id, 
      undefined, 
      [actionEmbed], 
      buttonRows as Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>
    );
    
    if (success) {
      log(`تم إرسال رسالة إجراء العراف إلى ${player.username} عبر الرسائل المخفية`, 'discord-debug');
    } else {
      log(`فشل في إرسال رسالة إجراء العراف إلى ${player.username} - لا يوجد تفاعل مخزن`, 'discord-game');
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
    // الحصول على قائمة اللاعبين الأحياء للاختيار بينهم
    const alivePlayers = gameState.getAlivePlayers();
    
    if (alivePlayers.length === 0) {
      const noTargetsEmbed = new EmbedBuilder()
        .setTitle('🛡️ دورك: الحارس')
        .setColor('#00688B')
        .setDescription('لا يوجد لاعبين أحياء يمكنك اختيارهم.');
      
      // إرسال الرسالة باستخدام الرسائل المخفية في الشات العام
      await sendEphemeralReply(player.id, undefined, [noTargetsEmbed]);
      return;
    }
    
    // إنشاء أزرار اختيار اللاعبين
    const buttonRows: ActionRowBuilder<ButtonBuilder>[] = [];
    
    // إنشاء مجموعات من الأزرار (3 أزرار كحد أقصى في كل صف)
    for (let i = 0; i < alivePlayers.length; i += 3) {
      const currentRow = new ActionRowBuilder<ButtonBuilder>();
      
      // إضافة أزرار للاعبين في هذا الصف
      for (let j = i; j < Math.min(i + 3, alivePlayers.length); j++) {
        const p = alivePlayers[j];
        
        // إنشاء زر لكل لاعب
        const button = new ButtonBuilder()
          .setCustomId(`guardian_action_${gameState.id}_${p.id}`)
          .setLabel(`${j+1} ${p.username}`)
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
    
    // إرسال الرسالة باستخدام الرسائل المخفية في الشات العام
    const success = await sendEphemeralReply(
      player.id, 
      undefined, 
      [actionEmbed], 
      buttonRows as Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>
    );
    
    if (success) {
      log(`تم إرسال رسالة إجراء الحارس إلى ${player.username} عبر الرسائل المخفية`, 'discord-debug');
    } else {
      log(`فشل في إرسال رسالة إجراء الحارس إلى ${player.username} - لا يوجد تفاعل مخزن`, 'discord-game');
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
    // الحصول على قائمة اللاعبين الأحياء للاختيار بينهم (باستثناء نفسه)
    const alivePlayers = gameState.getAlivePlayers()
      .filter(p => p.id !== player.id);
    
    if (alivePlayers.length === 0) {
      const noTargetsEmbed = new EmbedBuilder()
        .setTitle('🔍 دورك: المحقق')
        .setColor('#008080')
        .setDescription('لا يوجد لاعبين أحياء يمكنك اختيارهم.');
      
      // إرسال الرسالة باستخدام الرسائل المخفية في الشات العام
      await sendEphemeralReply(player.id, undefined, [noTargetsEmbed]);
      return;
    }
    
    // إنشاء أزرار اختيار اللاعبين
    const buttonRows: ActionRowBuilder<ButtonBuilder>[] = [];
    
    // إنشاء مجموعات من الأزرار (3 أزرار كحد أقصى في كل صف)
    for (let i = 0; i < alivePlayers.length; i += 3) {
      const currentRow = new ActionRowBuilder<ButtonBuilder>();
      
      // إضافة أزرار للاعبين في هذا الصف
      for (let j = i; j < Math.min(i + 3, alivePlayers.length); j++) {
        const p = alivePlayers[j];
        
        // إنشاء زر لكل لاعب
        const button = new ButtonBuilder()
          .setCustomId(`detective_action_${gameState.id}_${p.id}`)
          .setLabel(`${j+1} ${p.username}`)
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
    
    // إرسال الرسالة باستخدام الرسائل المخفية في الشات العام
    const success = await sendEphemeralReply(
      player.id, 
      undefined, 
      [actionEmbed], 
      buttonRows as Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>
    );
    
    if (success) {
      log(`تم إرسال رسالة إجراء المحقق إلى ${player.username} عبر الرسائل المخفية`, 'discord-debug');
    } else {
      log(`فشل في إرسال رسالة إجراء المحقق إلى ${player.username} - لا يوجد تفاعل مخزن`, 'discord-game');
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
    // الحصول على قائمة اللاعبين الأحياء للاختيار بينهم (باستثناء نفسه)
    const alivePlayers = gameState.getAlivePlayers()
      .filter(p => p.id !== player.id);
    
    if (alivePlayers.length === 0) {
      const noTargetsEmbed = new EmbedBuilder()
        .setTitle('🎯 دورك: القناص')
        .setColor('#8B4513')
        .setDescription('لا يوجد لاعبين أحياء يمكنك اختيارهم.');
      
      // إرسال الرسالة باستخدام الرسائل المخفية في الشات العام
      await sendEphemeralReply(player.id, undefined, [noTargetsEmbed]);
      return;
    }
    
    // إنشاء أزرار اختيار اللاعبين
    const buttonRows: ActionRowBuilder<ButtonBuilder>[] = [];
    
    // إنشاء مجموعات من الأزرار (3 أزرار كحد أقصى في كل صف)
    for (let i = 0; i < alivePlayers.length; i += 3) {
      const currentRow = new ActionRowBuilder<ButtonBuilder>();
      
      // إضافة أزرار للاعبين في هذا الصف
      for (let j = i; j < Math.min(i + 3, alivePlayers.length); j++) {
        const p = alivePlayers[j];
        
        // إنشاء زر لكل لاعب
        const button = new ButtonBuilder()
          .setCustomId(`sniper_action_${gameState.id}_${p.id}`)
          .setLabel(`${j+1} ${p.username}`)
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
    
    // إرسال الرسالة باستخدام الرسائل المخفية في الشات العام
    const success = await sendEphemeralReply(
      player.id, 
      undefined, 
      [actionEmbed], 
      buttonRows as Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>
    );
    
    if (success) {
      log(`تم إرسال رسالة إجراء القناص إلى ${player.username} عبر الرسائل المخفية`, 'discord-debug');
    } else {
      log(`فشل في إرسال رسالة إجراء القناص إلى ${player.username} - لا يوجد تفاعل مخزن`, 'discord-game');
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
    
    // إرسال الرسالة باستخدام الرسائل المخفية في الشات العام
    const success = await sendEphemeralReply(player.id, undefined, [villagerEmbed]);
    
    if (success) {
      log(`تم إرسال رسالة انتظار القروي إلى ${player.username} عبر الرسائل المخفية`, 'discord-debug');
    } else {
      log(`فشل في إرسال رسالة انتظار القروي إلى ${player.username} - لا يوجد تفاعل مخزن`, 'discord-game');
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
        const p = deadPlayers[j];
        
        // إنشاء زر لكل لاعب
        const button = new ButtonBuilder()
          .setCustomId(`reviver_action_${gameState.id}_${p.id}`)
          .setLabel(`${j+1} ${p.username}`)
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
    
    // إرسال الرسالة باستخدام الرسائل المخفية في الشات العام
    const success = await sendEphemeralReply(
      player.id, 
      undefined, 
      [actionEmbed], 
      buttonRows as Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>
    );
    
    if (success) {
      log(`تم إرسال رسالة إجراء المنعش إلى ${player.username} عبر الرسائل المخفية`, 'discord-debug');
    } else {
      log(`فشل في إرسال رسالة إجراء المنعش إلى ${player.username} - لا يوجد تفاعل مخزن`, 'discord-game');
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
    
    // إرسال الرسالة باستخدام الرسائل المخفية في الشات العام
    const success = await sendEphemeralReply(
      player.id, 
      undefined, 
      [actionEmbed], 
      [row] as Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>
    );
    
    if (success) {
      log(`تم إرسال رسالة إجراء الساحر إلى ${player.username} عبر الرسائل المخفية`, 'discord-debug');
    } else {
      log(`فشل في إرسال رسالة إجراء الساحر إلى ${player.username} - لا يوجد تفاعل مخزن`, 'discord-game');
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
    
