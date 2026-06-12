"use strict";

/**
 * routes/questions.js — All endpoints related to questions
 *
 * A "route" = URL path + HTTP method + what to do when called.
 * Exported as a factory function that receives `db` as argument,
 * so the database is available in every handler.
 *
 * HTTP methods used:
 *   GET    → read data      (safe, can be called many times)
 *   POST   → create data    (sends a body with the new item)
 *   DELETE → delete data    (identifies the item via :id in the URL)
 */

const express = require("express");

module.exports = function questionsRouter(db) {
  const router = express.Router();

  // ── GET /api/questions ──────────────────────────────────────────────────────
  // Returns ALL questions as a JSON array.
  router.get("/", (req, res) => {
    try {
      const questions = db.prepare("SELECT * FROM questions").all();
      res.json(questions);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load questions." });
    }
  });

  // ── GET /api/questions/:id ──────────────────────────────────────────────────
  // Returns ONE question by its numeric id.
  // :id is a URL parameter — e.g. GET /api/questions/3
  router.get("/:id", (req, res) => {
    try {
      const question = db
        .prepare("SELECT * FROM questions WHERE id = ?")
        .get(req.params.id);

      if (!question) {
        return res.status(404).json({ error: "Question not found." });
      }

      res.json(question);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load question." });
    }
  });

  // ── POST /api/questions ─────────────────────────────────────────────────────
  // Creates a new question. Body must include: sentence, answer, category, hint
  router.post("/", (req, res) => {
    const { sentence, answer, category, hint } = req.body;

    if (!sentence || !answer || !category || !hint) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (!["IN", "ON", "AT"].includes(answer)) {
      return res.status(400).json({ error: "answer must be IN, ON, or AT." });
    }

    try {
      const result = db
        .prepare(
          "INSERT INTO questions (sentence, answer, category, hint) VALUES (?, ?, ?, ?)"
        )
        .run(sentence, answer, category, hint);

      // 201 Created = success, a new resource was made
      res.status(201).json({
        id: result.lastInsertRowid,
        sentence,
        answer,
        category,
        hint,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create question." });
    }
  });

  // ── DELETE /api/questions/:id ───────────────────────────────────────────────
  // Deletes a question by id.
  router.delete("/:id", (req, res) => {
    try {
      const result = db
        .prepare("DELETE FROM questions WHERE id = ?")
        .run(req.params.id);

      if (result.changes === 0) {
        return res.status(404).json({ error: "Question not found." });
      }

      res.json({ message: "Question deleted." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete question." });
    }
  });

  return router;
};
