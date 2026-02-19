const express = require("express");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(express.static("./"));

// اتصال به دیتابیس PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ساخت جدول users در صورت عدم وجود
async function initDB() {
  await pool.query(
    CREATE TABLE IF NOT EXISTS users (
      telegram_id BIGINT PRIMARY KEY,
      trial_count INT DEFAULT 0,
      referral_count INT DEFAULT 0,
      trial_expire BIGINT
    )
  );
}
initDB();

// مسیر فایل کلیدها
const TEST_KEYS = path.join(__dirname, "test-keys.txt");
const ACTIVE_KEYS = path.join(__dirname, "active-test-keys.txt");

// انتخاب تصادفی کلید تست و انتقال به active
function getRandomKey() {
  const keys = fs.readFileSync(TEST_KEYS, "utf8")
    .split("\n")
    .filter(Boolean);

  if (!keys.length) return null;

  const index = Math.floor(Math.random() * keys.length);
  const key = keys[index];

  keys.splice(index, 1);
  fs.writeFileSync(TEST_KEYS, keys.join("\n") + "\n");
  fs.appendFileSync(ACTIVE_KEYS, key + "\n");

  return key;
}

// API برای درخواست کلید تست
app.post("/api/trial", async (req, res) => {
  const { telegramId } = req.body;

  const trialDays = parseInt(process.env.TRIAL_DAYS || "3");
  const maxTrials = parseInt(process.env.MAX_FREE_TRIAL || "3");

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

  user = user.rows[0];

  // اگر trial limit رد شده
  if (user.trial_count >= maxTrials)
    return res.json({ error: "trial_limit" });

  // اگر trial فعالی دارد
  if (user.trial_expire && Date.now() < user.trial_expire)
    return res.json({ error: "active_trial" });

  const key = getRandomKey();
  if (!key) return res.json({ error: "no_keys" });

  const expire = Date.now() + trialDays * 86400000;

  await pool.query(
    "UPDATE users SET trial_count=trial_count+1, trial_expire=$1 WHERE telegram_id=$2",
    [expire, telegramId]
  );

  res.json({ key, expire });
});

// هر request دیگر → index.html
app.get("*", (_, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
