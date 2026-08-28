-- TaskFlow Kanban - PostgreSQL Schema
-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Usuários/Membros
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  avatar VARCHAR(10) NOT NULL,
  role VARCHAR(50) NOT NULL,
  email VARCHAR(150) UNIQUE,
  online BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Boards (suporta múltiplos boards)
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(150) NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  done_column_id UUID,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Colunas (cada board tem suas próprias colunas)
CREATE TABLE columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  wip_limit INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Sprints
CREATE TABLE sprints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  goal TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tarefas
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20) CHECK (priority IN ('alta', 'média', 'baixa')) DEFAULT 'média',
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  story_points INTEGER DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Labels/Tags
CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) NOT NULL
);

-- Junção Task-Label
CREATE TABLE task_labels (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

-- Log de atividades
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_tasks_board ON tasks(board_id);
CREATE INDEX idx_tasks_column ON tasks(column_id);
CREATE INDEX idx_tasks_sprint ON tasks(sprint_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_columns_board ON columns(board_id);
CREATE INDEX idx_sprints_board ON sprints(board_id);
CREATE INDEX idx_activity_task ON activity_log(task_id);

-- Dados iniciais (seed)
INSERT INTO users (name, avatar, role, email, online) VALUES
  ('Ana Souza', 'AS', 'Tech Lead', 'ana@example.com', true),
  ('Bruno Lima', 'BL', 'Frontend', 'bruno@example.com', true),
  ('Carla Matos', 'CM', 'Backend', 'carla@example.com', false),
  ('Diego Ramos', 'DR', 'DevOps', 'diego@example.com', true),
  ('Elena Costa', 'EC', 'Design', 'elena@example.com', false);

INSERT INTO boards (name, description) VALUES
  ('Projeto Principal', 'Board principal do time de desenvolvimento'),
  ('Marketing', 'Campanhas e conteúdo');

INSERT INTO columns (board_id, name, color, position) VALUES
  ((SELECT id FROM boards WHERE name = 'Projeto Principal'), 'Backlog', '#475569', 0),
  ((SELECT id FROM boards WHERE name = 'Projeto Principal'), 'A Fazer', '#6366f1', 1),
  ((SELECT id FROM boards WHERE name = 'Projeto Principal'), 'Em Progresso', '#f59e0b', 2),
  ((SELECT id FROM boards WHERE name = 'Projeto Principal'), 'Em Revisão', '#8b5cf6', 3),
  ((SELECT id FROM boards WHERE name = 'Projeto Principal'), 'Concluído', '#10b981', 4);

INSERT INTO columns (board_id, name, color, position) VALUES
  ((SELECT id FROM boards WHERE name = 'Marketing'), 'Ideias', '#6366f1', 0),
  ((SELECT id FROM boards WHERE name = 'Marketing'), 'Em Produção', '#f59e0b', 1),
  ((SELECT id FROM boards WHERE name = 'Marketing'), 'Publicado', '#10b981', 2);

UPDATE boards SET done_column_id = (
  SELECT id FROM columns WHERE name = 'Concluído' AND board_id = boards.id
);

UPDATE boards SET done_column_id = (
  SELECT id FROM columns WHERE name = 'Publicado' AND board_id = boards.id
) WHERE name = 'Marketing';

INSERT INTO sprints (board_id, name, goal, start_date, end_date, active) VALUES
  ((SELECT id FROM boards WHERE name = 'Projeto Principal'), 'Sprint 7', 'Finalizar módulo de notificações', '2026-08-04', '2026-08-18', true),
  ((SELECT id FROM boards WHERE name = 'Projeto Principal'), 'Sprint 6', 'Sistema de autenticação JWT', '2026-07-21', '2026-08-03', false);

INSERT INTO labels (board_id, name, color) VALUES
  ((SELECT id FROM boards WHERE name = 'Projeto Principal'), 'backend', '#1e3a5f'),
  ((SELECT id FROM boards WHERE name = 'Projeto Principal'), 'frontend', '#1e3355'),
  ((SELECT id FROM boards WHERE name = 'Projeto Principal'), 'ws', '#2d1f5e'),
  ((SELECT id FROM boards WHERE name = 'Projeto Principal'), 'db', '#1a3a2a'),
  ((SELECT id FROM boards WHERE name = 'Projeto Principal'), 'infra', '#3a2a0a');

INSERT INTO tasks (board_id, column_id, title, description, priority, assignee_id, story_points, position) VALUES
  ((SELECT id FROM boards WHERE name = 'Projeto Principal'),
   (SELECT id FROM columns WHERE name = 'Em Progresso' AND board_id = (SELECT id FROM boards WHERE name = 'Projeto Principal')),
   'Implementar WebSocket handler no servidor',
   'Criar o handler que processa eventos TASK_MOVE e TASK_CREATE',
   'alta',
   (SELECT id FROM users WHERE name = 'Carla Matos'),
   8, 0);

INSERT INTO tasks (board_id, column_id, title, description, priority, assignee_id, story_points, position) VALUES
  ((SELECT id FROM boards WHERE name = 'Projeto Principal'),
   (SELECT id FROM columns WHERE name = 'Em Progresso' AND board_id = (SELECT id FROM boards WHERE name = 'Projeto Principal')),
   'Hook useWebSocket no cliente React',
   'Abstração que abre conexão WS e reconecta automaticamente',
   'alta',
   (SELECT id FROM users WHERE name = 'Bruno Lima'),
   5, 1);
