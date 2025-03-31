import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  Client, 
  Events, 
  ButtonInteraction,
  Collection,
  ModalSubmitInteraction,
  SelectMenuInteraction,
  EmbedBuilder,
  TextChannel
} from 'discord.js';
import { log } from '../../vite';
import { storage } from '../../storage';
import { createInitialGameEmbed } from '../components/initialView';
import { handleRoleConfigViewButtons } from '../components/roleConfigView';
import { handleInitialViewButtons } from '../components/initialView';
import { handleModalSubmit } from '../components/modals';
import { getGameManager } from '../game/gameManager';
import { GameState } from '../game/gameState';
import { registerGamePhaseButtons, startDayPhase, startNightPhase, startVotingPhase, handleVotingResults, endGame } from '../components/gamePhaseManager';
import { getClient } from '../bot';
import { getRoleDisplayName, getRoleEmoji } from '../components/roleConfigView';
import { RoleType } from '@shared/schema';
import { storeInteraction, getStoredInteraction } from '../utils/interactionStorage';

// Define command type
interface DiscordCommand {
  data: any; // We use 'any' here to avoid type issues with SlashCommandBuilder
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// Command collection for easy access
export const commands = new Collection<string, DiscordCommand>();

// Create the /game command
const gameCommand = {
  data: new SlashCommandBuilder()
    .setName('game')
    .setDescription('بدء لعبة المستذئب جديدة')
    .setDescriptionLocalizations({
      'en-US': 'Start a new Werewolf game'
    }),
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // تحقق مما إذا كانت هناك لعبة نشطة بالفعل في هذا السيرفر (بدلاً من القناة فقط)
      const activeGames = await storage.getActiveGames();
      const guildId = interaction.guildId;
      
      // فلترة الألعاب النشطة في نفس السيرفر
      const serverActiveGames = activeGames.filter(game => {
        // الحصول على معرف السيرفر من القناة
        // نفترض أن جميع القنوات من نفس السيرفر لها نفس معرف السيرفر في الـ 18 حرفاً الأولى
        const gameGuildId = game.channelId.substring(0, 18);
        return gameGuildId === guildId && game.status !== 'ended';
      });
      
      // إذا كانت هناك لعبة نشطة في السيرفر، لا نسمح ببدء لعبة جديدة
      if (serverActiveGames.length > 0) {
        await interaction.reply({
          content: `⛔ **لا يمكن بدء لعبة جديدة**\n\nيوجد بالفعل لعبة نشطة في هذا السيرفر. يجب إنهاء اللعبة الحالية أولاً قبل بدء لعبة جديدة.`,
          flags: [1 << 6]
        });
        return;
      }
      
      // Create a new game in storage
      const game = await storage.createGame(
        interaction.channelId,
        interaction.user.id
      );
      
      // Initialize the game manager
      const gameManager = getGameManager();
      gameManager.createGame(game.id, interaction.user.id);
      
      // Create the initial embed and send it
      const { embed, components, files } = createInitialGameEmbed(
        interaction.user.id,
        interaction.user.username,
        game.id
      );
      
      await interaction.reply({
        content: "**مرحباً بك في لعبة المستذئب!**",
        files: files,
        embeds: [embed],
        components: components
      });
      
      // Store the message ID for future updates
      const message = await interaction.fetchReply();
      await storage.updateGameMessage(game.id, message.id);
      
      // Add the game owner as the first player
      await storage.addPlayerToGame(game.id, interaction.user.id, interaction.user.username);
      
      // Update the game state
      gameManager.addPlayer(game.id, interaction.user.id, interaction.user.username);
      
      // Setup basic roles
      await storage.setupGameRoles(game.id, [
        { role: 'villager', enabled: true, basic: true },
        { role: 'werewolf', enabled: true, basic: true },
        { role: 'seer', enabled: true, basic: true },
        { role: 'guardian', enabled: true, basic: true },
        { role: 'werewolfLeader', enabled: false, basic: false },
        { role: 'detective', enabled: false, basic: false },
        { role: 'sniper', enabled: false, basic: false },
        { role: 'reviver', enabled: false, basic: false },
        { role: 'wizard', enabled: false, basic: false }
      ]);
      
      // Start the countdown
      gameManager.startCountdown(game.id);
      
      log(`Game ${game.id} started by ${interaction.user.username}`, 'discord-game');
    } catch (error) {
      log(`Error executing game command: ${error}`, 'discord');
      await interaction.reply({
        content: 'حدث خطأ أثناء إنشاء اللعبة. الرجاء المحاولة مرة أخرى.',
        flags: [1 << 6]
      });
    }
  }
};

