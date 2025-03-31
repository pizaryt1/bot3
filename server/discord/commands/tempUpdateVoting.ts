// دالة تحديث رسالة التصويت
import { ButtonInteraction, EmbedBuilder, TextChannel } from 'discord.js';
import { getClient } from '../bot';
import { GameState } from '../game/gameState';
import { log } from '../../vite';
import { storage } from '../../storage';
import { handleVotingResults } from '../components/gamePhaseManager';

export async function updateVotingMessage(gameState: GameState, interaction: ButtonInteraction) {
  try {
    // الحصول على معلومات اللعبة والقناة
    const client = getClient();
    const game = await storage.getGame(gameState.id);
    if (!game || !game.channelId) {
      throw new Error(`لم يتم العثور على معلومات اللعبة ${gameState.id}`);
    }
    const channel = await client.channels.fetch(game.channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`لم يتم العثور على القناة ${game.channelId}`);
    }

    // تحديث رسالة التصويت العامة مع العدد الجديد للأصوات
    if (gameState.votingMessageId) {
      try {
        const message = await (channel as TextChannel).messages.fetch(gameState.votingMessageId);
        if (message && message.embeds.length > 0) {
          // بناء وصف جديد مع عدد الأصوات المُحدث
          let newDescription = `## حان وقت التصويت!\n\nاختر لاعباً تشك في أنه مستذئب للتصويت ضده.\nالتصويت متاح لمدة 30 ثانية.\n\n`;
          newDescription += `**المرشحون للتصويت:**\n\n`;
          
          const alivePlayers = gameState.getAlivePlayers();
          for (const player of alivePlayers) {
            // تحويل عدد الأصوات إلى رموز تعبيرية
            const voteCount = player.voteCount || 0;
            let voteEmoji = '0️⃣';
            if (voteCount === 1) voteEmoji = '1️⃣';
            else if (voteCount === 2) voteEmoji = '2️⃣';
            else if (voteCount === 3) voteEmoji = '3️⃣';
            else if (voteCount === 4) voteEmoji = '4️⃣';
            else if (voteCount === 5) voteEmoji = '5️⃣';
            else if (voteCount >= 6) voteEmoji = '6️⃣';
            
            newDescription += `🔹 **${player.username}** - الأصوات: ${voteEmoji}\n`;
          }
          
          // إنشاء نسخة جديدة من الرسالة المضمنة مع الوصف المحدث
          const updatedEmbed = new EmbedBuilder()
            .setTitle(message.embeds[0].title || '🗳️ التصويت العام')
            .setColor(message.embeds[0].color || '#1E90FF')
            .setDescription(newDescription);
          
          // تحديث الرسالة
          await message.edit({ embeds: [updatedEmbed] });
        }
      } catch (error) {
        log(`خطأ في تحديث رسالة التصويت: ${error}`, 'discord-error');
      }
    }
    
    // إذا صوت جميع اللاعبين، قم بإنهاء التصويت تلقائيًا
    if (gameState.areAllVotesDone()) {
      // إيقاف المؤقت إذا كان موجودًا
      if (gameState.votingTimer) {
        clearInterval(gameState.votingTimer);
      }
      
      // الانتظار قليلاً ثم عرض النتائج
      setTimeout(async () => {
        await (channel as TextChannel).send({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ اكتمل التصويت!')
              .setColor('#00FF00')
              .setDescription('جميع اللاعبين قد أدلوا بأصواتهم. سيتم عرض النتائج الآن.')
          ]
        });
        
        // معالجة نتائج التصويت
        handleVotingResults(gameState.id, interaction);
      }, 2000);
    }
  } catch (error) {
    log(`خطأ في تحديث رسالة التصويت: ${error}`, 'discord-error');
  }
}