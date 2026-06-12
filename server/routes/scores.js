"use strict";

/**
 * routes/scores.js — Endpoints for saving and reading game scores
 *
 * Same factory pattern as questions.js: receives `db` and returns a router.
 *
 *   POST /api/scores       → save a finished game (body: player, score, correct, total)
 *   GET  /api/scores       → leaderboard: top 10 scores, highest first
 */

const express = require("express");

module.exports = function scoresRouter(db) {
  const router = express.Router();

  // ── GET /api/scores ─────────────────────────────────────────────────────────
  // Returns the top 10 scores, highest first (the leaderboard).
  router.get("/", (req, res) => {
    try {
      const scores = db
        .prepare(
          "SELECT player, score, correct, total, played_at FROM scores ORDER BY score DESC, played_at ASC LIMIT 10"
        )
        .all();
      res.json(scores);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load scores." });
    }
  });

  // ── POST /api/scores ────────────────────────────────────────────────────────
  // Saves one finished game. Body: { player, score, correct, total }
  router.post("/", (req, res) => {
    let { player, score, correct, total } = req.body;

    // Validation: player name required, numbers must be valid.
    player = typeof player === "string" ? player.trim() : "";
    if (!player) {
      return res.status(400).json({ error: "Player name is required." });
    }
    if (player.length > 20) {
      player = player.slice(0, 20);
    }
    if (
      !Number.isInteger(score) ||
      !Number.isInteger(correct) ||
      !Number.isInteger(total) ||
      score < 0 ||
      correct < 0 ||
      total <= 0
    ) {
      return res.status(400).json({ error: "Invalid score values." });
    }

    try {
      const playedAt = new Date().toISOString();
      const result = db
        .prepare(
          "INSERT INTO scores (player, score, correct, total, played_at) VALUES (?, ?, ?, ?, ?)"
        )
        .run(player, score, correct, total, playedAt);

      res.status(201).json({
        id: result.lastInsertRowid,
        player,
        score,
        correct,
        total,
        played_at: playedAt,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save score." });
    }
  });

  return router;
};
