import { pgTable, text, serial, integer, boolean, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Base user schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Game related schemas
export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  ownerId: text("owner_id").notNull(),
  status: text("status").notNull().default("setup"), // setup, configuring, running, ended
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  settings: json("settings"),
});

export const gamePlayers = pgTable("game_players", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  role: text("role"),
  isAlive: boolean("is_alive").notNull().default(true),
  interactionId: text("interaction_id"),
});

export const gameRoles = pgTable("game_roles", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull(),
  roleName: text("role_name").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  isBasic: boolean("is_basic").notNull().default(false),
});

// Define role types
export const RoleType = z.enum([
  "villager", // القروي
  "werewolf", // المستذئب
  "werewolfLeader", // زعيم المستذئبين
  "seer", // العراف
  "detective", // المحقق
  "guardian", // الحارس
  "sniper", // القناص
  "reviver", // المنعش
  "wizard", // الساحر
]);

export type RoleType = z.infer<typeof RoleType>;

export type GameStatus = "setup" | "configuring" | "running" | "ended";

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Game = typeof games.$inferSelect;
export type GamePlayer = typeof gamePlayers.$inferSelect;
export type GameRole = typeof gameRoles.$inferSelect;

// Game settings type
export interface GameSettings {
  countdownDuration: number;
  roles: {
    [key in RoleType]?: {
      enabled: boolean;
      count: number;
      isBasic: boolean;
    }
  };
}