// Register button interactions
export function registerButtonHandlers(client: Client) {
  // نقوم بإنشاء معالج واحد فقط لجميع تفاعلات الأزرار
  client.on(Events.InteractionCreate, async (interaction) => {
    // تجاهل التفاعلات التي ليست أزرار
    if (!interaction.isButton()) return;
    
    const buttonId = interaction.customId;
    
    try {
      // تسجيل معلومات التفاعل للمساعدة في تصحيح الأخطاء
      log(`معالجة تفاعل الزر: ${buttonId}`, 'discord-debug');
      
      // نفحص فئة الزر ونوجه التفاعل للمعالج المناسب
      if (buttonId.startsWith('game_join_') || 
          buttonId.startsWith('game_leave_') || 
          buttonId.startsWith('game_rules_') || 
          buttonId.startsWith('game_feedback_') ||
          buttonId.startsWith('game_start_')) {
        await handleInitialViewButtons(interaction as ButtonInteraction);
      }
      else if (buttonId.startsWith('role_auto_') || 
               buttonId.startsWith('role_start_') ||
               buttonId.startsWith('role_toggle_')) {
        await handleRoleConfigViewButtons(interaction as ButtonInteraction);
      }
      // تفاعلات مراحل اللعبة (مرحلة الليل، التصويت، إلخ)
      else if (buttonId.startsWith('werewolf_action_') || 
              buttonId.startsWith('seer_action_') ||
              buttonId.startsWith('guardian_action_') ||
              buttonId.startsWith('detective_action_') ||
              buttonId.startsWith('sniper_action_') ||
              buttonId.startsWith('reviver_action_') ||
              buttonId.startsWith('wizard_action_') ||
              buttonId.startsWith('start_night_') ||
              buttonId.startsWith('end_discussion_') ||
              buttonId.startsWith('start_voting_') ||
              buttonId.startsWith('end_voting_') ||
              buttonId.startsWith('vote_player_') || 
              buttonId.startsWith('vote_skip_') ||
              buttonId.startsWith('new_game_')) {
        // استخراج معرّف اللعبة من معرّف الزر للتوجيه المناسب
        const parts = buttonId.split('_');
        // نحاول استخراج معرف اللعبة - ربما يكون في موقع مختلف حسب نوع الزر
        let gameId;
        
        // نحدد صيغة معرف اللعبة بناءً على نوع الزر
        if (buttonId.startsWith('werewolf_action_') || 
            buttonId.startsWith('seer_action_') || 
            buttonId.startsWith('guardian_action_') || 
            buttonId.startsWith('detective_action_') || 
            buttonId.startsWith('sniper_action_') || 
            buttonId.startsWith('reviver_action_') || 
            buttonId.startsWith('wizard_action_') ||
            buttonId.startsWith('vote_player_') ||
            buttonId.startsWith('vote_skip_')) {
          // الصيغة هي role_action_gameID_targetID
          // تأكد من أن معرف اللعبة هو بالفعل رقم صحيح وليس معرف ديسكورد طويل
          if (parts.length >= 4) {
            // نتوقع أن يكون معرف اللعبة رقماً صغيراً نسبياً في المكان الثالث (index 2)
            const potentialGameId = parseInt(parts[2]);
            if (!isNaN(potentialGameId) && potentialGameId < 10000) {
              gameId = potentialGameId;
            } else {
              // إذا لم يكن معرف اللعبة منطقياً، نطبع رسالة تصحيح أخطاء
              log(`تنسيق معرف زر غير صحيح: ${buttonId} - أجزاء: ${parts.join(',')}`, 'discord-debug');
              // نفترض أن اللعبة رقم 1 في هذه الحالة
              gameId = 1;
            }
          } else {
            // إذا كان عدد الأجزاء غير كافٍ، نفترض أن اللعبة رقم 1
            gameId = 1;
          }
        } else {
          // في بقية الحالات الصيغة هي action_type_gameID
          gameId = parseInt(parts[parts.length - 1]);
        }
        
        if (isNaN(gameId)) {
          log(`معرف لعبة غير صالح في: ${buttonId}`, 'discord-error');
          await interaction.reply({
            content: 'حدث خطأ في معالجة الزر (معرف لعبة غير صالح)',
            flags: [1 << 6]
          });
          return;
        }
        
        // الحصول على حالة اللعبة
        const gameManager = getGameManager();
        const gameState = gameManager.getGameState(gameId);
        
        if (!gameState) {
          log(`لم يتم العثور على حالة اللعبة: ${gameId}`, 'discord-error');
          await interaction.reply({
            content: 'لم يتم العثور على اللعبة المطلوبة',
            flags: [1 << 6]
          });
          return;
        }
        
        // معالجة تفاعلات مراحل اللعبة وفقًا لنوع الزر
        if (buttonId.startsWith('werewolf_action_')) {
          log(`معالجة إجراء المستذئب: ${buttonId}`, 'discord-debug');
          
          // التأكد من أن التفاعل معلق قبل إنشاء الرد
          try {
            await interaction.deferUpdate();
          } catch (error) {
            log(`خطأ في تأجيل تحديث إجراء المستذئب: ${error}`, 'discord-error');
          }
          
          // استخراج معرّفات من customId
          // تنسيق المعرف: werewolf_action_GAMEID_PLAYERID
          const gameIdFromButton = parseInt(parts[2]);
          const targetId = parts[3];
          
          // استخدام المعرف المستخرج من الزر بدلاً من المعرف من gameState
          const targetGameState = getGameManager().getGameState(gameIdFromButton);
          
          if (!targetGameState) {
            await interaction.editReply({
              content: 'لم يتم العثور على اللعبة. قد تكون اللعبة قد انتهت.'
            });
            return;
          }
          
          // الحصول على اللاعب المستهدف
          const target = targetGameState.getPlayer(targetId);
          if (!target) {
            await interaction.editReply({
              content: 'اللاعب المستهدف غير موجود'
            });
            return;
          }
          
          // تسجيل إجراء المستذئب
          targetGameState.addNightAction(interaction.user.id, {
            targetId,
            actionType: 'kill'
          });
          
          // تعيين الضحية الحالية
          targetGameState.setWerewolfVictim(targetId);
          
          // إرسال تأكيد الإجراء
          await interaction.editReply({
            content: `تم اختيار **${target.username}** كضحية للمستذئبين هذه الليلة.`,
            components: [],
            embeds: []
          });
          
          log(`المستذئب اختار الضحية: ${target.username}`, 'discord-game');
          
          // إذا كانت جميع الإجراءات الليلية قد تمت، انتقل إلى مرحلة النهار
          if (gameState.areAllNightActionsDone()) {
            // إحضار الضحية المستهدفة
            const victim = gameState.getPlayer(gameState.currentNightVictim as string);
            const wasProtected = victim?.protected || false;
            
            // بدء مرحلة النهار بعد مهلة قصيرة
            setTimeout(() => {
              const dummyInteraction = interaction; // استخدام نفس التفاعل
              startDayPhase(gameId, dummyInteraction, victim, wasProtected);
            }, 2000);
          }
        }
        // معالجة تفاعلات الأدوار الأخرى
        else if (buttonId.startsWith('seer_action_')) {
          log(`معالجة إجراء العراف: ${buttonId}`, 'discord-debug');
          
          // التأكد من أن التفاعل معلق قبل إنشاء الرد
          try {
            await interaction.deferUpdate();
          } catch (error) {
            log(`خطأ في تأجيل تحديث إجراء العراف: ${error}`, 'discord-error');
          }
          
          // استخراج معرّفات من customId
          // تنسيق المعرف: seer_action_GAMEID_PLAYERID
          const gameIdFromButton = parseInt(parts[2]);
          const targetId = parts[3];
          
          // استخدام المعرف المستخرج من الزر بدلاً من المعرف من gameState
          const targetGameState = getGameManager().getGameState(gameIdFromButton);
          
          if (!targetGameState) {
            await interaction.editReply({
              content: 'لم يتم العثور على اللعبة. قد تكون اللعبة قد انتهت.'
            });
            return;
          }
          
          // الحصول على اللاعب المستهدف
          const target = targetGameState.getPlayer(targetId);
          if (!target) {
            await interaction.editReply({
              content: 'اللاعب المستهدف غير موجود'
            });
            return;
          }
          
          // تسجيل إجراء العراف
          targetGameState.addNightAction(interaction.user.id, {
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
          await interaction.editReply({
            embeds: [resultEmbed],
            components: [],
            content: null
          });
          
          log(`العراف كشف هوية: ${target.username} (${isWerewolf ? 'مستذئب' : 'قروي'})`, 'discord-game');
          
          // التحقق من انتهاء الإجراءات الليلية
          if (gameState.areAllNightActionsDone()) {
            // إحضار الضحية المستهدفة
            const victim = gameState.getPlayer(gameState.currentNightVictim as string);
            const wasProtected = victim?.protected || false;
            
            // بدء مرحلة النهار بعد مهلة قصيرة
            setTimeout(() => {
              const dummyInteraction = interaction; // استخدام نفس التفاعل
              startDayPhase(gameId, dummyInteraction, victim, wasProtected);
            }, 2000);
          }
        }
        else if (buttonId.startsWith('guardian_action_')) {
          log(`معالجة إجراء الحارس: ${buttonId}`, 'discord-debug');
          
          // التأكد من أن التفاعل معلق قبل إنشاء الرد
          try {
            await interaction.deferUpdate();
          } catch (error) {
            log(`خطأ في تأجيل تحديث إجراء الحارس: ${error}`, 'discord-error');
          }
          
          // استخراج معرّفات من customId
          // تنسيق المعرف: guardian_action_GAMEID_PLAYERID
          const gameIdFromButton = parseInt(parts[2]);
          const targetId = parts[3];
          
          // استخدام المعرف المستخرج من الزر بدلاً من المعرف من gameState
          const targetGameState = getGameManager().getGameState(gameIdFromButton);
          
          if (!targetGameState) {
            await interaction.editReply({
              content: 'لم يتم العثور على اللعبة. قد تكون اللعبة قد انتهت.'
            });
            return;
          }
          
          // الحصول على اللاعب المستهدف
          const target = targetGameState.getPlayer(targetId);
          if (!target) {
            await interaction.editReply({
              content: 'اللاعب المستهدف غير موجود'
            });
            return;
          }
          
          // تسجيل إجراء الحارس
          targetGameState.addNightAction(interaction.user.id, {
            targetId,
            actionType: 'protect'
          });
          
          // تعيين حالة الحماية للاعب المستهدف
          if (target) {
            target.protected = true;
            targetGameState.players.set(targetId, target);
          }
          
          // إرسال تأكيد الإجراء
          await interaction.editReply({
            content: `تم اختيار **${target.username}** للحماية هذه الليلة.`,
            components: [],
            embeds: []
          });
          
          log(`الحارس اختار حماية: ${target.username}`, 'discord-game');
          
          // التحقق من انتهاء الإجراءات الليلية
          if (gameState.areAllNightActionsDone()) {
            // إحضار الضحية المستهدفة
            const victim = gameState.getPlayer(gameState.currentNightVictim as string);
            const wasProtected = victim?.protected || false;
            
            // بدء مرحلة النهار بعد مهلة قصيرة
            setTimeout(() => {
              const dummyInteraction = interaction; // استخدام نفس التفاعل
              startDayPhase(gameId, dummyInteraction, victim, wasProtected);
            }, 2000);
          }
        }
        else if (buttonId.startsWith('detective_action_')) {
          log(`معالجة إجراء المحقق: ${buttonId}`, 'discord-debug');
          
          // التأكد من أن التفاعل معلق قبل إنشاء الرد
          try {
            await interaction.deferUpdate();
          } catch (error) {
            log(`خطأ في تأجيل تحديث إجراء المحقق: ${error}`, 'discord-error');
          }
          
          // استخراج معرّفات من customId
          // تنسيق المعرف: detective_action_GAMEID_PLAYERID
          const gameIdFromButton = parseInt(parts[2]);
          const targetId = parts[3];
          
          // استخدام المعرف المستخرج من الزر بدلاً من المعرف من gameState
          const targetGameState = getGameManager().getGameState(gameIdFromButton);
          
          if (!targetGameState) {
            await interaction.editReply({
              content: 'لم يتم العثور على اللعبة. قد تكون اللعبة قد انتهت.'
            });
            return;
          }
          
          // الحصول على اللاعب المستهدف
          const target = targetGameState.getPlayer(targetId);
          if (!target) {
            await interaction.editReply({
              content: 'اللاعب المستهدف غير موجود'
            });
            return;
          }
          
          // تسجيل إجراء المحقق
          targetGameState.addNightAction(interaction.user.id, {
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
          await interaction.editReply({
            embeds: [resultEmbed],
            components: [],
            content: null
          });
          
          log(`المحقق كشف دور: ${target.username} (${target.role})`, 'discord-game');
          
          // التحقق من انتهاء الإجراءات الليلية
          if (gameState.areAllNightActionsDone()) {
            // إحضار الضحية المستهدفة
            const victim = gameState.getPlayer(gameState.currentNightVictim as string);
            const wasProtected = victim?.protected || false;
            
            // بدء مرحلة النهار بعد مهلة قصيرة
            setTimeout(() => {
              const dummyInteraction = interaction; // استخدام نفس التفاعل
              startDayPhase(gameId, dummyInteraction, victim, wasProtected);
            }, 2000);
          }
        }
        else if (buttonId.startsWith('sniper_action_')) {
          // سنضيف معالجة هذا الزر لاحقاً إذا تطلب الأمر
          return;
        }
        else if (buttonId.startsWith('reviver_action_')) {
          // سنضيف معالجة هذا الزر لاحقاً إذا تطلب الأمر
          return;
        }
        else if (buttonId.startsWith('wizard_action_')) {
          // سنضيف معالجة هذا الزر لاحقاً إذا تطلب الأمر
          return;
        }
        else if (buttonId.startsWith('start_night_') || 
                buttonId.startsWith('end_discussion_') || 
                buttonId.startsWith('start_voting_') || 
                buttonId.startsWith('end_voting_') || 
                buttonId.startsWith('new_game_')) {
          // معالجة أزرار مراحل اللعبة الأخرى
          log(`توجيه زر مرحلة اللعبة: ${buttonId}`, 'discord-debug');
          
          // تأكيد استلام التفاعل
          await interaction.deferUpdate().catch(error => {
            log(`Error deferring update: ${error}`, 'discord-error');
          });
          
          // هذا الزر غير مستخدم الآن (تم استبداله بالبدء التلقائي)
          if (buttonId.startsWith('start_night_')) {
            // لن نفعل شيئًا هنا لأن مرحلة الليل تبدأ تلقائيًا
            await interaction.followUp({
              content: 'ستبدأ الليلة تلقائيًا، لا داعي للضغط على هذا الزر.',
              ephemeral: true
            });
          }
          else if (buttonId.startsWith('end_discussion_')) {
            // التحقق من أن الضاغط على الزر هو مالك اللعبة
            if (interaction.user.id !== gameState.ownerId) {
              await interaction.followUp({
                content: 'فقط مالك اللعبة يمكنه إنهاء النقاش',
                ephemeral: true
              });
              return;
            }
            
            // إيقاف المؤقت إذا كان موجودًا
            if (gameState.discussionTimer) {
              clearInterval(gameState.discussionTimer);
            }
            
            // بدء مرحلة التصويت
            startVotingPhase(gameId, interaction);
          }
          else if (buttonId.startsWith('start_voting_')) {
            startVotingPhase(gameId, interaction);
          }
          else if (buttonId.startsWith('end_voting_')) {
            // إيقاف مؤقت التصويت إذا كان موجودًا
            if (gameState.votingTimer) {
              clearInterval(gameState.votingTimer);
            }
            
            handleVotingResults(gameId, interaction);
          }
          else if (buttonId.startsWith('vote_player_')) {
            log(`معالجة زر تصويت: ${buttonId}`, 'discord-debug');
            
            // التأكد من أن التفاعل معلق قبل إنشاء الرد
            try {
              await interaction.deferReply({ ephemeral: true });
            } catch (error) {
              log(`خطأ في تأجيل الرد: ${error}`, 'discord-error');
            }
            
            // استخراج معرفات من customId
            // تنسيق المعرف: vote_player_GAMEID_PLAYERID
            const gameIdFromButton = parseInt(parts[2]);
            const targetId = parts[3];
            
            // استخدام المعرف المستخرج من الزر بدلاً من المعرف من gameState
            const targetGameState = getGameManager().getGameState(gameIdFromButton);
            
            if (!targetGameState) {
              await interaction.editReply({
                content: 'لم يتم العثور على اللعبة. قد تكون اللعبة قد انتهت.'
              });
              return;
            }
            
            // التحقق من أن اللاعب موجود في اللعبة وعلى قيد الحياة
            const voter = targetGameState.getPlayer(interaction.user.id);
            const target = targetGameState.getPlayer(targetId);
            
            if (!voter || !voter.isAlive) {
              await interaction.editReply({
                content: 'لا يمكنك التصويت إلا إذا كنت على قيد الحياة في اللعبة.'
              });
              return;
            }
            
            if (!target || !target.isAlive) {
              await interaction.editReply({
                content: 'اللاعب المستهدف غير موجود أو ليس على قيد الحياة.'
              });
              return;
            }
            
            // إذا كان اللاعب قد صوت سابقًا، قم بإزالة الصوت السابق
            if (voter.voted && voter.votedFor) {
              targetGameState.removeVote(interaction.user.id);
            }
            
            // تسجيل التصويت الجديد
            targetGameState.addVote(interaction.user.id, targetId);
            
            // تأكيد التصويت للمستخدم
            await interaction.editReply({
              content: `لقد قمت بالتصويت ضد **${target.username}**!`
            });
            
            // تحديث رسالة التصويت العامة
            const { updateVotingMessage } = require('./tempUpdateVoting');
            await updateVotingMessage(targetGameState, interaction);
          }
          else if (buttonId.startsWith('vote_skip_')) {
            log(`معالجة زر تخطي التصويت: ${buttonId}`, 'discord-debug');
            
            // التأكد من أن التفاعل معلق قبل إنشاء الرد
            try {
              await interaction.deferReply({ ephemeral: true });
            } catch (error) {
              log(`خطأ في تأجيل الرد: ${error}`, 'discord-error');
            }
            
            // استخراج معرف اللعبة من customId
            // تنسيق المعرف: vote_skip_GAMEID
            const gameIdFromButton = parseInt(parts[2]);
            
            // استخدام المعرف المستخرج من الزر بدلاً من المعرف من gameState
            const targetGameState = getGameManager().getGameState(gameIdFromButton);
            
            if (!targetGameState) {
              await interaction.editReply({
                content: 'لم يتم العثور على اللعبة. قد تكون اللعبة قد انتهت.'
              });
              return;
            }
            
            // التحقق من أن اللاعب موجود في اللعبة وعلى قيد الحياة
            const voter = targetGameState.getPlayer(interaction.user.id);
            
            if (!voter || !voter.isAlive) {
              await interaction.editReply({
                content: 'لا يمكنك تخطي التصويت إلا إذا كنت على قيد الحياة في اللعبة.'
              });
              return;
            }
            
            // إذا كان اللاعب قد صوت سابقًا، قم بإزالة الصوت السابق
            if (voter.voted && voter.votedFor) {
              targetGameState.removeVote(interaction.user.id);
            }
            
            // تعيين حالة التصويت المُتخطى
            voter.voted = true;
            targetGameState.players.set(interaction.user.id, voter);
            
            // تأكيد تخطي التصويت للمستخدم
            await interaction.editReply({
              content: `لقد قمت بتخطي التصويت لهذه الجولة.`
            });
            
            // تحديث رسالة التصويت العامة
            const { updateVotingMessage } = require('./tempUpdateVoting');
            await updateVotingMessage(targetGameState, interaction);
          }
          else if (buttonId.startsWith('new_game_')) {
            await interaction.followUp({
              content: 'لبدء لعبة جديدة، استخدم الأمر `/game`',
              ephemeral: true
            });
          }
        }
      }
      else {
        // أي زر غير معروف
        log(`زر غير معروف: ${buttonId}`, 'discord-warning');
      }
    } catch (error: any) {
      log(`Error handling button interaction: ${error}`, 'discord');
      
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: `حدث خطأ أثناء معالجة التفاعل: ${error.message || 'خطأ غير معروف'}`,
            flags: [1 << 6]
          });
        } else {
          await interaction.reply({
            content: `حدث خطأ أثناء معالجة التفاعل: ${error.message || 'خطأ غير معروف'}`,
            flags: [1 << 6]
          });
        }
      } catch (nestedError) {
        log(`خطأ أثناء محاولة إرسال رسالة الخطأ: ${nestedError}`, 'discord-error');
      }
    }
  });
}

