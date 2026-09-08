import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// Brand mark: a literal branching question tree (A/B/C/D -> sub-options),
// echoing the actual product mechanic instead of a generic logo glyph.
function BrandMark() {
  return (
    <svg className="sidebar-brand-mark" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="6" r="3.4" fill="#8f86e8" />
      <path d="M16 9.4V13" stroke="#8f86e8" strokeWidth="1.6" />
      <path d="M16 13 L7 18 M16 13 L25 18" stroke="#8f86e8" strokeWidth="1.6" />
      <circle cx="7" cy="20.2" r="2.6" fill="#14b8a6" />
      <circle cx="25" cy="20.2" r="2.6" fill="#14b8a6" />
      <path d="M7 22.6V25 M25 22.6V25" stroke="#8f86e8" strokeWidth="1.4" />
      <circle cx="4.5" cy="27" r="1.8" fill="#e2a63b" />
      <circle cx="9.5" cy="27" r="1.8" fill="#e2a63b" />
      <circle cx="22.5" cy="27" r="1.8" fill="#e2a63b" />
      <circle cx="27.5" cy="27" r="1.8" fill="#e2a63b" />
    </svg>
  );
}

const SUPERADMIN_LINKS = [
  { to: "/superadmin/dashboard", label: "Dashboard" },
  { to: "/superadmin/admins", label: "Admins & Activation" },
];

const ADMIN_LINKS = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/chatbots", label: "Chatbots" },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/queries", label: "Queries" },
  { to: "/admin/manual-upload", label: "Manual Upload" },
];

export default function Layout({ children, title, subtitle, actions }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user?.role === "SUPER_ADMIN" ? SUPERADMIN_LINKS : ADMIN_LINKS;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <BrandMark />
          <div className="sidebar-brand-text">
            Chatbot CMS
            <span>Flow Builder</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-link" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <span className="topbar-role">{user?.role === "SUPER_ADMIN" ? "Superadmin" : "Admin"}</span>
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{user?.name}</span>
        </header>

        <div className="content">
          {(title || actions) && (
            <div className="content-header">
              <div>
                {title && <h1>{title}</h1>}
                {subtitle && <p className="subtitle">{subtitle}</p>}
              </div>
              {actions && <div style={{ display: "flex", gap: 10 }}>{actions}</div>}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
