"use strict";

/**
 * db.js — Database connection and setup
 *
 * We use sql.js: a pure-JavaScript port of SQLite compiled to WebAssembly.
 * No native compilation needed — works on any OS without extra tools.
 *
 * The database is kept in memory while the server runs.
 * In production you would persist it to disk with fs.writeFileSync.
 *
 * sql.js API is intentionally close to the SQLite C API, so if you later
 * switch to better-sqlite3 or a hosted PostgreSQL, the SQL queries stay the same.
 */

const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "questions.db");

let db; // will be assigned after initSqlJs resolves

// ── Helper: wrap sql.js in a simpler interface ───────────────────────────────
// sql.js returns raw arrays; these helpers convert them to plain objects
// so the rest of the code can do row.sentence, row.answer, etc.

function rowsToObjects(result) {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

// Thin wrapper so routes can call db.prepare(...).all() like better-sqlite3
function makeDb(sqlJs) {
  // Load existing file or create a new in-memory DB
  const fileBuffer = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
  const raw = fileBuffer ? new sqlJs.Database(fileBuffer) : new sqlJs.Database();

  // While a transaction is open we must NOT call raw.export(): exporting
  // mid-transaction aborts it. So save() is deferred until COMMIT.
  let inTransaction = false;

  function save() {
    if (inTransaction) return; // the transaction's COMMIT will persist once
    fs.writeFileSync(DB_PATH, Buffer.from(raw.export()));
  }

  return {
    exec(sql) {
      raw.run(sql);
      save();
    },

    prepare(sql) {
      return {
        // Returns all matching rows as plain objects
        all(...params) {
          const result = raw.exec(sql, params);
          return rowsToObjects(result);
        },
        // Returns the first matching row as a plain object (or undefined)
        get(...params) {
          const result = raw.exec(sql, params);
          const rows = rowsToObjects(result);
          return rows[0];
        },
        // Runs INSERT / UPDATE / DELETE and returns { lastInsertRowid, changes }
        run(...params) {
          raw.run(sql, params);
          // Read these BEFORE save(): raw.export() resets last_insert_rowid()
          // and getRowsModified() back to 0.
          const result = {
            lastInsertRowid: raw.exec("SELECT last_insert_rowid()")[0]?.values[0][0],
            changes: raw.getRowsModified(),
          };
          save();
          return result;
        },
      };
    },

    // Wraps multiple operations in a transaction for atomicity
    transaction(fn) {
      return function (...args) {
        raw.run("BEGIN");
        inTransaction = true; // suppress per-statement save() until COMMIT
        try {
          fn(...args);
          raw.run("COMMIT");
          inTransaction = false;
          save(); // persist the whole transaction once
        } catch (err) {
          raw.run("ROLLBACK");
          inTransaction = false;
          throw err;
        }
      };
    },
  };
}

// ── Initialization (async because sql.js loads a WASM binary) ────────────────
// We export a promise so index.js can await the DB before starting the server.
const dbReady = initSqlJs().then((SqlJs) => {
  db = makeDb(SqlJs);

  // Create table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      sentence TEXT    NOT NULL,
      answer   TEXT    NOT NULL,
      category TEXT    NOT NULL,
      hint     TEXT    NOT NULL
    )
  `);

  // Scores table — one row per finished game.
  db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      player    TEXT    NOT NULL,
      score     INTEGER NOT NULL,
      correct   INTEGER NOT NULL,
      total     INTEGER NOT NULL,
      played_at TEXT    NOT NULL
    )
  `);

  // Seed only when the table is empty
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM questions").get();

  if (n === 0) {
    const insert = db.prepare(
      "INSERT INTO questions (sentence, answer, category, hint) VALUES (?, ?, ?, ?)"
    );

    const seedAll = db.transaction((rows) => {
      for (const row of rows) {
        insert.run(row.sentence, row.answer, row.category, row.hint);
      }
    });

    seedAll([
      // ── Time: IN ──
      { sentence: "Months",                    answer: "IN", category: "⏱ Tiempo", hint: "We are moving ___ May." },
      { sentence: "Years",                     answer: "IN", category: "⏱ Tiempo", hint: "They got married ___ 1975." },
      { sentence: "Centuries and decades",     answer: "IN", category: "⏱ Tiempo", hint: "Internet was invented ___ the 20th century." },
      { sentence: "Seasons",                   answer: "IN", category: "⏱ Tiempo", hint: "___ summer, we love having lunch in the garden." },
      { sentence: "Morning",                   answer: "IN", category: "⏱ Tiempo", hint: "I always have a shower ___ the morning." },
      { sentence: "Afternoon",                 answer: "IN", category: "⏱ Tiempo", hint: "We'll go to the cinema ___ the afternoon." },
      { sentence: "Evening",                   answer: "IN", category: "⏱ Tiempo", hint: "We usually meet ___ the evening." },
      // ── Place: IN ──
      { sentence: "Cities, countries, and continents",    answer: "IN", category: "📍 Lugar", hint: "People drive on the left ___ the UK." },
      { sentence: "Parts of a country, region, or city", answer: "IN", category: "📍 Lugar", hint: "The weather is wet ___ the north of Spain." },
      { sentence: "Car and taxi",                         answer: "IN", category: "📍 Lugar", hint: "Dad is waiting for you ___ the car." },
      { sentence: "Enclosed spaces or defined areas",     answer: "IN", category: "📍 Lugar", hint: "Your brother is ___ the kitchen." },
      // ── Time: ON ──
      { sentence: "Days of the week",          answer: "ON", category: "⏱ Tiempo", hint: "___ Wednesdays we wear pink." },
      { sentence: "Specific dates",            answer: "ON", category: "⏱ Tiempo", hint: "Her birthday party is ___ September 4th." },
      { sentence: "Part of a specific day",    answer: "ON", category: "⏱ Tiempo", hint: "___ Tuesday mornings I go to the gym." },
      { sentence: "Special days with 'day'",   answer: "ON", category: "⏱ Tiempo", hint: "The family gets together ___ Christmas Day." },
      // ── Place: ON ──
      { sentence: "Streets",                              answer: "ON", category: "📍 Lugar", hint: "The shop is ___ Victoria Street." },
      { sentence: "Parts of a room",                      answer: "ON", category: "📍 Lugar", hint: "Your dirty clothes are ___ the floor." },
      { sentence: "Floors of a building",                 answer: "ON", category: "📍 Lugar", hint: "I live ___ the 2nd floor." },
      { sentence: "Transportation (except car and taxi)", answer: "ON", category: "📍 Lugar", hint: "They served terrible food ___ the plane." },
      // ── Time: AT ──
      { sentence: "Clock times",                          answer: "AT", category: "⏱ Tiempo", hint: "Lessons start ___ 8:30." },
      { sentence: "Meal times",                           answer: "AT", category: "⏱ Tiempo", hint: "Let's meet ___ lunchtime." },
      { sentence: "Weekend",                              answer: "AT", category: "⏱ Tiempo", hint: "He will be working ___ the weekend." },
      { sentence: "Special holidays without 'day'",       answer: "AT", category: "⏱ Tiempo", hint: "We'll be in Spain ___ Christmas." },
      { sentence: "Specific parts of the day",            answer: "AT", category: "⏱ Tiempo", hint: "Owls go hunting ___ night." },
      // ── Place: AT ──
      { sentence: "Addresses",                            answer: "AT", category: "📍 Lugar", hint: "Sherlock Holmes lives ___ 221B Baker Street." },
      { sentence: "Specific places in a town or city",    answer: "AT", category: "📍 Lugar", hint: "She studies ___ Oxford University." },
      { sentence: "Home",                                 answer: "AT", category: "📍 Lugar", hint: "I'm ___ home waiting for the delivery man." },
    ]);

    console.log("✅ Database seeded with questions.");
  }

  return db;
});

module.exports = { dbReady };
