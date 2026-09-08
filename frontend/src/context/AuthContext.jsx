import { createContext, useContext, useState } from "react";
import api from "../api/axios.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("cms_user");
    return stored ? JSON.parse(stored) : null;
  });

  const loginSuperAdmin = async (username, password) => {
    const { data } = await api.post("/auth/superadmin/login", { username, password });
    persist(data);
  };

  const loginAdmin = async (username, password) => {
    const { data } = await api.post("/auth/admin/login", { username, password });
    persist(data);
  };

  const persist = (data) => {
    localStorage.setItem("cms_token", data.token);
    localStorage.setItem("cms_user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("cms_token");
    localStorage.removeItem("cms_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loginSuperAdmin, loginAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
