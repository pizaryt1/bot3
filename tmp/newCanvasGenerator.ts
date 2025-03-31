import path from 'path';
import { createCanvas, loadImage, Canvas, Image } from 'canvas';
import { RoleType } from '../../../shared/schema';
import { log } from '../../vite';
import { getRoleDisplayName, getRoleEmoji } from '../components/roleConfigView';

function drawRoundedRect(ctx: any, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export async function createRolesDistributionCanvas(roles: RoleType[]): Promise<Buffer> {
  try {
    // Increased width for better layout
    const canvas = createCanvas(900, 600);
    const ctx = canvas.getContext('2d');
    const ASSETS_PATH = path.join(__dirname, '../../../attached_assets');
    
    try {
      // استخدام صورة خلفية مشابهة للصورة المرجعية
      const background = await loadImage(path.join(ASSETS_PATH, 'توزيع الادوار.png'));
      ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    } catch (error) {
      // Fallback to gradient if image fails to load
      log(`Failed to load background image: ${error}`, 'canvas');
      
      // Create a dark gradient background as fallback
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#1E2124');
      gradient.addColorStop(1, '#36393F');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add moon-like glow for night atmosphere
      const moonGlow = ctx.createRadialGradient(
        canvas.width/2, 200, 50,
        canvas.width/2, 200, 300
      );
      moonGlow.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      moonGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(canvas.width/2, 200, 300, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // إضافة طبقة داكنة شفافة فوق الصورة لتسهيل قراءة النص (أخف مما كانت عليه)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // إضافة خط فاصل بين القسمين (كما في الصورة المرسلة)
    ctx.beginPath();
    ctx.moveTo(canvas.width/2, 110);
    ctx.lineTo(canvas.width/2, canvas.height - 60);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // إضافة خطوط أفقية كما في الصورة
    // خط أسفل العنوان
    ctx.beginPath();
    ctx.moveTo(150, 100);
    ctx.lineTo(canvas.width - 150, 100);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // خط أسفل الكل
    ctx.beginPath();
    ctx.moveTo(150, canvas.height - 60);
    ctx.lineTo(canvas.width - 150, canvas.height - 60);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // عنوان الصورة بنفس خط الصورة المرسلة
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    // استخدام خط "Amiri" كما في الصورة
    ctx.font = 'bold 55px "Amiri", sans-serif';
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
        
        tempCtx.font = '35px Arial';
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
    
    // Draw section titles with improved font for better Arabic support
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.font = 'bold 40px "Amiri", sans-serif';
    
    // Village side - green color as in the reference image
    ctx.fillStyle = '#57F287'; // Green color
    ctx.textAlign = 'center';
    ctx.fillText('أدوار القرية', canvas.width / 4, 150);
    
    // Werewolf side - red color as in the reference image
    ctx.fillStyle = '#ED4245'; // Red color
    ctx.textAlign = 'center';
    ctx.fillText('أدوار المستذئبين', (canvas.width / 4) * 3, 150);
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Draw roles with improved sizing and padding - smaller size to match reference image
    const roleSize = 80; // حجم الأيقونات مشابه للصورة المرجعية
    const padding = 60; // زيادة التباعد بين الأيقونات
    const textPadding = 40; // المساحة للنص تحت الأيقونة
    
    // Draw village roles with improved positioning
    for (let i = 0; i < villageRoles.length; i++) {
      const role = villageRoles[i];
      const row = Math.floor(i / 3);
      const col = i % 3;
      const x = 110 + col * (roleSize + padding);
      const y = 200 + row * (roleSize + textPadding);
      
      // Draw role background - circular green glow as in reference image
      const gradient = ctx.createRadialGradient(
        x + roleSize / 2, y + roleSize / 2, roleSize / 2 - 5,
        x + roleSize / 2, y + roleSize / 2, roleSize / 2 + 5
      );
      gradient.addColorStop(0, 'rgba(87, 242, 135, 0.8)'); // more visible green for village roles
      gradient.addColorStop(1, 'rgba(87, 242, 135, 0.2)');
      
      ctx.beginPath();
      ctx.arc(x + roleSize / 2, y + roleSize / 2, roleSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Draw role icon
      const icon = await getRoleIcon(role);
      ctx.drawImage(icon, x, y, roleSize, roleSize);
      
      // Draw role name with styling matching the reference image
      ctx.font = 'bold 24px "Amiri", sans-serif';
      
      // Add shadow/glow for better visibility
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(getRoleDisplayName(role), x + roleSize / 2, y + roleSize + 26);
      ctx.shadowBlur = 0; // Reset shadow
    }
    
    // Draw werewolf roles with improved positioning - use red glow
    for (let i = 0; i < werewolfRoles.length; i++) {
      const role = werewolfRoles[i];
      const row = Math.floor(i / 3);
      const col = i % 3;
      const x = canvas.width / 2 + 110 + col * (roleSize + padding);
      const y = 200 + row * (roleSize + textPadding);
      
      // Draw role background - circular red glow as in reference image
      const gradient = ctx.createRadialGradient(
        x + roleSize / 2, y + roleSize / 2, roleSize / 2 - 5,
        x + roleSize / 2, y + roleSize / 2, roleSize / 2 + 5
      );
      gradient.addColorStop(0, 'rgba(237, 66, 69, 0.8)'); // more visible red for werewolf roles
      gradient.addColorStop(1, 'rgba(237, 66, 69, 0.2)');
      
      ctx.beginPath();
      ctx.arc(x + roleSize / 2, y + roleSize / 2, roleSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Draw role icon
      const icon = await getRoleIcon(role);
      ctx.drawImage(icon, x, y, roleSize, roleSize);
      
      // Draw role name with styling matching the reference image
      ctx.font = 'bold 24px "Amiri", sans-serif';
      
      // Add shadow/glow for better visibility
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(getRoleDisplayName(role), x + roleSize / 2, y + roleSize + 26);
      ctx.shadowBlur = 0; // Reset shadow
    }
    
    // Add message at bottom about role distribution - similar to reference image
    ctx.font = 'bold 24px "Amiri", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('ستصلك رسالة خاصة بدورك خلال لحظات', canvas.width / 2, canvas.height - 30);
    
    // Convert canvas to buffer and return
    return canvas.toBuffer();
  } catch (error) {
    log(`Error creating roles distribution canvas: ${error}`, 'canvas');
    // Return a simple error canvas
    const errorCanvas = createCanvas(800, 400);
    const ctx = errorCanvas.getContext('2d');
    ctx.fillStyle = '#36393F';
    ctx.fillRect(0, 0, errorCanvas.width, errorCanvas.height);
    ctx.font = 'bold 28px "Amiri", sans-serif';
    ctx.fillStyle = '#ED4245';
    ctx.textAlign = 'center';
    ctx.fillText('حدث خطأ أثناء إنشاء صورة توزيع الأدوار', errorCanvas.width / 2, errorCanvas.height / 2);
    return errorCanvas.toBuffer();
  }
}

async function createSimpleRolesCanvas(roles: RoleType[]): Promise<Buffer> {
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext('2d');
  
  // Set background
  ctx.fillStyle = '#36393F';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw title
  ctx.font = 'bold 40px "Amiri", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText('توزيع الأدوار', canvas.width / 2, 60);
  
  // Draw roles
  const roleSize = 60;
  const padding = 20;
  const cols = 5;
  
  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = 100 + col * (roleSize + padding);
    const y = 100 + row * (roleSize + padding + 30);
    
    // Draw role circle
    ctx.beginPath();
    ctx.arc(x + roleSize / 2, y + roleSize / 2, roleSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = getRoleColor(role);
    ctx.fill();
    
    // Draw role emoji
    ctx.font = '35px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(getRoleEmoji(role), x + roleSize / 2, y + roleSize / 2 + 12);
    
    // Draw role name
    ctx.font = '18px "Amiri", sans-serif';
    ctx.fillText(getRoleDisplayName(role), x + roleSize / 2, y + roleSize + 20);
  }
  
  // Draw footer
  ctx.font = '18px "Amiri", sans-serif';
  ctx.fillText('سيتم إرسال رسائل خاصة لكل لاعب بدوره', canvas.width / 2, canvas.height - 30);
  
  return canvas.toBuffer();
}

function getRoleColor(role: RoleType): string {
  switch (role) {
    case 'werewolf':
    case 'werewolfLeader':
      return '#ED4245'; // Red
    case 'villager':
      return '#5865F2'; // Blue
    case 'seer':
      return '#9B59B6'; // Purple
    case 'guardian':
      return '#57F287'; // Green
    case 'detective':
      return '#FAA61A'; // Orange
    case 'reviver':
      return '#00B8D4'; // Cyan
    case 'sniper':
      return '#F1C40F'; // Yellow
    case 'wizard':
      return '#E91E63'; // Pink
    default:
      return '#99AAB5'; // Grey
  }
}
