import { useEffect, useState } from "react";
import Layout from "../../components/Layout.jsx";
import Modal from "../../components/Modal.jsx";
import Loader from "../../components/Loader.jsx";
import api from "../../api/axios.js";

export default function Products() {
  const [products, setProducts] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/products").then((res) => setProducts(res.data.data));

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/products", form);
      setShowCreate(false);
      setForm({ name: "", description: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create product");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this product?")) return;
    await api.delete(`/products/${id}`);
    load();
  };

  return (
    <Layout
      title="Products"
      subtitle="Products you can build a dedicated Product Chatbot for"
      actions={
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Add Product
        </button>
      }
    >
      {!products ? (
        <Loader />
      ) : products.length === 0 ? (
        <div className="card empty-state">
          <h3>No products yet</h3>
          <p>Add a product to create a Product Chatbot for it.</p>
        </div>
      ) : (
        <div className="stat-grid">
          {products.map((p) => (
            <div className="card" key={p._id}>
              <h3>{p.name}</h3>
              <p className="helper-text" style={{ marginTop: 6 }}>{p.description || "No description"}</p>
              <button className="btn btn-danger btn-sm" style={{ marginTop: 14 }} onClick={() => remove(p._id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="Add Product" onClose={() => setShowCreate(false)} width={420}>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>Product name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary" type="submit" style={{ width: "100%" }} disabled={saving}>
              {saving ? "Saving…" : "Add Product"}
            </button>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
