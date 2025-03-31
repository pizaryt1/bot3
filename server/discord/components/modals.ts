import { 
  ModalBuilder, 
  ActionRowBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalSubmitInteraction
} from 'discord.js';
import { log } from '../../vite';

// Create feedback modal
export function createFeedbackModal(gameId: number) {
  const modal = new ModalBuilder()
    .setCustomId(`feedback_modal_${gameId}`)
    .setTitle('إرسال اقتراح أو شكوى');
  
  // Create the feedback type select
  const feedbackType = new TextInputBuilder()
    .setCustomId('feedbackType')
    .setLabel('نوع الرسالة')
    .setPlaceholder('اقتراح، شكوى، خطأ برمجي، أخرى')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  
  // Create the feedback content input
  const feedbackContent = new TextInputBuilder()
    .setCustomId('feedbackContent')
    .setLabel('الرسالة')
    .setPlaceholder('اكتب رسالتك هنا...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);
  
  // Add inputs to the modal
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
    
    const feedbackType = interaction.fields.getTextInputValue('feedbackType');
    const feedbackContent = interaction.fields.getTextInputValue('feedbackContent');
    
    // Log the feedback
    log(`Feedback from ${interaction.user.tag} for game ${gameId}:
Type: ${feedbackType}
Content: ${feedbackContent}`, 'discord-feedback');
    
    // Thank the user
    await interaction.reply({
      content: 'شكرًا لك على تقديم ملاحظاتك! تم استلام رسالتك وسيتم النظر فيها.',
      ephemeral: true
    });
  }
}
