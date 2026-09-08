import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";

import Login from "./pages/auth/Login.jsx";

import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard.jsx";
import AdminList from "./pages/superadmin/AdminList.jsx";

import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import Products from "./pages/admin/Products.jsx";
import Queries from "./pages/admin/Queries.jsx";
import ManualUpload from "./pages/admin/ManualUpload.jsx";
import ChatbotList from "./pages/admin/chatbot/ChatbotList.jsx";
import ChatbotBuilder from "./pages/admin/chatbot/ChatbotBuilder.jsx";

import BotWidget from "./widget/BotWidget.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      {/* Public — consumed via the generated link / QR / API */}
      <Route path="/bot/:slug" element={<BotWidget />} />

      {/* Superadmin */}
      <Route
        path="/superadmin/dashboard"
        element={
          <ProtectedRoute role="SUPER_ADMIN">
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/admins"
        element={
          <ProtectedRoute role="SUPER_ADMIN">
            <AdminList />
          </ProtectedRoute>
        }
      />

      {/* Admin */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/chatbots"
        element={
          <ProtectedRoute role="ADMIN">
            <ChatbotList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/chatbots/:id"
        element={
          <ProtectedRoute role="ADMIN">
            <ChatbotBuilder />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/products"
        element={
          <ProtectedRoute role="ADMIN">
            <Products />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/queries"
        element={
          <ProtectedRoute role="ADMIN">
            <Queries />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/manual-upload"
        element={
          <ProtectedRoute role="ADMIN">
            <ManualUpload />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
