import { Canvas, createCanvas, loadImage, Image, registerFont } from 'canvas';
import { RoleType } from '@shared/schema';
import { getRoleEmoji, getRoleDisplayName } from '../components/roleConfigView';
import { log } from '../../vite';
import path from 'path';
import fs from 'fs';

// استخدام خطوط عربية متعددة مع تحسين المظهر العام
try {
  // قائمة بالخطوط العربية المدعومة
  const arabicFonts = [
    { path: path.join(process.cwd(), 'fonts', 'ArabicGame.ttf'), family: 'ArabicGameFont' },
    { path: path.join(process.cwd(), 'fonts', 'ArabicGame-Bold.ttf'), family: 'ArabicGameFont', weight: 'bold' },
    { path: '/app/fonts/Amiri-Regular.ttf', family: 'Amiri' },
    { path: '/app/fonts/Amiri-Bold.ttf', family: 'Amiri', weight: 'bold' },
    { path: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', family: 'DejaVuSans' },
    { path: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', family: 'DejaVuSans', weight: 'bold' }
  ];

  // محاولة تسجيل الخطوط المتوفرة
  let registeredCount = 0;
  
  for (const font of arabicFonts) {
    if (fs.existsSync(font.path)) {
      registerFont(font.path, { family: font.family, weight: font.weight || 'normal' });
      registeredCount++;
      log(`تم تسجيل الخط: ${font.family} ${font.weight || 'normal'}`, 'canvas');
    }
  }
  
  if (registeredCount === 0) {
    log('لم يتم العثور على أي خطوط عربية مدعومة. سيتم استخدام الخطوط الافتراضية.', 'canvas');
  } else {
    log(`تم تسجيل ${registeredCount} خطوط بنجاح`, 'canvas');
  }
} catch (error) {
  log(`حدث خطأ أثناء تسجيل الخطوط: ${error}`, 'canvas');
}

// Path to role icons and background
const ASSETS_PATH = path.join(process.cwd(), 'attached_assets');

// Helper function to draw rounded rectangle since it might not be supported in all Canvas versions
function drawRoundedRect(ctx: any, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arc(x + width - radius, y + radius, radius, 1.5 * Math.PI, 0);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arc(x + width - radius, y + height - radius, radius, 0, 0.5 * Math.PI);
  ctx.lineTo(x + radius, y + height);
  ctx.arc(x + radius, y + height - radius, radius, 0.5 * Math.PI, Math.PI);
  ctx.lineTo(x, y + radius);
  ctx.arc(x + radius, y + radius, radius, Math.PI, 1.5 * Math.PI);
  ctx.closePath();
}

// Create a canvas for the roles distribution image
export async function createRolesDistributionCanvas(roles: RoleType[]): Promise<Buffer> {
  try {
    // Create canvas
    const canvas = createCanvas(1000, 700);
    const ctx = canvas.getContext('2d');
    
    // استخدام الصورة الخلفية المخصصة
    try {
      // تحميل صورة الخلفية المطلوبة
      const backgroundImage = await loadImage(path.join(ASSETS_PATH, 'توزيع الادوار.png'));
      // رسم الصورة بكامل حجم الكانفاس
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    } catch (error) {
      // في حالة فشل تحميل الصورة، نستخدم الخلفية البديلة
      log(`Failed to load background image: ${error}. Using gradient background instead.`, 'canvas');
      
      // Background gradient as fallback
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#0f2027');
      gradient.addColorStop(0.5, '#203a43');
      gradient.addColorStop(1, '#2c5364');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // إضافة تأثير النجوم على الخلفية
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 200; i++) {
        const size = Math.random() * 3;
        ctx.beginPath();
        ctx.arc(
          Math.random() * canvas.width,
          Math.random() * canvas.height,
          size,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = Math.random() > 0.7 ? '#A7D8FF' : '#FFFFFF';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    
    // إضافة طبقة داكنة شفافة فوق الصورة لتسهيل قراءة النص
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // إضافة هالة فوق الصورة لمزيد من الجاذبية
    const glow = ctx.createRadialGradient(
      canvas.width/2, 100, 50,
      canvas.width/2, 100, 400
    );
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // إضافة خط فاصل جميل بين القسمين
    ctx.beginPath();
    ctx.moveTo(canvas.width/2, 110);
    ctx.lineTo(canvas.width/2, canvas.height - 60);
    
    // جعل الخط الفاصل أكثر جاذبية (متدرج)
    const lineGradient = ctx.createLinearGradient(0, 110, 0, canvas.height - 60);
    lineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    lineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    lineGradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
    ctx.strokeStyle = lineGradient;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // إضافة خط أسفل العنوان
    ctx.beginPath();
    ctx.moveTo(250, 110);
    ctx.lineTo(canvas.width - 250, 110);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // عنوان أكثر جاذبية
    // إضافة ظل للنص لتحسين القراءة
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // استخدام الخط العربي المحسن مع تغيير ترتيب الخطوط لضمان دعم أفضل للغة العربية
    ctx.font = 'bold 55px "ArabicGameFont", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('توزيع الأدوار', canvas.width / 2, 70);
    
    // إعادة تعيين الظل
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Cache for role icons
    const roleIconCache: Record<string, Image> = {};
    
    // Helper function to load role icon
    const getRoleIcon = async (role: RoleType): Promise<Image> => {
      if (roleIconCache[role]) {
        return roleIconCache[role];
      }
      
      try {
        const iconPath = path.join(ASSETS_PATH, `رمز ${getRoleDisplayName(role)}.png`);
        const icon = await loadImage(iconPath);
        roleIconCache[role] = icon;
        return icon;
      } catch (error) {
        log(`Failed to load icon for ${role}, using fallback: ${error}`, 'canvas');
        // If icon fails to load, create a colored circle with emoji
        const tempCanvas = createCanvas(80, 80);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.beginPath();
        tempCtx.arc(40, 40, 35, 0, Math.PI * 2);
        tempCtx.fillStyle = getRoleColor(role);
        tempCtx.fill();
        
        tempCtx.font = '35px "ArabicGameFont", sans-serif';
        tempCtx.fillStyle = '#FFFFFF';
        tempCtx.textAlign = 'center';
        tempCtx.fillText(getRoleEmoji(role), 40, 52);
        
        roleIconCache[role] = tempCanvas as unknown as Image;
        return roleIconCache[role];
      }
    };
    
    // Separate roles into villagers and werewolves
    const villageRoles: RoleType[] = [];
    const werewolfRoles: RoleType[] = [];
    
    roles.forEach(role => {
      if (role === 'werewolf' || role === 'werewolfLeader') {
        werewolfRoles.push(role);
      } else {
        villageRoles.push(role);
      }
    });
    
    // Draw section titles with improved font - adding more font options for better Arabic support
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.font = 'bold 45px "ArabicGameFont", sans-serif';
    
    // Village side
    ctx.fillStyle = '#57F287';
    ctx.textAlign = 'center';
    ctx.fillText('أدوار القرية', canvas.width / 4, 150);
    
    // Werewolf side
    ctx.fillStyle = '#ED4245';
    ctx.textAlign = 'center';
    ctx.fillText('أدوار المستذئبين', (canvas.width / 4) * 3, 150);
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Draw roles with improved sizing and padding
    const roleSize = 90; // تصغير حجم الأيقونات قليلاً
    const padding = 50; // زيادة التباعد بين الأيقونات
    const textPadding = 50; // المساحة للنص تحت الأيقونة
    
    // Draw village roles with improved positioning
    for (let i = 0; i < villageRoles.length; i++) {
      const role = villageRoles[i];
      const row = Math.floor(i / 3);
      const col = i % 3;
      const x = 110 + col * (roleSize + padding);
      const y = 200 + row * (roleSize + textPadding);
      
      // Draw nice role background with glow effect
      // Outer glow
      const roleColor = getRoleColor(role);
      const glowRadius = roleSize / 2 + 15;
      const gradient = ctx.createRadialGradient(
        x + roleSize / 2, y + roleSize / 2, roleSize / 2,
        x + roleSize / 2, y + roleSize / 2, glowRadius
      );
      gradient.addColorStop(0, 'rgba(87, 242, 135, 0.3)');
      gradient.addColorStop(1, 'rgba(87, 242, 135, 0)');
      
      ctx.beginPath();
      ctx.arc(x + roleSize / 2, y + roleSize / 2, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Inner circle (clean background for icon)
      ctx.beginPath();
      ctx.arc(x + roleSize / 2, y + roleSize / 2, roleSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();
      
      // Add decorative ring
      ctx.beginPath();
      ctx.arc(x + roleSize / 2, y + roleSize / 2, roleSize / 2 + 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(87, 242, 135, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw role icon with slight adjustment for better appearance
      const icon = await getRoleIcon(role);
      ctx.drawImage(icon, x, y, roleSize, roleSize);
      
      // Draw nice text background for better readability
      const textWidth = getRoleDisplayName(role).length * 11;
      const textHeight = 30;
      const textX = x + roleSize / 2 - textWidth / 2;
      const textY = y + roleSize + 5;
      
      // Draw a semi-transparent background for text
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      drawRoundedRect(ctx, textX, textY, textWidth, textHeight, 10);
      ctx.fill();
      
      // Draw role name with better styling - using fonts with better Arabic support first
      ctx.font = 'bold 24px "ArabicGameFont", sans-serif';
      
      // Draw text with glow effect
      ctx.shadowColor = 'rgba(87, 242, 135, 0.7)';
      ctx.shadowBlur = 5;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(getRoleDisplayName(role), x + roleSize / 2, y + roleSize + 26);
      ctx.shadowBlur = 0; // Reset shadow
    }
    
    // Draw werewolf roles with improved positioning
    for (let i = 0; i < werewolfRoles.length; i++) {
      const role = werewolfRoles[i];
      const row = Math.floor(i / 2);
      const col = i % 2;
      const x = canvas.width / 2 + 110 + col * (roleSize + padding);
      const y = 200 + row * (roleSize + textPadding);
      
      // Draw nice role background with glow effect
      // Outer glow
      const roleColor = getRoleColor(role);
      const glowRadius = roleSize / 2 + 15;
      const gradient = ctx.createRadialGradient(
        x + roleSize / 2, y + roleSize / 2, roleSize / 2,
        x + roleSize / 2, y + roleSize / 2, glowRadius
      );
      gradient.addColorStop(0, 'rgba(237, 66, 69, 0.3)');
      gradient.addColorStop(1, 'rgba(237, 66, 69, 0)');
      
      ctx.beginPath();
      ctx.arc(x + roleSize / 2, y + roleSize / 2, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Inner circle (clean background for icon)
      ctx.beginPath();
      ctx.arc(x + roleSize / 2, y + roleSize / 2, roleSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();
      
      // Add decorative ring
      ctx.beginPath();
      ctx.arc(x + roleSize / 2, y + roleSize / 2, roleSize / 2 + 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(237, 66, 69, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw role icon with slight adjustment for better appearance
      const icon = await getRoleIcon(role);
      ctx.drawImage(icon, x, y, roleSize, roleSize);
      
      // Draw nice text background for better readability
      const textWidth = getRoleDisplayName(role).length * 11;
      const textHeight = 30;
      const textX = x + roleSize / 2 - textWidth / 2;
      const textY = y + roleSize + 5;
      
      // Draw a semi-transparent background for text
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      drawRoundedRect(ctx, textX, textY, textWidth, textHeight, 10);
      ctx.fill();
      
      // Draw role name with better styling - using fonts with better Arabic support first
      ctx.font = 'bold 24px "ArabicGameFont", sans-serif';
      
      // Draw text with glow effect
      ctx.shadowColor = 'rgba(237, 66, 69, 0.7)';
      ctx.shadowBlur = 5;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(getRoleDisplayName(role), x + roleSize / 2, y + roleSize + 26);
      ctx.shadowBlur = 0; // Reset shadow
    }
    
    // Footer with improved styling
    // Add decorative line before footer
    ctx.beginPath();
    ctx.moveTo(150, canvas.height - 60);
    ctx.lineTo(canvas.width - 150, canvas.height - 60);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Added shadow for footer text
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // Nicer font and size using Amiri as requested
    ctx.font = 'bold 28px "ArabicGameFont", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('ستصلك رسالة خاصة بدورك خلال لحظات', canvas.width / 2, canvas.height - 30);
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Convert canvas to buffer
    return canvas.toBuffer('image/png');
  } catch (error) {
    log(`Error creating roles distribution canvas: ${error}`, 'canvas');
    // Fallback to simple canvas
    return createSimpleRolesCanvas(roles);
  }
}

// Fallback simple canvas if the main one fails
async function createSimpleRolesCanvas(roles: RoleType[]): Promise<Buffer> {
  // Create canvas
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#2E1A47';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Title - using Amiri font as requested
  ctx.font = 'bold 40px "ArabicGameFont", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText('توزيع الأدوار', canvas.width / 2, 60);
  
  // Draw roles
  const roleSize = 70;
  const padding = 20;
  const startX = (canvas.width - (Math.min(roles.length, 5) * (roleSize + padding))) / 2;
  const startY = 120;
  
  // Draw each role
  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    const row = Math.floor(i / 5);
    const col = i % 5;
    const x = startX + col * (roleSize + padding);
    const y = startY + row * (roleSize + padding + 40);
    
    // Draw role circle
    ctx.beginPath();
    ctx.arc(x + roleSize / 2, y + roleSize / 2, roleSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = getRoleColor(role);
    ctx.fill();
    
    // Draw role emoji
    ctx.font = '35px "ArabicGameFont", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(getRoleEmoji(role), x + roleSize / 2, y + roleSize / 2 + 12);
    
    // Draw role name with Amiri font as requested
    ctx.font = '18px "ArabicGameFont", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(getRoleDisplayName(role), x + roleSize / 2, y + roleSize + 30);
  }
  
  // Footer with Amiri font as requested
  ctx.font = '18px "ArabicGameFont", sans-serif';
  ctx.fillStyle = '#B9BBBE';
  ctx.textAlign = 'center';
  ctx.fillText('ستصلك رسالة خاصة بدورك خلال لحظات', canvas.width / 2, canvas.height - 40);
  
  // Convert canvas to buffer
  return canvas.toBuffer('image/png');
}

// Get color for role
function getRoleColor(role: RoleType): string {
  switch (role) {
    case 'villager': return '#57F287'; // Green
    case 'werewolf': return '#ED4245'; // Red
    case 'werewolfLeader': return '#8B0000'; // Dark Red
    case 'seer': return '#5865F2'; // Blue
    case 'detective': return '#FEE75C'; // Yellow
    case 'guardian': return '#57F287'; // Green
    case 'sniper': return '#FF7B1C'; // Orange
    case 'reviver': return '#57F287'; // Green
    case 'wizard': return '#9B59B6'; // Purple
    default: return '#95A5A6'; // Gray
  }
}