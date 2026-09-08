import { useEffect, useState } from "react";
import Layout from "../../components/Layout.jsx";
import StatCard from "../../components/StatCard.jsx";
import Loader from "../../components/Loader.jsx";
import api from "../../api/axios.js";

export default function SuperAdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/superadmin/dashboard").then((res) => setData(res.data.data));
  }, []);

  return (
    <Layout title="Dashboard" subtitle="Platform-wide overview">
      {!data ? (
        <Loader />
      ) : (
        <div className="stat-grid">
          <StatCard label="Total Admins" value={data.totalAdmins} />
          <StatCard label="Active Admins" value={data.activeAdmins} tone="accent" />
          <StatCard label="Inactive Admins" value={data.inactiveAdmins} />
          <StatCard label="Total Chatbots" value={data.totalChatbots} />
          <StatCard label="Published Chatbots" value={data.publishedChatbots} tone="accent" />
          <StatCard label="Total Queries" value={data.totalQueries} tone="amber" />
        </div>
      )}
    </Layout>
  );
}
