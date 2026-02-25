import express from "express"
import fs from "fs"
import pkg from "pg"
import cron from "node-cron"
import cors from "cors"

import path from "path"
import { fileURLToPath } from "url"

const { Pool } = pkg

const app = express()

app.use(express.json())
app.use(cors())

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(express.static(__dirname))

const PORT = process.env.PORT || 3000
const TRIAL_DAYS = process.env.TRIAL_DAYS || 3
const REFERRAL_REQUIRED = process.env.REFERRAL_REQUIRED || 5
const MAX_TRIALS = process.env.MAX_TRIALS || 3

const pool = new Pool({
 connectionString: process.env.DATABASE_URL,
 ssl: { rejectUnauthorized: false }
})

async function resetDatabase(){

 if(process.env.RESET_DB !== "true") return

 console.log("Resetting database...")

 await pool.query(`
  TRUNCATE TABLE users, trial_keys, referrals RESTART IDENTITY CASCADE
 `)

 console.log("Database cleared")

}
const TEST_KEYS_FILE = "./test-keys.txt"
const ACTIVE_KEYS_FILE = "./active-test-keys.txt"


function getFirstKey(){
 const data = fs.readFileSync(TEST_KEYS_FILE,"utf8").split("\n").filter(x=>x.trim()!="")
 if(data.length===0) return null
 const key=data.shift()
 fs.writeFileSync(TEST_KEYS_FILE,data.join("\n"))
 return key
}

function addActiveKey(key){
 fs.appendFileSync(ACTIVE_KEYS_FILE,key+"\n")
}

function removeActiveKey(key){
 const data = fs.readFileSync(ACTIVE_KEYS_FILE,"utf8").split("\n").filter(x=>x.trim()!="" && x!==key)
 fs.writeFileSync(ACTIVE_KEYS_FILE,data.join("\n"))
}

function returnKey(key){
 fs.appendFileSync(TEST_KEYS_FILE,key+"\n")
}



async function ensureUser(telegram_id){

 const res = await pool.query(
  "SELECT * FROM users WHERE telegram_id=$1",
  [telegram_id]
 )

 if(res.rows.length===0){

  await pool.query(
   "INSERT INTO users(telegram_id,trial_count,referral_count) VALUES($1,0,0)",
   [telegram_id]
  )

  return {
   trial_count:0,
   referral_count:0
  }
 }

 return res.rows[0]
}




app.get("/api/user/:id", async (req, res) => {

 const rawId = String(req.params.id || "").trim()
 const isTelegramId = /^\d+$/.test(rawId)

 if(!isTelegramId){
  return res.json({
   balance: 0,
   vless_key: null,
   subscription_expiry: null,
   invited_count: 0,
   trial_used: false
  })
 }

 const telegram_id = Number(rawId)
 const user = await ensureUser(telegram_id)

 const active = await pool.query(
  "SELECT vless_key, expire_at FROM trial_keys WHERE assigned_to=$1 AND expire_at > NOW() ORDER BY id DESC LIMIT 1",
  [telegram_id]
 )

 res.json({
  balance: 0,
  vless_key: active.rows[0]?.vless_key || null,
  subscription_expiry: active.rows[0]?.expire_at ? Math.floor(new Date(active.rows[0].expire_at).getTime()/1000) : null,
  invited_count: user.referral_count || 0,
  trial_used: (user.trial_count || 0) > 0
 })
})


app.get("/api/trial/status", async(req,res)=>{

 const telegram_id=req.query.telegram_id || req.query.telegramId

 if(!telegram_id){
  return res.status(400).json({status:"error",message:"telegram_id is required"})
 }

 const user=await ensureUser(telegram_id)

 const active = await pool.query(
  "SELECT * FROM trial_keys WHERE assigned_to=$1 AND expire_at > NOW()",
  [telegram_id]
 )

 if(active.rows.length>0){

  return res.json({
   status:"active",
   key:active.rows[0].vless_key,
   expire:active.rows[0].expire_at
  })
 }

 if(user.trial_count>=MAX_TRIALS){

  return res.json({
   status:"limit"
  })
 }

 if(user.trial_count>0 && user.referral_count<REFERRAL_REQUIRED){

  return res.json({
   status:"referral",
   need:REFERRAL_REQUIRED-user.referral_count
  })
 }

 return res.json({
  status:"available"
 })

})



app.post("/api/trial/activate", async(req,res)=>{

 const {telegram_id}=req.body

 if(!telegram_id){
  return res.status(400).json({status:"error",message:"telegram_id is required"})
 }

 const user=await ensureUser(telegram_id)

 if(user.trial_count>=MAX_TRIALS){
  return res.json({status:"limit"})
 }

 if(user.trial_count>0 && user.referral_count<REFERRAL_REQUIRED){
  return res.json({status:"referral"})
 }

 const key=getFirstKey()

 if(!key){
  return res.json({status:"no_keys"})
 }

 const expire=new Date(Date.now()+TRIAL_DAYS*24*60*60*1000)

 await pool.query(
  "INSERT INTO trial_keys(vless_key,status,assigned_to,expire_at) VALUES($1,'active',$2,$3)",
  [key,telegram_id,expire]
 )

 await pool.query(
  "UPDATE users SET trial_count=trial_count+1 WHERE telegram_id=$1",
  [telegram_id]
 )

 addActiveKey(key)

 res.json({
  status:"activated",
  key,
  expire
 })

})



app.post("/api/referral/register",async(req,res)=>{

 const {referrer,referred}=req.body

 if(referrer==referred) return res.json({status:"ignored"})

 const exists=await pool.query(
  "SELECT * FROM referrals WHERE referred_id=$1",
  [referred]
 )

 if(exists.rows.length>0) return res.json({status:"exists"})

 await pool.query(
  "INSERT INTO referrals(referrer_id,referred_id) VALUES($1,$2)",
  [referrer,referred]
 )

 await pool.query(
  "UPDATE users SET referral_count=referral_count+1 WHERE telegram_id=$1",
  [referrer]
 )

 res.json({status:"ok"})

})



cron.schedule("* * * * *", async()=>{

 const expired = await pool.query(
  "SELECT * FROM trial_keys WHERE expire_at < NOW() AND status='active'"
 )

 for(const row of expired.rows){

  returnKey(row.vless_key)

  removeActiveKey(row.vless_key)

  await pool.query(
   "UPDATE trial_keys SET status='expired' WHERE id=$1",
   [row.id]
  )

 }

})

app.get("/",(req,res)=>{
 res.sendFile(path.join(__dirname,"index.html"))
})


async function initDatabase(){

 await pool.query(`
 CREATE TABLE IF NOT EXISTS users(
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE,
  trial_count INT DEFAULT 0,
  referral_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
 )
 `)

 await pool.query(`
 CREATE TABLE IF NOT EXISTS trial_keys(
  id SERIAL PRIMARY KEY,
  vless_key TEXT,
  status TEXT,
  assigned_to BIGINT,
  expire_at TIMESTAMP
 )
 `)

 await pool.query(`
 CREATE TABLE IF NOT EXISTS referrals(
  id SERIAL PRIMARY KEY,
  referrer_id BIGINT,
  referred_id BIGINT,
  created_at TIMESTAMP DEFAULT NOW()
 )
 `)

 console.log("database ready")

}

initDatabase()
.then(resetDatabase)
.then(()=>{

 app.listen(PORT,()=>{
  console.log("Server running")
 })

})
