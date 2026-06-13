"use strict";

/**
 * routes/scores.js — Endpoints for saving and reading game scores
 *
 *   POST /api/scores           → save a finished game (body: player, score, correct, total, exercise)
 *   GET  /api/scores           → global leaderboard: top 10 across all exercises
 *   GET  /api/scores?exercise= → leaderboard for a specific exercise (empty string = untagged)
 */

const express = require("express");

module.exports = function scoresRouter(db) {
  const router = express.Router();

  // ── GET /api/scores ─────────────────────────────────────────────────────────
  router.get("/", (req, res) => {
    try {
      let scores;
      if ("exercise" in req.query) {
        // Exercise-specific: filter to a single exercise (can be empty string for legacy rows)
        const exercise = typeof req.query.exercise === "string" ? req.query.exercise : "";
        scores = db
          .prepare(
            "SELECT player, score, correct, total, played_at, exercise FROM scores WHERE exercise = ? ORDER BY score DESC, played_at ASC LIMIT 10"
          )
          .all(exercise);
      } else {
        // Global: all exercises combined
        scores = db
          .prepare(
            "SELECT player, score, correct, total, played_at, exercise FROM scores ORDER BY score DESC, played_at ASC LIMIT 10"
          )
          .all();
      }
      res.json(scores);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load scores." });
    }
  });

  // ── POST /api/scores ────────────────────────────────────────────────────────
  // Saves one finished game. Body: { player, score, correct, total, exercise }
  router.post("/", (req, res) => {
    let { player, score, correct, total, exercise } = req.body;

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

    exercise = typeof exercise === "string" ? exercise.trim() : "";

    try {
      const playedAt = new Date().toISOString();
      const result = db
        .prepare(
          "INSERT INTO scores (player, score, correct, total, played_at, exercise) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run(player, score, correct, total, playedAt, exercise);

      res.status(201).json({
        id: result.lastInsertRowid,
        player,
        score,
        correct,
        total,
        played_at: playedAt,
        exercise,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save score." });
    }
  });

  return router;
};
