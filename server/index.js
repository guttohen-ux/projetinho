const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const { Pool } = require('pg');
const { initDatabase, runMigrations } = require('./setupDb');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── WebSocket ────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

async function setPresence(userId, online) {
  if (!userId) return;
  try {
    await pool.query('UPDATE users SET online = $1, updated_at = NOW() WHERE id = $2', [online, userId]);
    broadcast({ type: 'presence', userId, online });
  } catch (err) {
    console.error('Erro ao atualizar presença:', err.message);
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const userId = url.searchParams.get('userId') || null;
  ws.userId = userId;
  console.log(`WebSocket client connected (user: ${userId || 'anon'})`);
  if (userId) setPresence(userId, true);

  ws.on('close', () => {
    console.log(`WebSocket client disconnected (user: ${ws.userId || 'anon'})`);
    if (ws.userId) {
      // Only mark offline if the user has no other open connections
      const stillConnected = Array.from(wss.clients).some(
        (c) => c !== ws && c.readyState === 1 && c.userId === ws.userId
      );
      if (!stillConnected) setPresence(ws.userId, false);
    }
  });
});

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'taskflow',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

// Test connection + initialize schema in one place
pool.connect(async (err) => {
  if (err) {
    console.error('Erro ao conectar no PostgreSQL:', err.message);
    return;
  }
  console.log('Conectado ao PostgreSQL');
  try {
    await initDatabase(pool);
    await runMigrations(pool);
  } catch (initErr) {
    console.error('Erro ao inicializar o banco:', initErr.message);
  }
});

// ── BOARDS ──────────────────────────────────────────────────────────────────

