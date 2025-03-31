import { 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder,
  AttachmentBuilder
} from 'discord.js';
import { RoleType } from '@shared/schema';
import { getRoleEmoji, getRoleDisplayName } from './roleConfigView';
import { createRolesDistributionCanvas } from '../utils/canvasGenerator';
import { log } from '../../vite';
import path from 'path';
import { getGameManager } from '../game/gameManager';

// Create the role distribution
export async function createRoleDistributionEmbed(gameId: number, enabledRoles: RoleType[]) {
  try {
    // Get the gamestate to access actual assigned roles
    const gameManager = getGameManager();
    const gameState = gameManager.getGameState(gameId);

    if (!gameState) {
      throw new Error(`Game with ID ${gameId} not found`);
    }

    // Get all players with their assigned roles
    const assignedRoleTypes: RoleType[] = [];
    gameState.getAllPlayers().forEach(player => {
      if (player.role) {
        assignedRoleTypes.push(player.role);
      }
    });
    
    // Generate the role distribution image based on actual assigned roles (not just enabled roles)
    const rolesImageBuffer = await createRolesDistributionCanvas(assignedRoleTypes);
    const rolesAttachment = new AttachmentBuilder(rolesImageBuffer, { name: 'roles-distribution.png' });
    
    // Return only the file, no embed or components
    return {
      files: [rolesAttachment],
      components: [] // No components for this view
    };
  } catch (error) {
    log(`Error creating role distribution: ${error}`, 'discord');
    
    // Return empty in case of error (will be handled in the calling function)
    return {
      files: [],
      components: []
    };
  }
}

