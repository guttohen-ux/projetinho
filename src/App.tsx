import { useState, useEffect, useRef, useCallback } from "react";
import {
  getBoards,
  createBoard,
  deleteBoard,
  updateBoard,
  getColumns,
  createColumn,
  deleteColumn,
  reorderColumns,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getSprints,
  getMembers,
  API_BASE,
  WS_URL,
  type Board,
  type Column,
  type Task,
  type Sprint,
  type Member,
} from "./data";
import { useWebSocket } from "./useWebSocket";

// ── colours ────────────────────────────────────────────────────────────────
const C = {
  bg: "#0f1117",
  sidebar: "#0b0d12",
  panel: "#13161f",
  card: "#161b27",
  border: "#1a1f2e",
  border2: "#232840",
  text: "#e2e8f0",
  muted: "#64748b",
  accent: "#6366f1",
  accentBg: "rgba(99,102,241,0.1)",
  green: "#10b981",
  amber: "#f59e0b",
  purple: "#8b5cf6",
  red: "#ef4444",
};

const priorityMap: Record<
  string,
  { color: string; label: string; points: number }
> = {
  alta: { color: C.red, label: "Alta", points: 5 },
  média: { color: C.amber, label: "Média", points: 3 },
  baixa: { color: C.green, label: "Baixa", points: 1 },
};

const tagColor: Record<string, string> = {
  backend: "#1e3a5f",
  frontend: "#1e3355",
  ws: "#2d1f5e",
  hooks: "#2d1f5e",
  db: "#1a3a2a",
  infra: "#3a2a0a",
  redis: "#3a1a1a",
  docker: "#0a2a3a",
  ux: "#2a1a3a",
  auth: "#1a2a3a",
  analytics: "#1a2a1a",
};

function Avatar({
  initials,
  online,
  size = 28,
}: {
  initials: string;
  online?: boolean;
  size?: number;
}) {
  const colors: Record<string, string> = {
    AS: "#4f46e5",
    BL: "#0891b2",
    CM: "#059669",
    DR: "#d97706",
    EC: "#7c3aed",
  };
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: colors[initials] ?? C.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.35,
          fontWeight: 600,
          color: "#fff",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {initials}
      </div>
      {online !== undefined && (
        <span
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: online ? C.green : C.muted,
            border: `2px solid ${C.sidebar}`,
          }}
        />
      )}
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        padding: "1px 6px",
        borderRadius: 3,
        background: tagColor[label] ?? "#1e2330",
        color: "#94a3b8",
        letterSpacing: "0.03em",
      }}
    >
      {label}
    </span>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const { color, label } = priorityMap[p] ?? { color: C.muted, label: p };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 600,
        color,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}

function TaskCard({
  task,
  columns,
  onMove,
  onOpen,
}: {
  task: Task;
  columns: Column[];
  onMove: (id: string, direction: "next" | "prev") => void;
  onOpen: (task: Task) => void;
}) {
  const colIndex = columns.findIndex((c) => c.id === task.column_id);
  return (
    <div
      className="card-drag slide-in"
      onClick={() => onOpen(task)}
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "12px 14px",
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
        marginBottom: 8,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = C.border2;
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <PriorityBadge p={task.priority} />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: C.muted,
          }}
        >
          {task.story_points}pt
        </span>
      </div>
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: C.text,
          lineHeight: 1.5,
          margin: "0 0 10px",
        }}
      >
        {task.title}
      </p>
      {task.tags && task.tags.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            marginBottom: 10,
          }}
        >
          {task.tags.map((t) => (
            <Tag key={t} label={t} />
          ))}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {task.assignee_avatar && (
            <Avatar initials={task.assignee_avatar} size={22} />
          )}
          <span style={{ fontSize: 11, color: C.muted }}>
            {task.assignee_name?.split(" ")[0] ?? "—"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{ display: "flex", gap: 2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {colIndex > 0 && (
              <button
                onClick={() => onMove(task.id, "prev")}
                style={{
                  background: "none",
                  border: "none",
                  color: C.muted,
                  cursor: "pointer",
                  padding: "0 3px",
                  fontSize: 13,
                }}
              >
                ←
              </button>
            )}
            {colIndex < columns.length - 1 && (
              <button
                onClick={() => onMove(task.id, "next")}
                style={{
                  background: "none",
                  border: "none",
                  color: C.muted,
                  cursor: "pointer",
                  padding: "0 3px",
                  fontSize: 13,
                }}
              >
                →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ColumnHeader({
  col,
  tasks,
  onAdd,
}: {
  col: Column;
  tasks: Task[];
  onAdd: (columnId: string) => void;
}) {
  const total = tasks.reduce((s, t) => s + t.story_points, 0);
  return (
    <div
      style={{
        width: 272,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: C.panel,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        maxHeight: "calc(100vh - 130px)",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: col.color,
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
            {col.name}
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: col.color,
              background: col.color + "18",
              borderRadius: 4,
              padding: "1px 6px",
            }}
          >
            {tasks.length}
          </span>
        </div>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: C.muted,
          }}
        >
          {total}pt
        </span>
      </div>
      <div style={{ padding: "10px 10px 0", overflowY: "auto", flex: 1 }}>
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            columns={[col]}
            onMove={() => {}}
            onOpen={() => {}}
          />
        ))}
      </div>
      <div style={{ padding: "8px 10px 10px", flexShrink: 0 }}>
        <button
          onClick={() => onAdd(col.id)}
          style={{
            width: "100%",
            background: "none",
            border: `1px dashed ${C.border2}`,
            borderRadius: 8,
            padding: "8px",
            color: C.muted,
            fontSize: 12,
            cursor: "pointer",
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = C.accent;
            e.currentTarget.style.color = C.accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = C.border2;
            e.currentTarget.style.color = C.muted;
          }}
        >
          + Adicionar tarefa
        </button>
      </div>
    </div>
  );
}

