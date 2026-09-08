import { useState } from "react";
import api from "../api/axios.js";

export default function QueryForm({ slug, sessionId, language, path, onSubmitted }) {
  const [form, setForm] = useState({ customerName: "", contactNumber: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await api.post(`/public/bots/${slug}/queries`, { sessionId, language, path, ...form });
      setSent(true);
      onSubmitted?.();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return <p className="widget-thanks">Thanks — we've received your query.</p>;
  }

  return (
    <form className="widget-form" onSubmit={submit}>
      <input
        type="text"
        placeholder="Your name"
        value={form.customerName}
        onChange={(e) => setForm({ ...form, customerName: e.target.value })}
      />
      <input
        type="tel"
        placeholder="Contact number"
        value={form.contactNumber}
        onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
      />
      <textarea
        rows={2}
        placeholder="Anything else to add? (optional)"
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
      />

      {error && <div className="widget-error">{error}</div>}

      <button type="submit" disabled={sending}>
        {sending ? "Sending…" : "Submit"}
      </button>
    </form>
  );
}