// Create embeds for each role to be sent to players
export function createRoleAssignmentEmbed(role: RoleType, description: string, teammates?: string[]) {
  // Get the role image path based on role type - using the full size images for role assignments
  let roleImagePath = '';
  try {
    // Try to use the full size role images (not icons) for role assignments
    if (role === 'werewolf') {
      roleImagePath = path.join(process.cwd(), 'attached_assets', 'مستذئب.png');
    } else if (role === 'werewolfLeader') {
      roleImagePath = path.join(process.cwd(), 'attached_assets', 'زعيم المستذئبين.png');
    } else if (role === 'wizard') {
      roleImagePath = path.join(process.cwd(), 'attached_assets', 'الساحر.png');
    } else if (role === 'villager') {
      roleImagePath = path.join(process.cwd(), 'attached_assets', 'القروي.webp');
    } else if (role === 'seer') {
      roleImagePath = path.join(process.cwd(), 'attached_assets', 'العراف.webp');
    } else if (role === 'detective') {
      roleImagePath = path.join(process.cwd(), 'attached_assets', 'المحقق.webp');
    } else if (role === 'guardian') {
      roleImagePath = path.join(process.cwd(), 'attached_assets', 'الحارس.webp');
    } else if (role === 'sniper') {
      roleImagePath = path.join(process.cwd(), 'attached_assets', 'القناص.webp');
    } else if (role === 'reviver') {
      roleImagePath = path.join(process.cwd(), 'attached_assets', 'المنعش.webp');
    } else {
      // Fallback in case the specific path isn't found
      roleImagePath = path.join(process.cwd(), 'attached_assets', `${getRoleDisplayName(role)}.webp`);
    }
  } catch (error) {
    // If file not found, try the icon version as fallback
    try {
      if (role === 'werewolf') {
        roleImagePath = path.join(process.cwd(), 'attached_assets', 'رمز المستذئب.png');
      } else if (role === 'werewolfLeader') {
        roleImagePath = path.join(process.cwd(), 'attached_assets', 'رمز زعيم المستذئبين.png');
      } else if (role === 'wizard') {
        roleImagePath = path.join(process.cwd(), 'attached_assets', 'رمز الساحر.png');
      } else if (role === 'villager') {
        roleImagePath = path.join(process.cwd(), 'attached_assets', 'رمز القروي.png');
      } else if (role === 'seer') {
        roleImagePath = path.join(process.cwd(), 'attached_assets', 'رمز العراف.png');
      } else if (role === 'detective') {
        roleImagePath = path.join(process.cwd(), 'attached_assets', 'رمز المحقق.png');
      } else if (role === 'guardian') {
        roleImagePath = path.join(process.cwd(), 'attached_assets', 'رمز الحارس.png');
      } else if (role === 'sniper') {
        roleImagePath = path.join(process.cwd(), 'attached_assets', 'رمز القناص.png');
      } else if (role === 'reviver') {
        roleImagePath = path.join(process.cwd(), 'attached_assets', 'رمز المنعش.png');
      }
      log(`Using icon image as fallback for ${role}`, 'discord');
    } catch (fallbackError) {
      log(`Role image not found for ${role}: ${fallbackError}`, 'discord');
      // No image available
    }
  }

  // Create image attachment if an image exists
  let roleImageAttachment;
  try {
    roleImageAttachment = new AttachmentBuilder(roleImagePath, { name: `${role}-image.png` });
  } catch (error) {
    log(`Failed to create role image attachment: ${error}`, 'discord');
    // No image attachment will be created
  }
  
  // Get team based on role
  const team = (role === 'werewolf' || role === 'werewolfLeader') ? 'المستذئبين' : 'القرويين';
  const teamIcon = (role === 'werewolf' || role === 'werewolfLeader') ? '🐺' : '🏠';
  
  // Get power frequency based on role
  let powerFrequency = '';
  if (role === 'sniper' || role === 'reviver' || role === 'wizard' || role === 'werewolfLeader') {
    powerFrequency = '(محدود الاستخدام)';
  } else if (role !== 'villager') {
    powerFrequency = '(كل ليلة)';
  }
  
  // Create a beautiful embed with all necessary information
  const embed = new EmbedBuilder()
    .setTitle(`🎭 دورك: ${getRoleDisplayName(role)} ${getRoleEmoji(role)}`)
    .setColor(getRoleColor(role))
    .setDescription(`${description}\n\n**الفريق**: ${teamIcon} ${team} ${powerFrequency ? `\n**نوع القدرة**: ${powerFrequency}` : ''}`)
    .setFooter({ text: 'تذكر: حافظ على سرية دورك! لا تقم بكشفه للآخرين.' });
    
  // Add the image as a large image at the bottom of the embed
  if (roleImageAttachment) {
    embed.setImage(`attachment://${role}-image.png`);
  }
  
  // Add role instructions with better formatting
  embed.addFields({ 
    name: '📜 مهامك وقدراتك الخاصة:', 
    value: getRoleInstructions(role) 
  });
  
  // Add detailed game tips based on role
  embed.addFields({ 
    name: '💡 نصائح اللعب:', 
    value: getRoleTips(role) 
  });
  
  // Add teammates field for werewolves with better formatting
  if (teammates && (role === 'werewolf' || role === 'werewolfLeader')) {
    embed.addFields({ 
      name: '🐺 فريق المستذئبين:', 
      value: teammates.length > 0 ? `هؤلاء هم زملاؤك المستذئبون:\n${teammates.join('\n')}` : '⚠️ أنت المستذئب الوحيد! كن حذراً جداً!' 
    });
  }
  
  // Return the embed and any attachments
  return {
    embed,
    files: roleImageAttachment ? [roleImageAttachment] : []
  };
}

// Helper function to get role color
function getRoleColor(role: RoleType): number {
  switch (role) {
    case 'villager': return 0x57F287; // Green
    case 'werewolf': 
    case 'werewolfLeader': return 0xED4245; // Red
    case 'seer': return 0x5865F2; // Blue
    case 'detective': return 0xFEE75C; // Yellow
    case 'guardian': return 0x57F287; // Green
    case 'sniper': return 0xED4245; // Red
    case 'reviver': return 0x57F287; // Green
    case 'wizard': return 0x9B59B6; // Purple
    default: return 0x95A5A6; // Gray
  }
}

