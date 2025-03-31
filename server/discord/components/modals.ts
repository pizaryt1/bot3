import { 
  ModalBuilder, 
  ActionRowBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalSubmitInteraction,
  EmbedBuilder
} from 'discord.js';
import { log } from '../../vite';
import { getClient } from '../bot';

// Create feedback modal - simplified version
export function createFeedbackModal(gameId: number) {
  const modal = new ModalBuilder()
    .setCustomId(`feedback_modal_${gameId}`)
    .setTitle('إرسال اقتراح أو شكوى');
  
  // Create the feedback type select with simple options
  const feedbackType = new TextInputBuilder()
    .setCustomId('feedbackType')
    .setLabel('نوع الرسالة')
    .setPlaceholder('اقتراح، شكوى، مشكلة، أخرى')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(50);
  
  // Create the feedback content input with simple instructions
  const feedbackContent = new TextInputBuilder()
    .setCustomId('feedbackContent')
    .setLabel('محتوى الرسالة')
    .setPlaceholder('اكتب اقتراحك أو شكواك هنا')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);
  
  // Add inputs to the modal with two fields only
  const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(feedbackType);
  const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(feedbackContent);
  
  modal.addComponents(firstActionRow, secondActionRow);
  
  return modal;
}

// Handle modal submit interactions
export async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  const modalId = interaction.customId;
  
  // Handle feedback modal
  if (modalId.startsWith('feedback_modal_')) {
    const gameId = parseInt(modalId.split('_').pop() || '0');
    
    if (isNaN(gameId) || gameId <= 0) {
      await interaction.reply({
        content: 'خطأ في معرف اللعبة.',
        ephemeral: true
      });
      return;
    }
    
    // Get feedback information - simplified
    const feedbackType = interaction.fields.getTextInputValue('feedbackType');
    const feedbackContent = interaction.fields.getTextInputValue('feedbackContent');
    
    // Log the feedback
    log(`Feedback from ${interaction.user.tag} for game ${gameId}:
Type: ${feedbackType}
Content: ${feedbackContent}`, 'discord-feedback');
    
    // Create a simple and clean embed for admin
    const feedbackEmbed = new EmbedBuilder()
      .setTitle(`🔔 ${feedbackType}`)
      .setColor('#5865F2')
      .setDescription(`من اللاعب **${interaction.user.username}** (${interaction.user.id})`)
      .addFields(
        { name: '📝 نوع الرسالة', value: feedbackType, inline: true },
        { name: '🎮 رقم اللعبة', value: `${gameId}`, inline: true },
        { name: '📋 المحتوى', value: feedbackContent }
      )
      .setFooter({ text: `${new Date().toLocaleString('ar-SA')}` })
      .setTimestamp();
    
    try {
      // Send the feedback to the admin's DM
      const client = getClient();
      const adminUser = await client.users.fetch('417004590899265557'); // Your user ID
      
      if (adminUser) {
        await adminUser.send({ embeds: [feedbackEmbed] });
      }
    } catch (error) {
      log(`Error sending feedback DM: ${error}`, 'discord-feedback');
    }
    
    // Thank the user with a better message
    await interaction.reply({
      content: `✅ **شكرًا لك على وقتك!**

تم استلام رسالتك بنجاح وسيتم مراجعتها قريبًا.
نحن نقدر ملاحظاتك ونسعى دائمًا لتحسين تجربة اللعب.

*نوع الرسالة:* ${feedbackType}`,
      ephemeral: true
    });
  }
}
