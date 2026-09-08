import { useState } from "react";
import Layout from "../../components/Layout.jsx";
import api from "../../api/axios.js";

export default function ManualUpload() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const downloadSample = async () => {
    const res = await api.get("/manual-queries/sample", { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "manual-query-upload-sample.xlsx");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setError("");
    setResult(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/manual-queries/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout title="Manual Query Upload" subtitle="Bulk-import customer queries or FAQs from Excel, no chatbot flow required">
      <div className="card" style={{ maxWidth: 560 }}>
        <h3>1. Download the template</h3>
        <p className="helper-text" style={{ margin: "8px 0 14px" }}>
          Columns: customerName, contactNumber, email, language, message
        </p>
        <button className="btn btn-outline" onClick={downloadSample}>
          Download sample .xlsx
        </button>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <h3>2. Upload your file</h3>
        <form onSubmit={handleUpload} style={{ marginTop: 14 }}>
          <div className="field">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          {result && <p className="helper-text">{result.message}</p>}
          <button className="btn btn-primary" type="submit" disabled={!file || uploading}>
            {uploading ? "Uploading…" : "Upload queries"}
          </button>
        </form>
      </div>
    </Layout>
  );
}
