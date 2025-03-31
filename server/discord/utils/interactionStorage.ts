/**
 * وحدة تخزين التفاعلات
 * 
 * يتم استخدام هذا الملف لتخزين واسترجاع التفاعلات من Discord
 * بحيث يمكن استخدامها لاحقًا لإرسال متابعات للتفاعلات
 */

import { log } from '../../vite';
import { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';

// نوع التفاعل - إما تفاعل أمر أو تفاعل زر
type StoredInteraction = ButtonInteraction | ChatInputCommandInteraction;

// خريطة لتخزين التفاعلات حسب معرّف المستخدم
const interactionStorage: Map<string, StoredInteraction> = new Map();

// معلومات المستخدم في اللعبة
interface UserGameInfo {
  gameId: number;
  username: string;
  channelId: string;
}

// خريطة لتخزين معلومات المستخدمين حسب معرّف المستخدم
const userGameInfoStorage: Map<string, UserGameInfo> = new Map();

/**
 * تخزين تفاعل لاستخدامه لاحقًا
 * @param userId معرّف المستخدم
 * @param interaction التفاعل المراد تخزينه
 */
export function storeInteraction(userId: string, interaction: StoredInteraction): void {
  interactionStorage.set(userId, interaction);
  log(`تخزين التفاعل للمستخدم ${userId}`, 'interaction-storage');
}

/**
 * الحصول على تفاعل مخزن لمستخدم معين
 * @param userId معرّف المستخدم
 * @returns التفاعل المخزن، أو undefined إذا لم يوجد
 */
export function getStoredInteraction(userId: string): StoredInteraction | undefined {
  const interaction = interactionStorage.get(userId);
  if (interaction) {
    log(`تم استرجاع التفاعل للمستخدم ${userId}`, 'interaction-storage');
  } else {
    log(`لا يوجد تفاعل مخزن للمستخدم ${userId}`, 'interaction-storage');
  }
  return interaction;
}

/**
 * إزالة تفاعل مخزن لمستخدم معين
 * @param userId معرّف المستخدم
 * @returns true إذا تم العثور على التفاعل وحذفه، false إذا لم يتم العثور عليه
 */
export function removeStoredInteraction(userId: string): boolean {
  const hadInteraction = interactionStorage.has(userId);
  interactionStorage.delete(userId);
  
  if (hadInteraction) {
    log(`تم حذف التفاعل للمستخدم ${userId}`, 'interaction-storage');
    return true;
  }
  
  return false;
}

/**
 * حذف جميع التفاعلات المخزنة
 */
export function clearAllInteractions(): void {
  interactionStorage.clear();
  log('تم حذف جميع التفاعلات المخزنة', 'interaction-storage');
}

/**
 * تخزين معلومات مستخدم في لعبة
 * @param gameId معرّف اللعبة
 * @param userId معرّف المستخدم
 * @param username اسم المستخدم
 * @param channelId معرّف القناة
 */
export function storeUserForGame(gameId: number, userId: string, username: string, channelId: string): void {
  userGameInfoStorage.set(userId, {
    gameId,
    username,
    channelId
  });
  log(`تم تخزين معلومات المستخدم ${username} (${userId}) للعبة ${gameId}`, 'interaction-storage');
}

/**
 * الحصول على معلومات مستخدم مخزنة
 * @param userId معرّف المستخدم
 * @returns معلومات المستخدم، أو undefined إذا لم توجد
 */
export function getUserGameInfo(userId: string): UserGameInfo | undefined {
  return userGameInfoStorage.get(userId);
}

/**
 * حذف معلومات مستخدم
 * @param userId معرّف المستخدم
 * @returns true إذا تم العثور على المعلومات وحذفها، false إذا لم يتم العثور عليها
 */
export function removeUserGameInfo(userId: string): boolean {
  const hadInfo = userGameInfoStorage.has(userId);
  userGameInfoStorage.delete(userId);
  
  if (hadInfo) {
    log(`تم حذف معلومات المستخدم ${userId}`, 'interaction-storage');
    return true;
  }
  
  return false;
}

/**
 * حذف جميع معلومات المستخدمين المخزنة
 */
export function clearAllUserInfo(): void {
  userGameInfoStorage.clear();
  log('تم حذف جميع معلومات المستخدمين المخزنة', 'interaction-storage');
}