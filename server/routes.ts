import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getGameManager } from "./discord/game/gameManager";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes for game management
  const apiRouter = express.Router();

  // Health check endpoint
  apiRouter.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Get active games
  apiRouter.get('/games', async (req, res) => {
    try {
      const games = await storage.getActiveGames();
      res.json(games);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch active games' });
    }
  });

  // Get game by ID
  apiRouter.get('/games/:id', async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      if (isNaN(gameId)) {
        return res.status(400).json({ error: 'Invalid game ID' });
      }

      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      res.json(game);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch game' });
    }
  });

  // Get players for a game
  apiRouter.get('/games/:id/players', async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      if (isNaN(gameId)) {
        return res.status(400).json({ error: 'Invalid game ID' });
      }

      const players = await storage.getGamePlayers(gameId);
      res.json(players);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch game players' });
    }
  });

  // Get game roles
  apiRouter.get('/games/:id/roles', async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      if (isNaN(gameId)) {
        return res.status(400).json({ error: 'Invalid game ID' });
      }

      const roles = await storage.getGameRoles(gameId);
      res.json(roles);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch game roles' });
    }
  });

  // Add route to get current game state
  apiRouter.get('/games/:id/state', async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      if (isNaN(gameId)) {
        return res.status(400).json({ error: 'Invalid game ID' });
      }

      const gameManager = getGameManager();
      const gameState = gameManager.getGameState(gameId);
      
      if (!gameState) {
        return res.status(404).json({ error: 'Game state not found' });
      }

      res.json({
        id: gameId,
        status: gameState.status,
        phase: gameState.phase,
        day: gameState.day,
        playersCount: gameState.players.size,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch game state' });
    }
  });

  app.use('/api', apiRouter);

  const httpServer = createServer(app);
  return httpServer;
}

import express from 'express';
