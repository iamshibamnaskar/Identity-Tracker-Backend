const express = require("express");
const { identifyHandler } = require("./identify");
const pool = require("./db");
require("dotenv").config();
const createContactsTableIfNotExists = require('./initDb')

const app = express();
app.use(express.json());

app.post("/identify", identifyHandler);

const PORT = process.env.PORT || 8000;

(async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Successfully connected to PostgreSQL database");

    client.release();
    createContactsTableIfNotExists();
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to connect to PostgreSQL database");
    console.error(err.message);
    process.exit(1); 
  }
})();
