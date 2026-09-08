import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../../components/Layout.jsx";
import Modal from "../../../components/Modal.jsx";
import Loader from "../../../components/Loader.jsx";
import StatusBadge from "../../../components/StatusBadge.jsx";
import api from "../../../api/axios.js";

export default function ChatbotList() {
  const [chatbots, setChatbots] = useState(null);
  const [products, setProducts] = useState([]);
  const [access, setAccess] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", type: "overall", product: "", mode: "normal" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const load = () => api.get("/chatbots").then((res) => setChatbots(res.data.data));

  useEffect(() => {
    load();
    api.get("/products").then((res) => setProducts(res.data.data));
    api.get("/admin/dashboard").then((res) => setAccess(res.data.data.access));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = { name: form.name, type: form.type, mode: form.mode };
      if (form.type === "product") payload.product = form.product;
      const res = await api.post("/chatbots", payload);
      setShowCreate(false);
      navigate(`/admin/chatbots/${res.data.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Could not create chatbot");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout
      title="Chatbots"
      subtitle="Build Product or Overall chatbots, then generate a link, QR, and API key"
      actions={
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New Chatbot
        </button>
      }
    >
      {!chatbots ? (
        <Loader />
      ) : chatbots.length === 0 ? (
        <div className="card empty-state">
          <h3>No chatbots yet</h3>
          <p>Create your first chatbot to start building its question flow.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Display</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {chatbots.map((bot) => (
                <tr key={bot._id} style={{ cursor: "pointer" }} onClick={() => navigate(`/admin/chatbots/${bot._id}`)}>
                  <td>
                    <strong>{bot.name}</strong>
                    {bot.product?.name && <div className="helper-text">{bot.product.name}</div>}
                  </td>
                  <td style={{ textTransform: "capitalize" }}>{bot.type}</td>
                  <td>
                    <span className={`badge ${bot.mode === "voice" ? "badge-active" : "badge-new"}`}>
                      {bot.mode === "voice" ? "AI Voice" : "Normal"}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={bot.status} />
                  </td>
                  <td>
                    {bot.status === "published" ? (
                      <span className="badge badge-new">
                        {bot.displayMode === "widget" ? "🌐 Website Widget" : "🖥️ Full Screen"}
                      </span>
                    ) : (
                      <span className="helper-text">—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-outline btn-sm">Open →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="New Chatbot" onClose={() => setShowCreate(false)} width={440}>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>Chatbot name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="field">
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="overall">Overall Chatbot</option>
                <option value="product">Product Chatbot</option>
              </select>
            </div>

            {form.type === "product" && (
              <div className="field">
                <label>Product</label>
                <select
                  value={form.product}
                  onChange={(e) => setForm({ ...form, product: e.target.value })}
                  required
                >
                  <option value="">Select a product…</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {products.length === 0 && (
                  <p className="helper-text">No products yet — add one from the Products page first.</p>
                )}
              </div>
            )}

            <div className="field">
              <label>Engine</label>
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                <option value="normal">Normal (text chatbot)</option>
                <option value="voice" disabled={!access?.voiceChatbot}>
                  AI Voice Chatbot {access && !access.voiceChatbot ? "(access required)" : ""}
                </option>
              </select>
            </div>

            {error && <p className="error-text">{error}</p>}

            <button className="btn btn-primary" type="submit" style={{ width: "100%" }} disabled={saving}>
              {saving ? "Creating…" : "Create & Build Flow"}
            </button>
          </form>
        </Modal>
      )}
    </Layout>
  );
}