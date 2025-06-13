const pool = require('./db');

async function createContactsTableIfNotExists() {
  const query = `
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      phone_number VARCHAR(20),
      email VARCHAR(255),
      linked_id INTEGER REFERENCES contacts(id),
      link_precedence VARCHAR(10) CHECK (link_precedence IN ('primary', 'secondary')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP
    );
  `;

  try {
    const client = await pool.connect();
    await client.query(query);
    console.log("✅ 'contacts' table created or already exists.");
    client.release();
  } catch (err) {
    console.error("❌ Failed to create 'contacts' table:", err);
  }
}

module.exports = createContactsTableIfNotExists;
