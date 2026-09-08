import { useState } from "react";
import api from "../api/axios.js";

/**
 * Renders a "form" flow node: whatever fields the Admin defined for this
 * node (text/number/tel/email/date/textarea/file), submits them (+ any
 * files) to the public query endpoint, then hands control back to the
 * parent so it can advance to `node.formNext`.
 */
export default function DynamicForm({ node, slug, sessionId, language, path, onSubmitted }) {
  const fields = node.formFields || [];
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.filter((f) => f.fieldType !== "file").map((f) => [f.key, ""]))
  );
  const [files, setFiles] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const setValue = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));
  const setFile = (key, file) => setFiles((prev) => ({ ...prev, [key]: file }));

  const submit = async (e) => {
    e.preventDefault();

    for (const f of fields) {
      if (!f.required) continue;
      const missing = f.fieldType === "file" ? !files[f.key] : !values[f.key];
      if (missing) {
        setError(`"${f.label}" is required`);
        return;
      }
    }

    setSending(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("sessionId", sessionId);
      formData.append("language", language);
      formData.append("path", JSON.stringify(path));
      formData.append(
        "fieldsMeta",
        JSON.stringify(fields.map((f) => ({ key: f.key, label: f.label, fieldType: f.fieldType })))
      );

      fields.forEach((f) => {
        if (f.fieldType === "file") {
          if (files[f.key]) formData.append(f.key, files[f.key]);
        } else if (values[f.key]) {
          formData.append(f.key, values[f.key]);
        }
      });

      await api.post(`/public/bots/${slug}/queries`, formData);

      const summary = fields
        .filter((f) => f.fieldType !== "file" && values[f.key])
        .map((f) => values[f.key])
        .join(" | ");

      onSubmitted(node.formNext, summary || "(details submitted)");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="widget-form widget-dynamic-form" onSubmit={submit}>
      <div className="widget-form-title">{node.text ? "Tell us more" : "Details"}</div>

      {fields.map((f) => (
        <label key={f.key} className="widget-dynamic-field">
          <span>
            {f.label}
            {f.required && <span className="widget-required-star"> *</span>}
          </span>

          {f.fieldType === "textarea" ? (
            <textarea
              rows={3}
              placeholder={f.placeholder}
              value={values[f.key] || ""}
              onChange={(e) => setValue(f.key, e.target.value)}
            />
          ) : f.fieldType === "file" ? (
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(f.key, e.target.files?.[0] || null)}
            />
          ) : (
            <input
              type={f.fieldType || "text"}
              placeholder={f.placeholder}
              value={values[f.key] || ""}
              onChange={(e) => setValue(f.key, e.target.value)}
            />
          )}
        </label>
      ))}

      {error && <div className="widget-error">{error}</div>}

      <button type="submit" disabled={sending}>
        {sending ? "Sending…" : node.formSubmitLabel || "Submit"}
      </button>
    </form>
  );
}