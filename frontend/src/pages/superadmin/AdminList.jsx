import { useEffect, useState } from "react";
import Layout from "../../components/Layout.jsx";
import Modal from "../../components/Modal.jsx";
import Loader from "../../components/Loader.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import api from "../../api/axios.js";

const ACCESS_INFO = [
  { key: "chatbot", label: "Chatbot creation", desc: "Build & publish Product/Overall chatbots" },
  { key: "voiceChatbot", label: "AI Voice Chatbot", desc: "Use the voice (TTS) engine for chatbots" },
  { key: "manualQueryUpload", label: "Manual query upload", desc: "Bulk-upload queries via Excel" },
];

const EMPTY_FORM = {
  name: "",
  company: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  access: { chatbot: true, voiceChatbot: false, manualQueryUpload: false },
};

export default function AdminList() {
  const [admins, setAdmins] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [accessTarget, setAccessTarget] = useState(null); // admin being edited
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/superadmin/admins").then((res) => setAdmins(res.data.data));

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/superadmin/admins", form);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create admin");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (admin) => {
    const nextStatus = admin.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await api.put(`/superadmin/admins/${admin._id}/status`, { status: nextStatus });
    load();
  };

  const toggleAccess = async (admin, key) => {
    const updated = { ...admin.access, [key]: !admin.access[key] };
    await api.put(`/superadmin/admins/${admin._id}/access`, updated);
    const refreshed = { ...admin, access: updated };
    setAccessTarget(refreshed);
    load();
  };

  return (
    <Layout
      title="Admins & Activation"
      subtitle="Create admins, activate/deactivate accounts, and grant feature access"
      actions={
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Create Admin
        </button>
      }
    >
      {!admins ? (
        <Loader />
      ) : admins.length === 0 ? (
        <div className="card empty-state">
          <h3>No admins yet</h3>
          <p>Create your first admin to start building chatbots.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Username</th>
                <th>Access</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin._id}>
                  <td>
                    <strong>{admin.name}</strong>
                    <div className="helper-text">{admin.company}</div>
                  </td>
                  <td className="mono">{admin.username}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {ACCESS_INFO.map(
                        (a) =>
                          admin.access?.[a.key] && (
                            <span key={a.key} className="badge badge-active">
                              {a.label}
                            </span>
                          )
                      )}
                      {!admin.access?.chatbot && !admin.access?.voiceChatbot && !admin.access?.manualQueryUpload && (
                        <span className="helper-text">No access granted</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={admin.status} />
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setAccessTarget(admin)}>
                        Manage access
                      </button>
                      <button
                        className={admin.status === "ACTIVE" ? "btn btn-danger btn-sm" : "btn btn-outline btn-sm"}
                        onClick={() => toggleStatus(admin)}
                      >
                        {admin.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="Create Admin" onClose={() => setShowCreate(false)} width={480}>
          <form onSubmit={handleCreate}>
            <div className="field-row">
              <div className="field">
                <label>Full name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Company</label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)" }}>Feature access</label>
            <div className="card" style={{ marginTop: 8, marginBottom: 4, padding: "6px 14px" }}>
              {ACCESS_INFO.map((a) => (
                <div className="toggle-row" key={a.key}>
                  <div>
                    <div className="toggle-label">{a.label}</div>
                    <div className="toggle-desc">{a.desc}</div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={form.access[a.key]}
                      onChange={(e) =>
                        setForm({ ...form, access: { ...form.access, [a.key]: e.target.checked } })
                      }
                    />
                    <span className="track"></span>
                  </label>
                </div>
              ))}
            </div>

            {error && <p className="error-text">{error}</p>}

            <button className="btn btn-primary" type="submit" style={{ width: "100%", marginTop: 12 }} disabled={saving}>
              {saving ? "Creating…" : "Create Admin"}
            </button>
          </form>
        </Modal>
      )}

      {accessTarget && (
        <Modal title={`Access — ${accessTarget.name}`} onClose={() => setAccessTarget(null)} width={420}>
          <p className="helper-text" style={{ marginBottom: 14 }}>
            Toggle which features this admin can use. Changes apply immediately.
          </p>
          {ACCESS_INFO.map((a) => (
            <div className="toggle-row" key={a.key}>
              <div>
                <div className="toggle-label">{a.label}</div>
                <div className="toggle-desc">{a.desc}</div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={!!accessTarget.access[a.key]}
                  onChange={() => toggleAccess(accessTarget, a.key)}
                />
                <span className="track"></span>
              </label>
            </div>
          ))}
        </Modal>
      )}
    </Layout>
  );
}
