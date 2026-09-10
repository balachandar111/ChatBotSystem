import { useEffect, useState } from "react";
import Layout from "../../components/Layout.jsx";
import StatCard from "../../components/StatCard.jsx";
import Loader from "../../components/Loader.jsx";
import api from "../../api/axios.js";

const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN || "geninuety.com";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [subdomainInput, setSubdomainInput] = useState("");
  const [subdomainSaving, setSubdomainSaving] = useState(false);
  const [subdomainMsg, setSubdomainMsg] = useState("");
  const [subdomainErr, setSubdomainErr] = useState("");

  const load = () =>
    api.get("/admin/dashboard").then((res) => {
      setData(res.data.data);
      setSubdomainInput(res.data.data.subdomain || "");
    });

  useEffect(() => {
    load();
  }, []);

  // Saves (or clears, if blank) the subdomain shared by ALL of this
  // admin's chatbots, e.g. "muthuwinss" -> every bot they publish becomes
  // reachable at https://muthuwinss.geninuety.com/bot/<slug>. Already
  // published bots have their public link/QR refreshed on the server
  // immediately — see adminController.updateSubdomain.
  const saveSubdomain = async () => {
    setSubdomainSaving(true);
    setSubdomainMsg("");
    setSubdomainErr("");
    try {
      const res = await api.put("/admin/subdomain", { subdomain: subdomainInput.trim().toLowerCase() });
      setSubdomainInput(res.data.data.subdomain || "");
      setSubdomainMsg(res.data.data.subdomain ? "Subdomain saved." : "Subdomain removed.");
      load(); // refresh stats too, harmless
    } catch (err) {
      setSubdomainErr(err.response?.data?.message || "Could not save subdomain");
    } finally {
      setSubdomainSaving(false);
      setTimeout(() => setSubdomainMsg(""), 4000);
    }
  };

  return (
    <Layout title="Dashboard" subtitle="Your chatbots and queries at a glance">
      {!data ? (
        <Loader />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Total Chatbots" value={data.totalChatbots} />
            <StatCard label="Published" value={data.publishedChatbots} tone="accent" />
            <StatCard label="Draft" value={data.draftChatbots} tone="amber" />
            <StatCard label="Product Bots" value={data.productChatbots} />
            <StatCard label="Overall Bots" value={data.overallChatbots} />
            <StatCard label="New Queries" value={data.newQueries} tone="amber" />
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 10 }}>Your access</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className={`badge ${data.access.chatbot ? "badge-active" : "badge-inactive"}`}>
                Chatbot creation
              </span>
              <span className={`badge ${data.access.voiceChatbot ? "badge-active" : "badge-inactive"}`}>
                AI Voice Chatbot
              </span>
              <span className={`badge ${data.access.manualQueryUpload ? "badge-active" : "badge-inactive"}`}>
                Manual query upload
              </span>
            </div>
            <p className="helper-text" style={{ marginTop: 10 }}>
              Access is granted by your Superadmin. Contact them if you need a feature enabled.
            </p>
          </div>

          <div className="card" style={{ maxWidth: 560 }}>
            <h3 style={{ marginBottom: 4 }}>Your subdomain</h3>
            <p className="helper-text" style={{ marginBottom: 14 }}>
              Set one subdomain for your whole account, e.g. <strong>muthuwinss.{BASE_DOMAIN}</strong>. Every
              chatbot you publish will then be reachable at{" "}
              <span className="mono">muthuwinss.{BASE_DOMAIN}/bot/&lt;slug&gt;</span> — each bot still gets its
              own link under the same subdomain, told apart the same way as before. Leave blank and save to
              remove it.
            </p>
            <div className="field">
              <label>Subdomain</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  value={subdomainInput}
                  onChange={(e) => setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="e.g. muthuwinss"
                  className="mono"
                  style={{ flex: 1 }}
                />
                <span className="helper-text" style={{ whiteSpace: "nowrap" }}>
                  .{BASE_DOMAIN}
                </span>
                <button className="btn btn-primary btn-sm" onClick={saveSubdomain} disabled={subdomainSaving}>
                  {subdomainSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
            {subdomainErr && (
              <p className="error-text" style={{ marginTop: 8 }}>
                {subdomainErr}
              </p>
            )}
            {subdomainMsg && (
              <p className="helper-text" style={{ marginTop: 8 }}>
                {subdomainMsg}
              </p>
            )}
            {data.subdomain && (
              <p className="helper-text" style={{ marginTop: 8 }}>
                Open any of your chatbots' Publish &amp; Share tab to copy its full link, e.g.{" "}
                <span className="mono">
                  https://{data.subdomain}.{BASE_DOMAIN}/bot/...
                </span>
                .
              </p>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}