const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL
});

client.connect().then(() => {
  client.query('SELECT * FROM payments WHERE reference = $1', ['PAY-2026-6010C26FAD87'])
    .then(res => {
      console.log('Résultat:', res.rows);
      client.end();
    })
    .catch(err => {
      console.error('Erreur:', err.message);
      client.end();
    });
});