// Register modal submit interactions
export function registerModalHandlers(client: Client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    
    try {
      await handleModalSubmit(interaction as ModalSubmitInteraction);
    } catch (error: any) {
      log(`Error handling modal submission: ${error}`, 'discord');
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'حدث خطأ أثناء معالجة النموذج. الرجاء المحاولة مرة أخرى.',
          flags: [1 << 6]
        });
      } else {
        await interaction.reply({
          content: 'حدث خطأ أثناء معالجة النموذج. الرجاء المحاولة مرة أخرى.',
          flags: [1 << 6]
        });
      }
    }
  });
}

// Register select menu interactions
export function registerSelectMenuHandlers(client: Client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    
    try {
      // Handle select menu interactions (if needed)
    } catch (error: any) {
      log(`Error handling select menu interaction: ${error}`, 'discord');
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'حدث خطأ أثناء معالجة الاختيار. الرجاء المحاولة مرة أخرى.',
          flags: [1 << 6]
        });
      } else {
        await interaction.reply({
          content: 'حدث خطأ أثناء معالجة الاختيار. الرجاء المحاولة مرة أخرى.',
          flags: [1 << 6]
        });
      }
    }
  });
}

// استخدم دالة تحديث رسالة التصويت من الملف المنفصل

// Register all commands and interaction handlers
export function registerCommands(client: Client) {
  // Register command
  commands.set(gameCommand.data.name, gameCommand);
  
  // Register interaction handlers
  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const command = commands.get(interaction.commandName);
    if (!command) {
      log(`No command matching ${interaction.commandName} was found.`, 'discord');
      return;
    }
    
    try {
      await command.execute(interaction);
    } catch (error: any) {
      log(`Error executing ${interaction.commandName}: ${error}`, 'discord');
      
      const errorMessage = 'حدث خطأ أثناء تنفيذ هذا الأمر.';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, flags: [1 << 6] });
      } else {
        await interaction.reply({ content: errorMessage, flags: [1 << 6] });
      }
    }
  });
  
  // Register button handlers
  registerButtonHandlers(client);
  
  // Register modal handlers
  registerModalHandlers(client);
  
  // Register select menu handlers
  registerSelectMenuHandlers(client);
  
  // Register game phase button handlers
  registerGamePhaseButtons(client);
  
  log('Registered all commands and interaction handlers', 'discord');
}
