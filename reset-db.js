import pkg from "pg"

const { Pool } = pkg

const pool = new Pool({
 connectionString: process.env.DATABASE_URL,
 ssl:{ rejectUnauthorized:false }
})

async function reset(){

 await pool.query(
 TRUNCATE users, trial_keys, referrals RESTART IDENTITY
 )

 console.log("database reset complete")

 process.exit()

}

reset()
