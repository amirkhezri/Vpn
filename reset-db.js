import pkg from "pg"

const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function resetDatabase(){

  try{

    await pool.query(
      TRUNCATE TABLE users, trial_keys, referrals RESTART IDENTITY CASCADE
    )

    console.log("database reset complete")

  }catch(err){

    console.log("reset error:",err)

  }

  process.exit()

}

resetDatabase()
