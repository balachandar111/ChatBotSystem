import { useEffect, useState } from "react";
import Layout from "../../components/Layout.jsx";
import StatCard from "../../components/StatCard.jsx";
import Loader from "../../components/Loader.jsx";
import api from "../../api/axios.js";

export default function AdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/admin/dashboard").then((res) => setData(res.data.data));
  }, []);

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
        </>
      )}
    </Layout>
  );
}
