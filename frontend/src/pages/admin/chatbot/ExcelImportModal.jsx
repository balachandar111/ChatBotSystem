import { useState } from "react";
import Modal from "../../../components/Modal.jsx";
import api from "../../../api/axios.js";

/*
|--------------------------------------------------------------------------
| ExcelImportModal
|--------------------------------------------------------------------------
| Lets an Admin build (or bulk-edit) a chatbot's whole question tree in a
| spreadsheet instead of clicking through node-by-node:
|   1. Download a starter template (or export what they already built)
|   2. Fill in / edit the sheets in Excel / Google Sheets
|   3. Upload it back here — it REPLACES the bot's current saved flow
|
| Parsing + validation happens on the server (utils/flowExcel.js +
| chatbotController.validateFlow) using the exact same rules as the visual
| builder, so a bad file is rejected with a specific, row-referenced error
| instead of silently producing a broken bot.
*/
export default function ExcelImportModal({ chatbotId, hasExistingFlow, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(!hasExistingFlow);

  const downloadBlob = async (url, filename) => {
    const res = await api.get(url, { responseType: "blob" });
    const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  };

  const downloadTemplate = async () => {
    setError("");
    try {
      await downloadBlob("/chatbots/flow-template", "chatbot-flow-template.xlsx");
    } catch (err) {
      setError("Could not download the template");
    }
  };

  const exportCurrent = async () => {
    setError("");
    try {
      await downloadBlob(`/chatbots/${chatbotId}/flow/export-excel`, "current-flow.xlsx");
    } catch (err) {
      setError(err.response?.data?.message || "Could not export the current flow");
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(`/chatbots/${chatbotId}/flow/import-excel`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onImported(res.data.data, res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Could not import this file");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Build flow from Excel" onClose={onClose} width={620}>
      <div>
        <p className="helper-text" style={{ marginBottom: 16 }}>
          Prefer a spreadsheet over clicking through nodes one at a time? Fill in questions, options, product
          cards, steps, and form fields in Excel, then upload the file here to build the whole flow at once.
        </p>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            padding: 14,
            background: "var(--surface-sunken)",
            borderRadius: "var(--radius-md)",
            marginBottom: 18,
          }}
        >
          <div style={{ flex: "1 1 220px" }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>1. Get a spreadsheet</div>
            <div className="helper-text" style={{ marginBottom: 10 }}>
              New to this? Start from a worked example. Already built something? Export it and edit in bulk.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-outline btn-sm" onClick={downloadTemplate} type="button">
                📥 Download template
              </button>
              {hasExistingFlow && (
                <button className="btn btn-outline btn-sm" onClick={exportCurrent} type="button">
                  📤 Export current flow
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>2. Upload your filled-in file</div>
          <label
            className="card"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "26px 16px",
              border: "1.5px dashed var(--border)",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: 24 }}>📄</span>
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>
              {fileName || "Click to choose a .xlsx or .xls file"}
            </span>
            <span className="helper-text">Sheets: Nodes, Options, Products, Steps, FormFields</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                setFileName(f?.name || "");
                setError("");
              }}
            />
          </label>
        </div>

        {hasExistingFlow && (
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, marginBottom: 16 }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: 2 }} />
            <span>
              I understand this <strong>replaces the entire flow</strong> currently in the builder (all languages). This
              only affects the editor until you click <strong>Save Flow</strong> / re-generate.
            </span>
          </label>
        )}

        {error && (
          <p
            className="error-text"
            style={{ marginBottom: 14, whiteSpace: "pre-wrap", background: "var(--danger-soft)", padding: "10px 12px", borderRadius: 8 }}
          >
            {error}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-outline" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleImport} disabled={!file || !confirmed || busy} type="button">
            {busy ? "Importing…" : "Import & build flow"}
          </button>
        </div>
      </div>
    </Modal>
  );
}