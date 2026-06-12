"use strict";

/**
 * index.js — Entry point of the Express server
 *
 * Flow:
 *  1. Wait for the database to be ready (sql.js loads a WASM binary — takes ~1 second)
 *  2. Create the Express app with global middleware
 *  3. Mount route files
 *  4. Start listening for requests
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const { dbReady } = require("./db");

// The frontend lives one level up from /server (project root).
const PUBLIC_DIR = path.join(__dirname, "..");

const PORT = process.env.PORT || 3000;

// We wait for the DB before creating routes so that every request
// handler can safely use `db` without it being undefined.
dbReady.then((db) => {
  const app = express();

  // ── Middleware ──────────────────────────────────────────────────────────────
  // CORS: allows the browser on a different origin (e.g. GitHub Pages)
  // to call this API. Without this the browser blocks the request.
  app.use(cors());

  // JSON parser: parses req.body when the client sends JSON.
  app.use(express.json());

  // ── Routes ──────────────────────────────────────────────────────────────────
  // We pass `db` into the router factory so each route handler can use it.
  const questionsRouter = require("./routes/questions")(db);
  app.use("/api/questions", questionsRouter);

  const scoresRouter = require("./routes/scores")(db);
  app.use("/api/scores", scoresRouter);

  // Health-check — useful for deployment platforms and uptime monitors.
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // ── Static frontend ─────────────────────────────────────────────────────────
  // Serve the HTML/CSS/JS so opening http://localhost:3000 shows the game
  // itself (and the API stays on the same origin → no CORS needed).
  app.use(express.static(PUBLIC_DIR));

  // ── Start ───────────────────────────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`   Game          → http://localhost:${PORT}/`);
    console.log(`   Questions API → http://localhost:${PORT}/api/questions`);
    console.log(`   Scores API    → http://localhost:${PORT}/api/scores`);
  });
}).catch((err) => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});
