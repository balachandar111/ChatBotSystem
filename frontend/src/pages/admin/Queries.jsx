import { useEffect, useState } from "react";
import Layout from "../../components/Layout.jsx";
import Loader from "../../components/Loader.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import api from "../../api/axios.js";

const MODE_LABEL = { normal: "Normal", voice: "AI Voice" };

/*
|--------------------------------------------------------------------------
| Card grid
|--------------------------------------------------------------------------
| Landing view of the Queries section: one card per chatbot, plus a
| "Manual Uploads" card, each showing how many customer queries have come
| in. Clicking a card drills into that chatbot's own query table.
*/
function ChatbotCard({ bot, onOpen }) {
  return (
    <div className="chatbot-card" onClick={onOpen}>
      <div className="chatbot-card-top">
        <div>
          <h3>{bot.name}</h3>
          <div className="chatbot-card-badges">
            <span className="badge badge-new" style={{ textTransform: "capitalize" }}>
              {bot.type}
            </span>
            <span className={`badge ${bot.mode === "voice" ? "badge-active" : "badge-new"}`}>
              {MODE_LABEL[bot.mode] || bot.mode}
            </span>
            <StatusBadge status={bot.status} />
          </div>
        </div>
      </div>

      <div>
        <div className="chatbot-card-count">{bot.queryCount}</div>
        <div className="chatbot-card-count-label">
          {bot.queryCount === 1 ? "Query received" : "Queries received"}
        </div>
      </div>

      <div className="chatbot-card-footer">
        <span className="helper-text">
          {bot.lastQueryAt ? `Last: ${new Date(bot.lastQueryAt).toLocaleString()}` : "No queries yet"}
        </span>
        <span className="btn btn-outline btn-sm">View →</span>
      </div>
    </div>
  );
}

function ManualCard({ manual, onOpen }) {
  return (
    <div className="chatbot-card" onClick={onOpen}>
      <div className="chatbot-card-top">
        <div>
          <h3>Manual Uploads</h3>
          <div className="chatbot-card-badges">
            <span className="badge badge-draft">Not chatbot-driven</span>
          </div>
        </div>
      </div>

      <div>
        <div className="chatbot-card-count">{manual.queryCount}</div>
        <div className="chatbot-card-count-label">
          {manual.queryCount === 1 ? "Query received" : "Queries received"}
        </div>
      </div>

      <div className="chatbot-card-footer">
        <span className="helper-text">
          {manual.lastQueryAt ? `Last: ${new Date(manual.lastQueryAt).toLocaleString()}` : "No queries yet"}
        </span>
        <span className="btn btn-outline btn-sm">View →</span>
      </div>
    </div>
  );
}

