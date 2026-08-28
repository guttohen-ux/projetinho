const fs = require('fs');
const path = require('path');

// Cria o schema (tabelas + seed) apenas se o banco ainda estiver vazio.
// O servidor chama isso no boot, então funciona sem steps manuais no Render.
async function initDatabase(pool) {
  const { rows } = await pool.query("SELECT to_regclass('public.users') AS tbl");
  if (rows[0]?.tbl) return false;

  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('Banco inicializado: schema.sql aplicado (com seed)');
  return true;
}

// Migrations incrementais (aplicadas a bancos já existentes).
async function runMigrations(pool) {
  const { rows } = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'boards' AND column_name = 'done_column_id'"
  );
  if (rows.length > 0) return false;

  await pool.query('ALTER TABLE boards ADD COLUMN done_column_id UUID');
  await pool.query(`
    UPDATE boards SET done_column_id = (
      SELECT c.id FROM columns c
      WHERE c.board_id = boards.id
        AND (c.name ILIKE 'concluído' OR c.name ILIKE 'done' OR c.name ILIKE 'publicado')
      LIMIT 1
    )
  `);
  console.log('Migration aplicada: boards.done_column_id');
  return true;
}

module.exports = { initDatabase, runMigrations };