function TaskModal({
  task,
  columns,
  onClose,
  onMove,
  onDelete,
  onConfirm,
}: {  task: Task;
  columns: Column[];
  onClose: () => void;
  onMove: (id: string, direction: "next" | "prev") => void;
  onDelete: (id: string) => void;
  onConfirm: (msg: string, type: "confirm" | "alert", fn: () => void) => void;
}) {
  const colIndex = columns.findIndex((c) => c.id === task.column_id);
  const col = columns[colIndex];
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="slide-in modal-sheet"
        style={{
          width: 400,
          background: C.card,
          border: `1px solid ${C.border2}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: col?.color ?? C.muted,
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 12, color: C.muted }}>
              {col?.name ?? "—"}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: C.muted,
              fontSize: 18,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <div style={{ marginBottom: 10 }}>
            <PriorityBadge p={task.priority} />
          </div>
          <h2
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: C.text,
              margin: "0 0 12px",
              lineHeight: 1.4,
            }}
          >
            {task.title}
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#94a3b8",
              lineHeight: 1.7,
              margin: "0 0 18px",
            }}
          >
            {task.description}
          </p>
          {task.tags && task.tags.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 18,
              }}
            >
              {task.tags.map((t) => (
                <Tag key={t} label={t} />
              ))}
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {[
              { label: "Responsável", value: task.assignee_name ?? "—" },
              { label: "Story Points", value: `${task.story_points} pt` },
              {
                label: "Atualizado",
                value: new Date(task.updated_at).toLocaleDateString("pt-BR"),
              },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  background: C.panel,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: C.muted,
                    marginBottom: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {m.label}
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {colIndex > 0 && (
              <button
                onClick={() => {
                  onMove(task.id, "prev");
                  onClose();
                }}
                style={{
                  flex: 1,
                  padding: "9px",
                  border: `1px solid ${C.border2}`,
                  borderRadius: 8,
                  background: "none",
                  color: C.muted,
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = C.accent;
                  e.currentTarget.style.color = C.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = C.border2;
                  e.currentTarget.style.color = C.muted;
                }}
              >
                ← {columns[colIndex - 1]?.name}
              </button>
            )}
            {colIndex < columns.length - 1 && (
              <button
                onClick={() => {
                  onMove(task.id, "next");
                  onClose();
                }}
                style={{
                  flex: 1,
                  padding: "9px",
                  border: `1px solid ${C.accent}`,
                  borderRadius: 8,
                  background: C.accentBg,
                  color: C.accent,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(99,102,241,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = C.accentBg;
                }}
              >
                {columns[colIndex + 1]?.name} →
              </button>
            )}
          </div>
          <button
            onClick={() =>
              onConfirm("Deletar esta tarefa?", "confirm", () => {
                onDelete(task.id);
                onClose();
              })
            }
            style={{
              width: "100%",
              padding: "9px",
              border: `1px solid ${C.red}44`,
              borderRadius: 8,
              background: "rgba(239,68,68,0.08)",
              color: C.red,
              fontSize: 12,
              cursor: "pointer",
              marginTop: 8,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.08)";
            }}
          >
            Deletar tarefa
          </button>
        </div>
      </div>
    </div>
  );
}

function NewTaskModal({
  columnId,
  columns,
  members,
  onClose,
  onSave,
}: {
  columnId: string;
  columns: Column[];
  members: Member[];
  onClose: () => void;
  onSave: (task: {
    title: string;
    description: string;
    priority: "alta" | "média" | "baixa";
    assignee_id: string | null;
    column_id: string;
    story_points: number;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [pri, setPri] = useState<"alta" | "média" | "baixa">("média");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const save = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: desc.trim() || "Sem descrição.",
      priority: pri,
      assignee_id: assigneeId || null,
      column_id: columnId,
      story_points: priorityMap[pri]?.points ?? 3,
    });
  };

  const inputStyle = {
    width: "100%",
    background: C.panel,
    border: `1px solid ${C.border2}`,
    borderRadius: 8,
    padding: "9px 12px",
    color: C.text,
    fontSize: 13,
    outline: "none",
    fontFamily: "Inter, sans-serif",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="slide-in modal-sheet"
        style={{
          width: 460,
          background: C.card,
          border: `1px solid ${C.border2}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            Nova Tarefa
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: C.muted,
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <input
            ref={ref}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da tarefa…"
            style={inputStyle}
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Descrição (opcional)…"
            rows={3}
            style={{ ...inputStyle, resize: "none" as const }}
          />
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <div>
              <label
                style={{
                  fontSize: 11,
                  color: C.muted,
                  display: "block",
                  marginBottom: 5,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Prioridade
              </label>
              <select
                value={pri}
                onChange={(e) => setPri(e.target.value as typeof pri)}
                style={{ ...inputStyle }}
              >
                <option value="alta">Alta</option>
                <option value="média">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  color: C.muted,
                  display: "block",
                  marginBottom: 5,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Responsável
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                style={{ ...inputStyle }}
              >
                <option value="">Nenhum</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={save}
            style={{
              padding: "10px",
              background: C.accent,
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            Criar Tarefa
          </button>
        </div>
      </div>
    </div>
  );
}

function NewBoardModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const inputStyle = {
    width: "100%",
    background: C.panel,
    border: `1px solid ${C.border2}`,
    borderRadius: 8,
    padding: "9px 12px",
    color: C.text,
    fontSize: 13,
    outline: "none",
    fontFamily: "Inter, sans-serif",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="slide-in modal-sheet"
        style={{
          width: 400,
          background: C.card,
          border: `1px solid ${C.border2}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            Novo Board
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: C.muted,
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <input
            ref={ref}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do board…"
            style={inputStyle}
            onKeyDown={(e) =>
              e.key === "Enter" && name.trim() && onSave(name.trim())
            }
          />
          <button
            onClick={() => {
              if (name.trim()) onSave(name.trim());
            }}
            style={{
              padding: "10px",
              background: C.accent,
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            Criar Board
          </button>
        </div>
      </div>
    </div>
  );
}

function NewColumnModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (name: string, color: string) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const presetColors = [
    "#475569",
    "#6366f1",
    "#f59e0b",
    "#8b5cf6",
    "#10b981",
    "#ef4444",
    "#0891b2",
    "#ec4899",
  ];

  const inputStyle = {
    width: "100%",
    background: C.panel,
    border: `1px solid ${C.border2}`,
    borderRadius: 8,
    padding: "9px 12px",
    color: C.text,
    fontSize: 13,
    outline: "none",
    fontFamily: "Inter, sans-serif",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="slide-in modal-sheet"
        style={{
          width: 400,
          background: C.card,
          border: `1px solid ${C.border2}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            Nova Coluna
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: C.muted,
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <input
            ref={ref}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da coluna…"
            style={inputStyle}
            onKeyDown={(e) =>
              e.key === "Enter" && name.trim() && onSave(name.trim(), color)
            }
          />
          <div>
            <label
              style={{
                fontSize: 11,
                color: C.muted,
                display: "block",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Cor
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {presetColors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: c,
                    border:
                      color === c ? "2px solid #fff" : "2px solid transparent",
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={() => {
              if (name.trim()) onSave(name.trim(), color);
            }}
            style={{
              padding: "10px",
              background: C.accent,
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            Criar Coluna
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  message,
  type,
  onConfirm,
  onCancel,
}: {
  message: string;
  type: "confirm" | "alert";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="slide-in modal-sheet"
        style={{
          width: 380,
          background: C.card,
          border: `1px solid ${C.border2}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "20px 24px" }}>
          <p
            style={{
              fontSize: 14,
              color: C.text,
              margin: "0 0 20px",
              lineHeight: 1.5,
            }}
          >
            {message}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            {type === "confirm" && (
              <button
                onClick={onCancel}
                style={{
                  padding: "8px 16px",
                  border: `1px solid ${C.border2}`,
                  borderRadius: 8,
                  background: "none",
                  color: C.muted,
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = C.accent;
                  e.currentTarget.style.color = C.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = C.border2;
                  e.currentTarget.style.color = C.muted;
                }}
              >
                Cancelar
              </button>
            )}
            <button
              onClick={onConfirm}
              style={{
                padding: "8px 16px",
                border: `1px solid ${type === "confirm" ? C.red : C.accent}`,
                borderRadius: 8,
                background:
                  type === "confirm" ? "rgba(239,68,68,0.08)" : C.accentBg,
                color: type === "confirm" ? C.red : C.accent,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  type === "confirm"
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(99,102,241,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  type === "confirm" ? "rgba(239,68,68,0.08)" : C.accentBg;
              }}
            >
              {type === "confirm" ? "Confirmar" : "OK"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (user: Member) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const inputStyle = {
    width: "100%",
    background: C.panel,
    border: `1px solid ${C.border2}`,
    borderRadius: 8,
    padding: "11px 14px",
    color: C.text,
    fontSize: 13,
    outline: "none",
    fontFamily: "Inter, sans-serif",
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Preencha todos os campos.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/members`);
      const members: Member[] = await res.json();
      const member = members.find(
        (m) => m.email?.toLowerCase() === email.trim().toLowerCase(),
      );
      if (member) {
        onLogin(member);
      } else {
        setError("Credenciais inválidas.");
      }
    } catch {
      setError("Erro ao conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: C.bg,
      }}
    >
      <div
        className="slide-in modal-sheet"
        style={{
          width: 380,
          background: C.card,
          border: `1px solid ${C.border2}`,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "32px 32px 28px", textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: C.accentBg,
              border: `1px solid ${C.accent}33`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              marginBottom: 16,
            }}
          >
            ⊞
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: C.text,
              margin: "0 0 6px",
            }}
          >
            TaskFlow
          </h1>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
            Gerencie seus projetos com eficiência
          </p>
        </div>
        <div
          style={{
            padding: "0 32px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div>
            <label
              style={{
                fontSize: 11,
                color: C.muted,
                display: "block",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Email
            </label>
            <input
              ref={emailRef}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              placeholder="seu@email.com"
              type="email"
              style={inputStyle}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: 11,
                color: C.muted,
                display: "block",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Senha
            </label>
            <input
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="••••••••"
              type="password"
              style={inputStyle}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          {error && (
            <div
              style={{
                fontSize: 12,
                color: C.red,
                padding: "8px 12px",
                background: "rgba(239,68,68,0.08)",
                border: `1px solid rgba(239,68,68,0.2)`,
                borderRadius: 8,
              }}
            >
              {error}
            </div>
          )}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              padding: "11px",
              background: C.accent,
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
              marginTop: 4,
              transition: "opacity 0.15s",
            }}
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
          <p
            style={{
              fontSize: 11,
              color: C.muted,
              textAlign: "center",
              margin: "4px 0 0",
            }}
          >
            Use o email de qualquer membro para entrar
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [newTaskColumnId, setNewTaskColumnId] = useState<string | null>(null);
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [showNewColumn, setShowNewColumn] = useState(false);
  const [activeView, setActiveView] = useState<"board">("board");
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    type: "confirm" | "alert";
    onConfirm: () => void;
  } | null>(null);
  const [currentUser, setCurrentUser] = useState<Member | null>(() => {
    try {
      const saved = localStorage.getItem("taskflow_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [dragColIndex, setDragColIndex] = useState<number | null>(null);
  const [dropColIndex, setDropColIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const activeBoard = boards.find((b) => b.id === activeBoardId);

  // WebSocket for real-time sync
  useWebSocket(
    WS_URL,
    currentUser?.id,
    useCallback(
      (msg) => {
        switch (msg.type) {
          case "presence":
            setMembers((prev) =>
              prev.map((m) =>
                m.id === msg.userId
                  ? { ...m, online: msg.online === true }
                  : m,
              ),
            );
            break;
          case "board:created":
            setBoards((prev) => {
              if (prev.some((b) => b.id === msg.board.id)) return prev;
              return [msg.board, ...prev];
            });
            break;
          case "board:deleted":
            setBoards((prev) => prev.filter((b) => b.id !== msg.boardId));
            break;
          case "board:updated":
            setBoards((prev) =>
              prev.map((b) => (b.id === msg.board.id ? msg.board : b)),
            );
            break;
          case "column:created":
            if (msg.boardId === activeBoardId) {
              setColumns((prev) => {
                if (prev.some((c) => c.id === msg.column.id)) return prev;
                return [...prev, msg.column];
              });
            }
            break;
          case "column:deleted":
            if (msg.boardId === activeBoardId) {
              setColumns((prev) => prev.filter((c) => c.id !== msg.columnId));
            }
            break;
          case "columns:reordered":
            if (msg.boardId === activeBoardId) {
              setColumns(msg.columns);
            }
            break;
          case "task:created":
            if (msg.boardId === activeBoardId) {
              setTasks((prev) => {
                if (prev.some((t) => t.id === msg.task.id)) return prev;
                return [...prev, msg.task];
              });
            }
            break;
          case "task:updated":
            setTasks((prev) =>
              prev.map((t) => (t.id === msg.task.id ? msg.task : t)),
            );
            break;
          case "task:deleted":
            setTasks((prev) => prev.filter((t) => t.id !== msg.taskId));
            break;
        }
      },
      [activeBoardId],
    ),
  );

  // Validate session on mount, then load boards
  useEffect(() => {
    const saved = localStorage.getItem("taskflow_user");
    if (!saved) {
      setLoading(false);
      return;
    }
    try {
      const user: Member = JSON.parse(saved);
      fetch(`${API_BASE}/members`)
        .then((r) => r.json())
        .then((members: Member[]) => {
          const valid = members.find((m) => m.id === user.id);
          if (valid) {
            setCurrentUser(valid);
            localStorage.setItem("taskflow_user", JSON.stringify(valid));
            return getBoards();
          } else {
            localStorage.removeItem("taskflow_user");
            return Promise.resolve([]);
          }
        })
        .then((b) => {
          setBoards(b);
          if (b.length > 0) setActiveBoardId(b[0].id);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } catch {
      localStorage.removeItem("taskflow_user");
      setLoading(false);
    }
  }, []);

  // Load board data when board changes
  useEffect(() => {
    if (!activeBoardId) {
      setColumns([]);
      setTasks([]);
      setSprints([]);
      setActiveSprint(null);
      return;
    }
    Promise.all([
      getColumns(activeBoardId),
      getTasks(activeBoardId),
      getSprints(activeBoardId),
      getMembers(),
    ]).then(([cols, tks, spr, mem]) => {
      setColumns(cols);
      setTasks(tks);
      setSprints(spr);
      setMembers(mem);
      const active = spr.find((s) => s.active);
      setActiveSprint(active ?? spr[0] ?? null);
    });
  }, [activeBoardId]);

  const refreshBoards = () => {
    getBoards()
      .then((b) => setBoards(b))
      .catch(() => {});
  };

  const handleReorderColumns = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex || !activeBoardId) return;
      const newCols = [...columns];
      const [moved] = newCols.splice(fromIndex, 1);
      newCols.splice(toIndex, 0, moved);
      setColumns(newCols);
      try {
        await reorderColumns(
          activeBoardId,
          newCols.map((c) => c.id),
        );
        refreshBoards();
      } catch {}
    },
    [columns, activeBoardId],
  );

  const moveTask = async (taskId: string, direction: "next" | "prev") => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const ci = columns.findIndex((c) => c.id === task.column_id);
    const targetCol = columns[ci + (direction === "next" ? 1 : -1)];
    if (!targetCol) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, column_id: targetCol.id } : t,
      ),
    );
    try {
      await updateTask(taskId, { column_id: targetCol.id });
      refreshBoards();
    } catch {}
  };

  const addTask = async (taskData: {
    title: string;
    description: string;
    priority: "alta" | "média" | "baixa";
    assignee_id: string | null;
    column_id: string;
    story_points: number;
  }) => {
    if (!activeBoardId) return;
    try {
      await createTask(activeBoardId, taskData as any);
      setNewTaskColumnId(null);
      refreshBoards();
    } catch {}
  };

  const handleCreateBoard = async (name: string) => {
    try {
      const board = await createBoard(name);
      setActiveBoardId(board.id);
      setShowNewBoard(false);
    } catch {}
  };

  const handleDeleteBoard = async (id: string) => {
    setConfirmModal({
      message: "Deletar este board?",
      type: "confirm",
      onConfirm: async () => {
        try {
          await deleteBoard(id);
          setBoards((prev) => prev.filter((b) => b.id !== id));
          if (activeBoardId === id) {
            const remaining = boards.filter((b) => b.id !== id);
            setActiveBoardId(remaining[0]?.id ?? null);
          }
        } catch {}
        setConfirmModal(null);
      },
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      refreshBoards();
    } catch {}
  };

  const handleCreateColumn = async (name: string, color: string) => {
    if (!activeBoardId) return;
    try {
      await createColumn(activeBoardId, name, color);
      // The server auto-sets the new column as done_column; refresh the board
      const updatedBoard = await (
        await fetch(`${API_BASE}/boards/${activeBoardId}`)
      ).json();
      setBoards((prev) =>
        prev.map((b) =>
          b.id === activeBoardId
            ? { ...b, done_column_id: updatedBoard.done_column_id }
            : b,
        ),
      );
      setShowNewColumn(false);
    } catch {}
  };

  const handleDeleteColumn = async (columnId: string) => {
    const colTasks = tasks.filter((t) => t.column_id === columnId);
    if (colTasks.length > 0) {
      setConfirmModal({
        message:
          "Não é possível deletar uma coluna que contém tarefas. Mova ou delete as tarefas primeiro.",
        type: "alert",
        onConfirm: () => setConfirmModal(null),
      });
      return;
    }
    setConfirmModal({
      message: "Deletar esta coluna?",
      type: "confirm",
      onConfirm: async () => {
        try {
          const boardId = activeBoardId!;
          await deleteColumn(columnId);
          setColumns((prev) => prev.filter((c) => c.id !== columnId));
          const updatedBoard = await (
            await fetch(`${API_BASE}/boards/${boardId}`)
          ).json();
          setBoards((prev) =>
            prev.map((b) =>
              b.id === boardId
                ? { ...b, done_column_id: updatedBoard.done_column_id }
                : b,
            ),
          );
        } catch {}
        setConfirmModal(null);
      },
    });
  };

  const doneColId = activeBoard?.done_column_id;
  const done = tasks.filter((t) => t.column_id === doneColId).length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const totalPts = tasks.reduce((s, t) => s + t.story_points, 0);
  const doneTasks = tasks.filter((t) => t.column_id === doneColId);
  const donePts = doneTasks.reduce((s, t) => s + t.story_points, 0);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: C.bg,
        }}
      >
        <div style={{ color: C.muted, fontSize: 14 }}>Carregando boards…</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginPage
        onLogin={(user) => {
          localStorage.setItem("taskflow_user", JSON.stringify(user));
          setCurrentUser(user);
          setLoading(true);
          getBoards()
            .then((b) => {
              setBoards(b);
              if (b.length > 0) setActiveBoardId(b[0].id);
              setLoading(false);
            })
            .catch(() => setLoading(false));
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: C.bg,
        overflow: "hidden",
      }}
    >
      {/* ── Sidebar ── */}
      <aside
        className="app-sidebar"
        style={{
          width: isMobile ? 240 : 220,
          background: C.sidebar,
          borderRight: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          ...(isMobile
            ? {
                position: "fixed",
                top: 0,
                left: 0,
                bottom: 0,
                zIndex: 50,
                transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
                boxShadow: sidebarOpen ? "0 0 40px rgba(0,0,0,0.6)" : "none",
              }
            : {}),
        }}
      >
        <div
          style={{
            padding: "18px 16px 12px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: C.accentBg,
                border: `1px solid ${C.accent}33`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              ⊞
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                TaskFlow
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: C.muted,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                PostgreSQL
              </div>
            </div>
          </div>
        </div>

        {/* boards list */}
        <div
          style={{
            padding: "14px 14px 8px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: C.muted,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Boards
            </span>
            <button
              onClick={() => setShowNewBoard(true)}
              style={{
                background: "none",
                border: "none",
                color: C.accent,
                fontSize: 16,
                cursor: "pointer",
                lineHeight: 1,
              }}
              title="Novo board"
            >
              +
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {boards.map((b) => {
              const boardPct =
                b.total_points > 0
                  ? Math.round((b.done_points / b.total_points) * 100)
                  : 0;
              return (
                <div key={b.id} style={{ position: "relative" }}>
                  <button
                    onClick={() => {
                      setActiveBoardId(b.id);
                      setSidebarOpen(false);
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      width: "100%",
                      padding: "7px 26px 7px 10px",
                      borderRadius: 7,
                      background: activeBoardId === b.id ? C.accentBg : "none",
                      border:
                        activeBoardId === b.id
                          ? `1px solid ${C.accent}33`
                          : "1px solid transparent",
                      color: activeBoardId === b.id ? C.accent : C.muted,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      textAlign: "left" as const,
                    }}
                  >
                    <span>{b.name}</span>
                    {b.total_tasks > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 3,
                        }}
                      >
                        <div
                          style={{
                            background: C.border,
                            borderRadius: 2,
                            height: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${boardPct}%`,
                              height: "100%",
                              background: boardPct === 100 ? C.green : C.accent,
                              borderRadius: 2,
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 9,
                            color: C.muted,
                          }}
                        >
                          {b.done_points}pt / {b.total_points}pt
                        </span>
                      </div>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBoard(b.id);
                    }}
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      background: "none",
                      border: "none",
                      color: C.muted,
                      fontSize: 11,
                      cursor: "pointer",
                      padding: "2px",
                      lineHeight: 1,
                      opacity: 0.5,
                      transition: "opacity 0.15s, color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.color = C.red;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "0.5";
                      e.currentTarget.style.color = C.muted;
                    }}
                    title="Deletar board"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* sprint info */}
        {activeSprint && (
          <div
            style={{
              padding: "14px 14px 12px",
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>
                {activeSprint.name}
              </span>
              {activeSprint.active && (
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: C.green,
                    background: "rgba(16,185,129,0.12)",
                    border: "1px solid rgba(16,185,129,0.3)",
                    borderRadius: 3,
                    padding: "1px 5px",
                  }}
                >
                  ATIVO
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 11,
                color: C.muted,
                marginBottom: 8,
                lineHeight: 1.4,
              }}
            >
              {activeSprint.start_date} – {activeSprint.end_date}
            </div>
            <div
              style={{
                background: C.border,
                borderRadius: 3,
                height: 4,
                overflow: "hidden",
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: C.accent,
                  borderRadius: 3,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color: C.muted,
                }}
              >
                {pct}% concluído
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color: C.muted,
                }}
              >
                {donePts}/{totalPts}pt
              </span>
            </div>
          </div>
        )}

        {/* team */}
        <div
          style={{ padding: "12px 14px", borderTop: `1px solid ${C.border}` }}
        >
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 10,
            }}
          >
            Time ({members.filter((m) => m.online).length} online)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {members.map((m) => (
              <div
                key={m.id}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <Avatar initials={m.avatar} online={m.online} size={24} />
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: m.online ? C.text : C.muted,
                    }}
                  >
                    {m.name.split(" ")[0]}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted }}>{m.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* current user */}
        <div
          style={{ padding: "12px 14px", borderTop: `1px solid ${C.border}` }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <Avatar initials={currentUser.avatar} online={true} size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.text,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {currentUser.name}
              </div>
              <div style={{ fontSize: 10, color: C.muted }}>
                {currentUser.role}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("taskflow_user");
              setCurrentUser(null);
              setBoards([]);
              setColumns([]);
              setTasks([]);
              setMembers([]);
              setSprints([]);
              setActiveSprint(null);
              setActiveBoardId(null);
            }}
            style={{
              width: "100%",
              padding: "7px",
              border: `1px solid ${C.border2}`,
              borderRadius: 7,
              background: "none",
              color: C.muted,
              fontSize: 11,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = C.red;
              e.currentTarget.style.color = C.red;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.border2;
              e.currentTarget.style.color = C.muted;
            }}
          >
            Sair
          </button>
        </div>
      </aside>

      {isMobile && (
        <div
          className={`sidebar-overlay${sidebarOpen ? " open" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main ── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {boards.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 40, opacity: 0.3 }}>⊞</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
              Nenhum board criado
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>
              Crie um board para começar a organizar suas tarefas
            </div>
            <button
              onClick={() => setShowNewBoard(true)}
              style={{
                padding: "10px 20px",
                background: C.accent,
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Criar Board
            </button>
          </div>
        ) : (
          <>
            <div
              style={{
                padding: "0 24px",
                height: 54,
                borderBottom: `1px solid ${C.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, overflow: "hidden" }}>
                {isMobile && (
                  <button
                    className="hamburger"
                    aria-label="Menu"
                    onClick={() => setSidebarOpen((v) => !v)}
                  >
                    {sidebarOpen ? "✕" : "☰"}
                  </button>
                )}
                <span className="app-board-title" style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
                  Kanban Board
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: C.muted,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {activeBoard?.name ?? "—"} · {tasks.length} tarefas
                </span>
                {totalPts > 0 && (
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      color: donePts === totalPts ? C.green : C.accent,
                      background:
                        donePts === totalPts
                          ? "rgba(16,185,129,0.12)"
                          : C.accentBg,
                      border: `1px solid ${donePts === totalPts ? "rgba(16,185,129,0.3)" : C.accent + "33"}`,
                      borderRadius: 4,
                      padding: "1px 6px",
                    }}
                  >
                    {donePts}/{totalPts}pt
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex" }}>
                  {members
                    .filter((m) => m.online)
                    .map((m) => (
                      <div key={m.id} style={{ marginLeft: -6 }}>
                        <Avatar initials={m.avatar} size={26} />
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div
              className="board-scroll"
              style={{
                flex: 1,
                overflowX: "auto",
                overflowY: "hidden",
                padding: "20px 24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  height: "100%",
                  minWidth: "max-content",
                }}
              >
                {columns.map((col, colIdx) => {
                  const colTasks = tasks
                    .filter((t) => t.column_id === col.id)
                    .sort((a, b) => a.position - b.position);
                  const isDragOver =
                    dropColIndex === colIdx &&
                    dragColIndex !== null &&
                    dragColIndex !== colIdx;
                  return (
                    <div
                      key={col.id}
                      draggable
                      onDragStart={() => setDragColIndex(colIdx)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDropColIndex(colIdx);
                      }}
                      onDragLeave={() => setDropColIndex(null)}
                      onDrop={() => {
                        setDropColIndex(null);
                        if (dragColIndex !== null)
                          handleReorderColumns(dragColIndex, colIdx);
                        setDragColIndex(null);
                      }}
                      onDragEnd={() => {
                        setDragColIndex(null);
                        setDropColIndex(null);
                      }}
                      style={{
                        width: 272,
                        flexShrink: 0,
                        display: "flex",
                        flexDirection: "column",
                        background: C.panel,
                        borderRadius: 12,
                        border: `1px solid ${isDragOver ? C.accent : C.border}`,
                        maxHeight: "calc(100vh - 130px)",
                        opacity: dragColIndex === colIdx ? 0.5 : 1,
                        transition: "border-color 0.15s, opacity 0.15s",
                      }}
                    >
                      <div
                        style={{
                          padding: "12px 14px",
                          borderBottom: `1px solid ${C.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: col.color,
                              display: "inline-block",
                            }}
                          />
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: C.text,
                            }}
                          >
                            {col.name}
                          </span>
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 11,
                              color: col.color,
                              background: col.color + "18",
                              borderRadius: 4,
                              padding: "1px 6px",
                            }}
                          >
                            {colTasks.length}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 10,
                              color: C.muted,
                            }}
                          >
                            {colTasks.reduce((s, t) => s + t.story_points, 0)}pt
                          </span>
                          {activeBoard?.done_column_id === col.id && (
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 9,
                                color: C.green,
                                background: "rgba(16,185,129,0.12)",
                                border: "1px solid rgba(16,185,129,0.3)",
                                borderRadius: 3,
                                padding: "1px 5px",
                              }}
                            >
                              DONE
                            </span>
                          )}
                          <button
                            onClick={() => handleDeleteColumn(col.id)}
                            style={{
                              background: "none",
                              border: "none",
                              color: C.muted,
                              cursor: "pointer",
                              fontSize: 12,
                              padding: "0 2px",
                              opacity: 0.6,
                              transition: "opacity 0.15s, color 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = "1";
                              e.currentTarget.style.color = C.red;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = "0.6";
                              e.currentTarget.style.color = C.muted;
                            }}
                            title="Deletar coluna"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      <div
                        style={{
                          padding: "10px 10px 0",
                          overflowY: "auto",
                          flex: 1,
                        }}
                      >
                        {colTasks.map((t) => (
                          <TaskCard
                            key={t.id}
                            task={t}
                            columns={columns}
                            onMove={moveTask}
                            onOpen={setOpenTask}
                          />
                        ))}
                      </div>
                      <div style={{ padding: "8px 10px 10px", flexShrink: 0 }}>
                        <button
                          onClick={() => setNewTaskColumnId(col.id)}
                          style={{
                            width: "100%",
                            background: "none",
                            border: `1px dashed ${C.border2}`,
                            borderRadius: 8,
                            padding: "8px",
                            color: C.muted,
                            fontSize: 12,
                            cursor: "pointer",
                            transition: "border-color 0.15s, color 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = C.accent;
                            e.currentTarget.style.color = C.accent;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = C.border2;
                            e.currentTarget.style.color = C.muted;
                          }}
                        >
                          + Adicionar tarefa
                        </button>
                      </div>
                    </div>
                  );
                })}
                {/* Add column button */}
                <div style={{ width: 272, flexShrink: 0 }}>
                  <button
                    onClick={() => setShowNewColumn(true)}
                    style={{
                      width: "100%",
                      padding: "40px 20px",
                      background: "none",
                      border: `2px dashed ${C.border2}`,
                      borderRadius: 12,
                      color: C.muted,
                      fontSize: 13,
                      cursor: "pointer",
                      transition: "border-color 0.15s, color 0.15s",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = C.accent;
                      e.currentTarget.style.color = C.accent;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = C.border2;
                      e.currentTarget.style.color = C.muted;
                    }}
                  >
                    <span style={{ fontSize: 20 }}>+</span>
                    <span>Adicionar coluna</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {openTask && (
        <TaskModal
          task={openTask}
          columns={columns}
          onClose={() => setOpenTask(null)}
          onMove={moveTask}
          onDelete={handleDeleteTask}
          onConfirm={(msg, type, fn) =>
            setConfirmModal({
              message: msg,
              type,
              onConfirm: () => {
                fn();
                setConfirmModal(null);
              },
            })
          }
        />
      )}
      {newTaskColumnId && (
        <NewTaskModal
          columnId={newTaskColumnId}
          columns={columns}
          members={members}
          onClose={() => setNewTaskColumnId(null)}
          onSave={addTask}
        />
      )}
      {showNewBoard && (
        <NewBoardModal
          onClose={() => setShowNewBoard(false)}
          onSave={handleCreateBoard}
        />
      )}
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          type={confirmModal.type}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
      {showNewColumn && (
        <NewColumnModal
          onClose={() => setShowNewColumn(false)}
          onSave={handleCreateColumn}
        />
      )}
    </div>
  );
}
