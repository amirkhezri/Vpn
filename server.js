const express = require("express");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// =======================
// PostgreSQL اتصال
// =======================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// =======================
// ساخت جدول صحیح
// =======================

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id BIGINT PRIMARY KEY,
      username TEXT,
      photo_url TEXT,
      referral_count INT DEFAULT 0,
      trial_count INT DEFAULT 0,
      trial_expiry TIMESTAMP,
      subscription_expiry TIMESTAMP
    );
  `);

  console.log("DB ready");
}

initDB();

// =======================
// گرفتن یا ساخت کاربر
// =======================

app.get("/api/user/:telegramId", async (req, res) => {
  try {
    const telegramId = req.params.telegramId;

    let user = await pool.query(
      "SELECT * FROM users WHERE telegram_id=$1",
      [telegramId]
    );

    if (!user.rows.length) {
      await pool.query(
        "INSERT INTO users (telegram_id) VALUES ($1)",
        [telegramId]
      );

      user = await pool.query(
        "SELECT * FROM users WHERE telegram_id=$1",
        [telegramId]
      );
    }

    res.json({
      success: true,
      user: user.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// =======================
// Trial Activation
// =======================

app.post("/api/activate-trial", async (req, res) => {
  try {
    const { telegram_id } = req.body;

    const trialDays = parseInt(process.env.TRIAL_DAYS || "3");
    const maxTrials = parseInt(process.env.MAX_FREE_TRIAL || "3");

    let user = await pool.query(
      "SELECT * FROM users WHERE telegram_id=$1",
      [telegram_id]
    );

    if (!user.rows.length) {
      return res.json({ success: false, error: "user_not_found" });
    }

    user = user.rows[0];

    // limit check
    if (user.trial_count >= maxTrials)
      return res.json({ success: false, error: "trial_limit" });

    // active trial check
    if (user.trial_expiry && new Date(user.trial_expiry) > new Date())
      return res.json({ success: false, error: "active_trial" });

    const expireDate = new Date(
      Date.now() + trialDays * 24 * 60 * 60 * 1000
    );

    await pool.query(
      `UPDATE users 
       SET trial_count = trial_count + 1,
           trial_expiry = $1
       WHERE telegram_id = $2`,
      [expireDate, telegram_id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// =======================
// Fallback to index
// =======================

app.get("*", (_, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("Server running on port", PORT)
);
