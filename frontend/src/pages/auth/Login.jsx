import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

function BrandMarkLarge() {
  return (
    <svg width="46" height="46" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="6" r="3.4" fill="#3b3486" />
      <path d="M16 9.4V13" stroke="#3b3486" strokeWidth="1.6" />
      <path d="M16 13 L7 18 M16 13 L25 18" stroke="#3b3486" strokeWidth="1.6" />
      <circle cx="7" cy="20.2" r="2.6" fill="#14b8a6" />
      <circle cx="25" cy="20.2" r="2.6" fill="#14b8a6" />
      <path d="M7 22.6V25 M25 22.6V25" stroke="#3b3486" strokeWidth="1.4" />
      <circle cx="4.5" cy="27" r="1.8" fill="#e2a63b" />
      <circle cx="9.5" cy="27" r="1.8" fill="#e2a63b" />
      <circle cx="22.5" cy="27" r="1.8" fill="#e2a63b" />
      <circle cx="27.5" cy="27" r="1.8" fill="#e2a63b" />
    </svg>
  );
}

export default function Login() {
  const [role, setRole] = useState("ADMIN");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { loginSuperAdmin, loginAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (role === "SUPER_ADMIN") {
        await loginSuperAdmin(username, password);
        navigate("/superadmin/dashboard");
      } else {
        await loginAdmin(username, password);
        navigate("/admin/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <div className="card" style={{ width: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <BrandMarkLarge />
          <div>
            <h2>Chatbot CMS</h2>
            <p className="helper-text">Sign in to manage your chatbots</p>
          </div>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={"tab-btn" + (role === "ADMIN" ? " active" : "")}
            onClick={() => setRole("ADMIN")}
          >
            Admin
          </button>
          <button
            type="button"
            className={"tab-btn" + (role === "SUPER_ADMIN" ? " active" : "")}
            onClick={() => setRole("SUPER_ADMIN")}
          >
            Superadmin
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <button className="btn btn-primary" type="submit" style={{ width: "100%", marginTop: 6 }} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