// Helper function to get role instructions - improved with better formatting and clarity
function getRoleInstructions(role: RoleType): string {
  switch (role) {
    case 'villager':
      return '🔹 **الوصف**: أنت قروي عادي تعيش في القرية.\n🔹 **القدرات**: ليس لديك قدرات خاصة.\n🔹 **الهدف**: التعاون مع القرويين الآخرين لاكتشاف هوية المستذئبين وإقصائهم قبل أن يقضوا على القرية.';
    
    case 'werewolf':
      return '🔹 **الوصف**: أنت مستذئب مختبئ بين القرويين.\n🔹 **القدرات**: في كل ليلة، تتشاور مع المستذئبين الآخرين لاختيار قروي لافتراسه.\n🔹 **الهدف**: القضاء على القرويين واحد تلو الآخر مع التستر على هويتك الحقيقية أثناء النهار.';
    
    case 'werewolfLeader':
      return '🔹 **الوصف**: أنت زعيم المستذئبين وأكثرهم خطورة.\n🔹 **القدرات العادية**: افتراس قروي كل ليلة مع فريقك.\n🔹 **القدرة الخاصة**: مرة واحدة خلال اللعبة، يمكنك تحويل قروي عادي إلى مستذئب لينضم إلى فريقك.\n🔹 **الهدف**: قيادة المستذئبين للقضاء على جميع القرويين.';
    
    case 'seer':
      return '🔹 **الوصف**: أنت تمتلك قدرات روحانية تمكنك من رؤية الحقيقة.\n🔹 **القدرات**: في كل ليلة، يمكنك اختيار شخص واحد لمعرفة هويته (قروي أم مستذئب).\n🔹 **الهدف**: استخدم معلوماتك لإرشاد القرية نحو العثور على المستذئبين دون كشف هويتك.';
    
    case 'detective':
      return '🔹 **الوصف**: أنت محقق ذكي تعمل لصالح القرية.\n🔹 **القدرات**: في كل ليلة، يمكنك التحقيق في شخص واحد للحصول على معلومات أكثر تفصيلاً عن هويته ودوره.\n🔹 **الهدف**: جمع المعلومات وتحليلها للمساعدة في الكشف عن المستذئبين.';
    
    case 'guardian':
      return '🔹 **الوصف**: أنت الحارس المكلف بحماية القرية.\n🔹 **القدرات**: في كل ليلة، يمكنك اختيار شخص واحد لحمايته من هجمات المستذئبين.\n🔹 **قيود**: لا يمكنك حماية نفس الشخص ليلتين متتاليتين.\n🔹 **الهدف**: حماية الأدوار المهمة في القرية لمساعدتهم على إنجاز مهامهم.';
    
    case 'sniper':
      return '🔹 **الوصف**: أنت قناص محترف يعمل من الظلال.\n🔹 **القدرات**: لديك طلقتان فقط طوال اللعبة، كل طلقة تقتل أي لاعب على الفور.\n🔹 **قيود**: استخدم طلقاتك بحكمة، فقد تقتل قروياً بالخطأ.\n🔹 **الهدف**: استخدام مهاراتك لإزالة التهديدات ودعم القرية.';
    
    case 'reviver':
      return '🔹 **الوصف**: أنت طبيب روحاني يمتلك قدرة إعادة الحياة.\n🔹 **القدرات**: مرة واحدة فقط طوال اللعبة، يمكنك إحياء شخص بعد موته.\n🔹 **قيود**: لا يمكنك إحياء نفسك أو إحياء شخص مات منذ أكثر من دورة واحدة.\n🔹 **الهدف**: إعادة دور حيوي للقرية في اللحظة المناسبة.';
    
    case 'wizard':
      return '🔹 **الوصف**: أنت ساحر يمتلك قوى سحرية نادرة.\n🔹 **القدرات**: لديك مادتان سحريتان يمكن استخدام كل منهما مرة واحدة فقط:\n  ✦ **إكسير الحماية**: يحمي جميع القرويين من الهجوم لليلة واحدة.\n  ✦ **سم قاتل**: يقتل لاعب واحد من اختيارك.\n🔹 **الهدف**: استخدام قواك في التوقيت المناسب لمساعدة القرية.';
    
    default:
      return 'لم يتم العثور على تعليمات لهذا الدور.';
  }
}