function CardsView({ overview, onOpenChatbot, onOpenManual }) {
  if (!overview) return <Loader />;

  const { chatbots, manual } = overview;

  if (chatbots.length === 0 && manual.queryCount === 0) {
    return (
      <div className="card empty-state">
        <h3>No chatbots yet</h3>
        <p>Create a chatbot and add a "form" step to its flow to start collecting customer queries.</p>
      </div>
    );
  }

  return (
    <div className="chatbot-card-grid">
      {chatbots.map((bot) => (
        <ChatbotCard key={bot._id} bot={bot} onOpen={() => onOpenChatbot(bot)} />
      ))}
      {manual.queryCount > 0 && <ManualCard manual={manual} onOpen={onOpenManual} />}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Per-chatbot query table
|--------------------------------------------------------------------------
| Columns are 100% dynamic: whatever fields the Admin defined on that
| chatbot's "form" flow node (name, contact, problem, img/file, ...) are
| the only columns shown — one column per field, populated from each
| customer submission's formResponses/attachments.
*/
function renderFileCell(query, col) {
  const att = (query.attachments || []).find((a) => a.key === col.key);
  if (!att) return <span className="helper-text">—</span>;

  const isImage = /\.(jpe?g|png|gif|webp|bmp|avif)(\?|$)/i.test(att.url);
  return (
    <a href={att.url} target="_blank" rel="noreferrer" className="query-file-link">
      {isImage ? (
        <img src={att.url} alt={att.label || col.label} className="query-file-thumb" />
      ) : (
        "View file"
      )}
    </a>
  );
}

function renderTextCell(query, col) {
  const fr = (query.formResponses || []).find((f) => f.key === col.key);
  return fr?.value || <span className="helper-text">—</span>;
}

function DynamicChatbotTable({ chatbot, columns, queries, statusFilter, setStatusFilter, updateStatus }) {
  return (
    <>
      <div className="card" style={{ marginBottom: 18, display: "flex", gap: 14 }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {queries.length === 0 ? (
        <div className="card empty-state">
          <h3>No queries yet</h3>
          <p>Once a customer fills in {chatbot.name}'s form, their details will show up here.</p>
        </div>
      ) : columns.length === 0 ? (
        <div className="card empty-state">
          <h3>No form fields defined</h3>
          <p>Add a "form" step to this chatbot's flow (Chatbots → Build Flow) to start collecting structured details.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
                <th>Received</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {queries.map((q) => (
                <tr key={q._id}>
                  {columns.map((col) => (
                    <td key={col.key} style={{ maxWidth: 220 }}>
                      {col.type === "file" ? renderFileCell(q, col) : renderTextCell(q, col)}
                    </td>
                  ))}
                  <td className="helper-text">{new Date(q.createdAt).toLocaleString()}</td>
                  <td>
                    <select
                      value={q.status}
                      onChange={(e) => updateStatus(q._id, e.target.value)}
                      style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px" }}
                    >
                      <option value="new">New</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/*
|--------------------------------------------------------------------------
| Manual-upload table
|--------------------------------------------------------------------------
| Manually uploaded queries aren't tied to a chatbot's flow, so they keep
| the original fixed columns (name/contact/email/message/attachment).
*/
function ManualQueriesTable({ queries, statusFilter, setStatusFilter, updateStatus }) {
  return (
    <>
      <div className="card" style={{ marginBottom: 18, display: "flex", gap: 14 }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {queries.length === 0 ? (
        <div className="card empty-state">
          <h3>No manual queries yet</h3>
          <p>Queries added from the Manual Upload page will show up here.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Message</th>
                <th>Attachment</th>
                <th>Received</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {queries.map((q) => (
                <tr key={q._id}>
                  <td>
                    <strong>{q.customerName || "—"}</strong>
                    <div className="helper-text">{q.contactNumber || q.email || ""}</div>
                  </td>
                  <td style={{ maxWidth: 260 }}>{q.message || "—"}</td>
                  <td>
                    {q.attachmentUrl ? (
                      <a href={q.attachmentUrl} target="_blank" rel="noreferrer">
                        View file
                      </a>
                    ) : (
                      <span className="helper-text">—</span>
                    )}
                  </td>
                  <td className="helper-text">{new Date(q.createdAt).toLocaleString()}</td>
                  <td>
                    <select
                      value={q.status}
                      onChange={(e) => updateStatus(q._id, e.target.value)}
                      style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px" }}
                    >
                      <option value="new">New</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function Queries() {
  const [overview, setOverview] = useState(null);

  // selected === null -> card grid. selected === { kind: "chatbot", bot } or { kind: "manual" }
  const [selected, setSelected] = useState(null);
  const [columns, setColumns] = useState([]);
  const [queries, setQueries] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");

  const loadOverview = () => api.get("/queries/overview").then((res) => setOverview(res.data.data));

  useEffect(() => {
    loadOverview();
  }, []);

  const openChatbot = async (bot) => {
    setSelected({ kind: "chatbot", bot });
    setColumns([]);
    setQueries(null);
    setStatusFilter("");
    const colsRes = await api.get(`/queries/columns/${bot._id}`);
    setColumns(colsRes.data.data.columns);
  };

  const openManual = () => {
    setSelected({ kind: "manual" });
    setQueries(null);
    setStatusFilter("");
  };

  const backToCards = () => {
    setSelected(null);
    setQueries(null);
    setColumns([]);
    loadOverview();
  };

  useEffect(() => {
    if (!selected) return;
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (selected.kind === "chatbot") {
      params.chatbot = selected.bot._id;
    } else {
      params.source = "manual";
    }
    api.get("/queries", { params }).then((res) => setQueries(res.data.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, statusFilter]);

  const updateStatus = async (id, status) => {
    await api.patch(`/queries/${id}/status`, { status });
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (selected.kind === "chatbot") params.chatbot = selected.bot._id;
    else params.source = "manual";
    const res = await api.get("/queries", { params });
    setQueries(res.data.data);
  };

  if (!selected) {
    return (
      <Layout title="Queries" subtitle="Pick a chatbot to see the customer details it has collected">
        <CardsView overview={overview} onOpenChatbot={openChatbot} onOpenManual={openManual} />
      </Layout>
    );
  }

  const title = selected.kind === "chatbot" ? selected.bot.name : "Manual Uploads";
  const subtitle =
    selected.kind === "chatbot"
      ? "Customer submissions for this chatbot's form"
      : "Queries added manually from the Manual Upload page";

  return (
    <Layout title={title} subtitle={subtitle}>
      <button className="query-back-btn" onClick={backToCards}>
        ← All chatbots
      </button>

      {queries === null ? (
        <Loader />
      ) : selected.kind === "chatbot" ? (
        <DynamicChatbotTable
          chatbot={selected.bot}
          columns={columns}
          queries={queries}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          updateStatus={updateStatus}
        />
      ) : (
        <ManualQueriesTable
          queries={queries}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          updateStatus={updateStatus}
        />
      )}
    </Layout>
  );
}