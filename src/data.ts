const host = window.location.hostname;

// VITE_API_URL é setado no build de produção (ex: https://seu-backend.onrender.com)
// Em desenvolvimento, usamos o backend local na porta 3001.
const rawApi = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");

export const API_BASE = rawApi ? `${rawApi}/api` : `http://${host}:3001/api`;
export const WS_URL = rawApi
  ? rawApi.replace(/^http/, "ws")
  : `ws://${host}:3001`;

export type Priority = 'alta' | 'média' | 'baixa'
export type Status = 'backlog' | 'todo' | 'doing' | 'review' | 'done'

export interface Board {
  id: string
  name: string
  description: string
  done_column_id: string | null
  total_points: number
  done_points: number
  total_tasks: number
  done_tasks: number
  created_at: string
  updated_at: string
}

export interface Column {
  id: string
  board_id: string
  name: string
  color: string
  position: number
  wip_limit: number | null
}

export interface Task {
  id: string
  board_id: string
  column_id: string
  sprint_id: string | null
  title: string
  description: string
  priority: Priority
  assignee_id: string | null
  assignee_name: string | null
  assignee_avatar: string | null
  story_points: number
  position: number
  tags: string[]
  updated_at: string
  created_at: string
}

export interface Sprint {
  id: string
  board_id: string
  name: string
  goal: string
  start_date: string
  end_date: string
  active: boolean
}

export interface Member {
  id: string
  name: string
  avatar: string
  role: string
  email: string | null
  online: boolean
}

// ── API Functions ───────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getBoards(): Promise<Board[]> {
  return fetchJSON(`${API_BASE}/boards`);
}

export async function createBoard(name: string, description?: string): Promise<Board> {
  return fetchJSON(`${API_BASE}/boards`, {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function deleteBoard(id: string): Promise<void> {
  await fetchJSON(`${API_BASE}/boards/${id}`, { method: 'DELETE' });
}

export async function updateBoard(id: string, updates: { name?: string; description?: string; done_column_id?: string | null }): Promise<Board> {
  return fetchJSON(`${API_BASE}/boards/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function getColumns(boardId: string): Promise<Column[]> {
  return fetchJSON(`${API_BASE}/boards/${boardId}/columns`);
}

export async function createColumn(boardId: string, name: string, color: string): Promise<Column> {
  return fetchJSON(`${API_BASE}/boards/${boardId}/columns`, {
    method: 'POST',
    body: JSON.stringify({ name, color }),
  });
}

export async function deleteColumn(id: string): Promise<void> {
  await fetchJSON(`${API_BASE}/columns/${id}`, { method: 'DELETE' });
}

export async function reorderColumns(boardId: string, columnIds: string[]): Promise<Column[]> {
  return fetchJSON(`${API_BASE}/boards/${boardId}/columns/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ columnIds }),
  });
}

export async function getTasks(boardId: string): Promise<Task[]> {
  return fetchJSON(`${API_BASE}/boards/${boardId}/tasks`);
}

export async function createTask(boardId: string, task: Partial<Task> & { title: string; column_id: string }): Promise<Task> {
  return fetchJSON(`${API_BASE}/boards/${boardId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task),
  });
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
  return fetchJSON(`${API_BASE}/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  await fetchJSON(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE' });
}

export async function getSprints(boardId: string): Promise<Sprint[]> {
  return fetchJSON(`${API_BASE}/boards/${boardId}/sprints`);
}

export async function getMembers(): Promise<Member[]> {
  return fetchJSON(`${API_BASE}/members`);
}