// Helper function to get role-specific tips
function getRoleTips(role: RoleType): string {
  switch (role) {
    case 'villager':
      return '• راقب تصرفات اللاعبين وكلامهم بحذر\n• شارك في النقاشات وساعد في تحديد المشتبه بهم\n• لا تخف من التعبير عن آرائك، فأنت فرد مهم في القرية\n• تحالف مع الأدوار الأخرى إذا استطعت التأكد منها';
    
    case 'werewolf':
      return '• تصرف بشكل طبيعي وتجنب جذب الانتباه\n• لا تدافع عن مستذئبين آخرين بشكل واضح\n• تعاون مع فريقك لاختيار الضحايا الخطرة أولاً (مثل العراف أو المحقق)\n• استخدم الكذب بحكمة وكن متسقاً في روايتك';
    
    case 'werewolfLeader':
      return '• نسق مع فريقك واتخذ قرارات استراتيجية\n• استخدم قدرة التحويل في الوقت المناسب (مثلا عندما يكون عدد المستذئبين قليل)\n• اختر بحكمة الشخص الذي ستحوله - يفضل شخص موثوق من القرويين\n• قم بتوجيه فريقك بشكل سري';
    
    case 'seer':
      return '• كن حذراً في كشف هويتك مبكراً، فقد يجعلك هدفاً للمستذئبين\n• وثّق المعلومات التي تحصل عليها\n• اكشف عن معلوماتك في الوقت المناسب للمساعدة في إقصاء المستذئبين\n• راقب سلوك اللاعبين لتحديد من تريد الكشف عن هويته';
    
    case 'detective':
      return '• استخدم قدرتك للتحقق من الأشخاص المشكوك فيهم\n• ابحث عن الأشخاص الذين يتصرفون بشكل مريب\n• شارك المعلومات بحذر، حتى لا يتم استهدافك\n• تعاون مع العراف إذا استطعت تحديد هويته';
    
    case 'guardian':
      return '• حاول حماية الأدوار المهمة مثل العراف والمحقق إذا عرفتهم\n• غير الشخص الذي تحميه كل ليلة\n• لا تكشف عن هويتك مبكراً\n• في النهار، راقب من يبدو أنه يتعرض للاتهام وقد يكون هدفاً للمستذئبين';
    
    case 'sniper':
      return '• لا تستخدم طلقاتك بتسرع، فهي محدودة جداً\n• تأكد تماماً قبل استخدام أي طلقة\n• استمع للنقاشات جيداً قبل اتخاذ قرار\n• أحياناً، استخدام طلقة في اللحظة المناسبة يمكن أن يغير مسار اللعبة';
    
    case 'reviver':
      return '• انتظر قبل استخدام قدرتك على الإحياء\n• حاول إحياء لاعب ذو دور مهم\n• راقب من يموت وما كان دوره\n• قد يكون إحياء العراف أو المحقق قراراً حكيماً';
    
    case 'wizard':
      return '• استخدم الإكسير لحماية القرية في الليالي الخطرة\n• استخدم السم فقط عندما تكون متأكداً من هوية المستذئب\n• كن انتقائياً في استخدام قدراتك، فهي محدودة جداً\n• يمكن أن تكون قدراتك حاسمة في نهاية اللعبة';
    
    default:
      return 'كن استراتيجياً وراقب سلوك اللاعبين الآخرين بعناية.';
  }
}