app.get('/api/boards', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.*,
        COALESCE(SUM(t.story_points), 0) AS total_points,
        COALESCE(SUM(CASE WHEN t.column_id = b.done_column_id THEN t.story_points ELSE 0 END), 0) AS done_points,
        COUNT(t.id) AS total_tasks,
        COUNT(CASE WHEN t.column_id = b.done_column_id THEN 1 END) AS done_tasks
      FROM boards b
      LEFT JOIN tasks t ON t.board_id = b.id
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/boards', async (req, res) => {
  const { name, description } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO boards (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || '']
    );
    const board = rows[0];
    broadcast({ type: 'board:created', board });
    res.status(201).json(board);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/boards/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT * FROM boards WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Board não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/boards/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM boards WHERE id = $1', [id]);
    broadcast({ type: 'board:deleted', boardId: id });
    res.json({ message: 'Board deletado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/boards/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, done_column_id } = req.body;
  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (done_column_id !== undefined) { fields.push(`done_column_id = $${idx++}`); values.push(done_column_id || null); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

    fields.push(`updated_at = NOW()`);
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE boards SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Board não encontrado' });
    broadcast({ type: 'board:updated', board: rows[0] });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── COLUMNS ─────────────────────────────────────────────────────────────────

app.get('/api/boards/:boardId/columns', async (req, res) => {
  const { boardId } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM columns WHERE board_id = $1 ORDER BY position',
      [boardId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/boards/:boardId/columns', async (req, res) => {
  const { boardId } = req.params;
  const { name, color } = req.body;
  try {
    const { rows: maxRows } = await pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM columns WHERE board_id = $1',
      [boardId]
    );
    const position = maxRows[0].next_pos;
    const { rows } = await pool.query(
      'INSERT INTO columns (board_id, name, color, position) VALUES ($1, $2, $3, $4) RETURNING *',
      [boardId, name, color || '#6366f1', position]
    );

    // The last column is always the done column
    await pool.query('UPDATE boards SET done_column_id = $1, updated_at = NOW() WHERE id = $2', [rows[0].id, boardId]);

    broadcast({ type: 'column:created', boardId, column: rows[0] });
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/boards/:boardId/columns/reorder', async (req, res) => {
  const { boardId } = req.params;
  const { columnIds } = req.body;
  if (!Array.isArray(columnIds)) return res.status(400).json({ error: 'columnIds must be an array' });
  try {
    for (let i = 0; i < columnIds.length; i++) {
      await pool.query('UPDATE columns SET position = $1 WHERE id = $2 AND board_id = $3', [i, columnIds[i], boardId]);
    }
    // Update done_column_id to the last column
    const lastColId = columnIds[columnIds.length - 1];
    await pool.query('UPDATE boards SET done_column_id = $1, updated_at = NOW() WHERE id = $2', [lastColId, boardId]);
    const { rows } = await pool.query('SELECT * FROM columns WHERE board_id = $1 ORDER BY position', [boardId]);
    broadcast({ type: 'columns:reordered', boardId, columns: rows });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/columns/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Find which board this column belongs to
    const { rows: colRows } = await pool.query('SELECT board_id FROM columns WHERE id = $1', [id]);
    if (colRows.length === 0) return res.status(404).json({ error: 'Coluna não encontrada' });
    const boardId = colRows[0].board_id;

    await pool.query('DELETE FROM columns WHERE id = $1', [id]);

    // Reassign done_column_id to the new last column (highest position)
    const { rows: lastCol } = await pool.query(
      'SELECT id FROM columns WHERE board_id = $1 ORDER BY position DESC LIMIT 1', [boardId]
    );
    await pool.query(
      'UPDATE boards SET done_column_id = $1, updated_at = NOW() WHERE id = $2',
      [lastCol[0]?.id ?? null, boardId]
    );

    broadcast({ type: 'column:deleted', boardId, columnId: id });
    res.json({ message: 'Coluna deletada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── TASKS ───────────────────────────────────────────────────────────────────

app.get('/api/boards/:boardId/tasks', async (req, res) => {
  const { boardId } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT t.*, u.name AS assignee_name, u.avatar AS assignee_avatar,
        COALESCE(
          (SELECT json_agg(l.name) FROM task_labels tl JOIN labels l ON l.id = tl.label_id WHERE tl.task_id = t.id),
          '[]'
        ) AS tags
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.board_id = $1
      ORDER BY t.position
    `, [boardId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/boards/:boardId/tasks', async (req, res) => {
  const { boardId } = req.params;
  const { title, description, priority, column_id, assignee_id, story_points, sprint_id, tags } = req.body;
  try {
    const { rows: maxRows } = await pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tasks WHERE board_id = $1 AND column_id = $2',
      [boardId, column_id]
    );
    const position = maxRows[0].next_pos;

    const { rows } = await pool.query(`
      INSERT INTO tasks (board_id, column_id, title, description, priority, assignee_id, story_points, sprint_id, position)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [boardId, column_id, title, description || '', priority || 'média', assignee_id || null, story_points || 3, sprint_id || null, position]);

    const task = rows[0];

    // Insert labels
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        const { rows: labelRows } = await pool.query(
          'SELECT id FROM labels WHERE board_id = $1 AND name = $2',
          [boardId, tagName]
        );
        if (labelRows.length > 0) {
          await pool.query(
            'INSERT INTO task_labels (task_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [task.id, labelRows[0].id]
          );
        }
      }
    }

    broadcast({ type: 'task:created', boardId, task });
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { column_id, position, title, description, priority, assignee_id, story_points, sprint_id } = req.body;
  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (column_id !== undefined) { fields.push(`column_id = $${idx++}`); values.push(column_id); }
    if (position !== undefined) { fields.push(`position = $${idx++}`); values.push(position); }
    if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(priority); }
    if (assignee_id !== undefined) { fields.push(`assignee_id = $${idx++}`); values.push(assignee_id); }
    if (story_points !== undefined) { fields.push(`story_points = $${idx++}`); values.push(story_points); }
    if (sprint_id !== undefined) { fields.push(`sprint_id = $${idx++}`); values.push(sprint_id); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE tasks SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });
    broadcast({ type: 'task:updated', task: rows[0] });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    broadcast({ type: 'task:deleted', taskId: id });
    res.json({ message: 'Tarefa deletada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SPRINTS ─────────────────────────────────────────────────────────────────

app.get('/api/boards/:boardId/sprints', async (req, res) => {
  const { boardId } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM sprints WHERE board_id = $1 ORDER BY start_date DESC',
      [boardId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/boards/:boardId/sprints', async (req, res) => {
  const { boardId } = req.params;
  const { name, goal, start_date, end_date } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO sprints (board_id, name, goal, start_date, end_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [boardId, name, goal || '', start_date, end_date]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── MEMBERS ─────────────────────────────────────────────────────────────────

app.get('/api/members', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── LABELS ──────────────────────────────────────────────────────────────────

app.get('/api/boards/:boardId/labels', async (req, res) => {
  const { boardId } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM labels WHERE board_id = $1 ORDER BY name',
      [boardId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── STATIC (frontend buildado) ──────────────────────────────────────────────
// Em produção, se a build do frontend existir em <raiz>/dist, o backend também
// serve o app na mesma origem (útil para deploy em um único Web Service).
const distDir = path.join(__dirname, '..', 'dist');

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log('Servindo frontend buildado a partir de /dist');
}

// ── START ───────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`Servidor HTTP + WebSocket rodando em http://localhost:${PORT}`);
});
