import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../../../components/Layout.jsx";
import Loader from "../../../components/Loader.jsx";
import api from "../../../api/axios.js";
import ThemeSetter from "./ThemeSetter.jsx";
import FlowMap from "./FlowMap.jsx";
import ExcelImportModal from "./ExcelImportModal.jsx";

const LANG_LABEL = { english: "English", tamil: "Tamil" };
const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "tel", label: "Phone number" },
  { value: "email", label: "Email" },
  { value: "date", label: "Date" },
  { value: "textarea", label: "Description (multi-line)" },
  { value: "file", label: "Image / File upload" },
];

function blankMessageNode() {
  return { nodeType: "message", text: "", options: [], isEnd: false };
}

function blankFlowForLang() {
  return { start: "Q1", questions: { Q1: blankMessageNode() } };
}

// Builds the editor's { [language]: { start, questions } } state straight
// from a chatbot document returned by the API — used on initial load AND
// after an Excel import, so both paths land on identical shapes.
function buildFlowState(bot) {
  const initFlow = {};
  (bot.languages || ["english", "tamil"]).forEach((l) => {
    initFlow[l] = bot.flow?.[l] || blankFlowForLang();
  });
  return initFlow;
}

function nextNodeKey(questions) {
  let n = 1;
  while (questions[`Q${n}`]) n++;
  return `Q${n}`;
}

function slugifyKey(label, existingKeys) {
  let base = (label || "field")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
  if (!base) base = "field";
  let key = base;
  let i = 2;
  while (existingKeys.includes(key)) {
    key = `${base}_${i++}`;
  }
  return key;
}

export default function ChatbotBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [chatbot, setChatbot] = useState(null);
  const [flow, setFlow] = useState({});
  const [lang, setLang] = useState("english");
  const [tab, setTab] = useState("build");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [genError, setGenError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [uploadingFor, setUploadingFor] = useState(null); // `${nodeKey}:${productIdx}` while an image upload is in flight
  const [displayMode, setDisplayMode] = useState("fullscreen"); // asked right before publish — see Publish & Share tab
  // True whenever the flow in this editor has edits that haven't been sent
  // to the server yet. Generating/re-generating from a bot that's live in
  // another tab while edits sit unsaved here is exactly how a node someone
  // just built (e.g. an Instruction Steps node) can look perfect on screen
  // but never actually reach customers — see persistFlow() below, which
  // closes that gap by always saving before publishing.
  const [dirty, setDirty] = useState(false);

  const [buildView, setBuildView] = useState("map"); // "map" (visual overview) or "list" (node-by-node editing)
  const [showExcelModal, setShowExcelModal] = useState(false);
  const nodeRefs = useRef({});

  useEffect(() => {
    api.get(`/chatbots/${id}`).then((res) => {
      const bot = res.data.data;
      setChatbot(bot);
      setFlow(buildFlowState(bot));
      setLang(bot.languages?.[0] || "english");
      setDisplayMode(bot.displayMode || "fullscreen");
    });
  }, [id]);

  // Flow Map -> click a node -> jump to List view, scrolled to that card.
  const jumpToNode = (key) => {
    setBuildView("list");
    requestAnimationFrame(() => {
      setTimeout(() => {
        nodeRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "center" });
        nodeRefs.current[key]?.classList.add("flowmap-jump-highlight");
        setTimeout(() => nodeRefs.current[key]?.classList.remove("flowmap-jump-highlight"), 1600);
      }, 60);
    });
  };

  const handleExcelImported = (updatedBot, message) => {
    setChatbot((prev) => ({ ...prev, ...updatedBot }));
    setFlow(buildFlowState(updatedBot));
    setDirty(false);
    setShowExcelModal(false);
    setSaveMsg(message || "Flow imported from Excel.");
    setTimeout(() => setSaveMsg(""), 5000);
  };

  if (!chatbot) {
    return (
      <Layout title="Loading chatbot…">
        <Loader />
      </Layout>
    );
  }

  const languageFlow = flow[lang] || blankFlowForLang();
  const questions = languageFlow.questions || {};

  const updateLangFlow = (updater) => {
    setFlow((prev) => ({ ...prev, [lang]: updater(prev[lang] || blankFlowForLang()) }));
    setDirty(true);
  };

  const addNode = () => {
    updateLangFlow((lf) => {
      const key = nextNodeKey(lf.questions);
      return { ...lf, questions: { ...lf.questions, [key]: blankMessageNode() } };
    });
  };

  const removeNode = (key) => {
    updateLangFlow((lf) => {
      const questions = { ...lf.questions };
      delete questions[key];
      // clear any reference pointing at the removed node (message options,
      // products "Continue" button, or form "next" node)
      Object.values(questions).forEach((n) => {
        if (n.options) n.options = n.options.map((o) => (o.next === key ? { ...o, next: "" } : o));
        if (n.productsNext === key) n.productsNext = null;
        if (n.formNext === key) n.formNext = null;
        if (n.stepsNext === key) n.stepsNext = null;
      });
      // If the deleted node was the current start, don't just grab
      // whatever key happens to sit first in the object (that can easily
      // be a closing/"Thank you…" node, which silently made the bot open
      // on the goodbye message instead of the first question — the exact
      // Tamil-section bug reported). Prefer the first remaining node that
      // can actually ask something (a "message" node that isn't an end),
      // and only fall back to "any node at all" if there's truly nothing
      // else, flagging it so the Admin notices and fixes it before publish.
      let start = lf.start;
      if (lf.start === key) {
        const remainingKeys = Object.keys(questions);
        const askableKey = remainingKeys.find((k) => {
          const n = questions[k];
          return (n.nodeType || "message") === "message" && !n.isEnd;
        });
        start = askableKey || remainingKeys[0] || "";
        if (start && start !== askableKey) {
          setSaveMsg(
            `Heads up: the start question was deleted, so "${start}" was picked as the new start — please check it in the Start dropdown before publishing.`
          );
          setTimeout(() => setSaveMsg(""), 8000);
        }
      }
      return { ...lf, questions, start };
    });
  };

  const updateNode = (key, patch) => {
    updateLangFlow((lf) => ({
      ...lf,
      questions: { ...lf.questions, [key]: { ...lf.questions[key], ...patch } },
    }));
  };

  const setNodeType = (key, nodeType) => {
    updateLangFlow((lf) => {
      const existing = lf.questions[key];
      const base = { text: existing.text || "", isEnd: false };
      let node;
      if (nodeType === "message") {
        node = { ...base, nodeType, options: existing.options?.length ? existing.options : [] };
      } else if (nodeType === "products") {
        node = { ...base, nodeType, products: existing.products?.length ? existing.products : [], productsNext: null };
      } else if (nodeType === "steps") {
        node = { ...base, nodeType, steps: existing.steps?.length ? existing.steps : [], stepsNext: null };
      } else {
        node = { ...base, nodeType, formFields: existing.formFields?.length ? existing.formFields : [], formSubmitLabel: "Submit", formNext: null };
      }
      return { ...lf, questions: { ...lf.questions, [key]: node } };
    });
  };

  // ---- message-node options ----
  const addOption = (key) => {
    updateLangFlow((lf) => {
      const node = lf.questions[key];
      const nextLabelChar = String.fromCharCode(65 + (node.options?.length || 0)); // A, B, C...
      return {
        ...lf,
        questions: {
          ...lf.questions,
          [key]: { ...node, options: [...(node.options || []), { label: nextLabelChar, text: "", next: "", url: "" }] },
        },
      };
    });
  };

  const updateOption = (key, idx, patch) => {
    updateLangFlow((lf) => {
      const node = lf.questions[key];
      const options = node.options.map((o, i) => (i === idx ? { ...o, ...patch } : o));
      return { ...lf, questions: { ...lf.questions, [key]: { ...node, options } } };
    });
  };

  const removeOption = (key, idx) => {
    updateLangFlow((lf) => {
      const node = lf.questions[key];
      const options = node.options.filter((_, i) => i !== idx);
      return { ...lf, questions: { ...lf.questions, [key]: { ...node, options } } };
    });
  };

  // ---- products-node cards ----
  const addProduct = (key) => {
    updateLangFlow((lf) => {
      const node = lf.questions[key];
      const products = [
        ...(node.products || []),
        { image: "", title: "", description: "", buttonText: "View", redirectUrl: "" },
      ];
      return { ...lf, questions: { ...lf.questions, [key]: { ...node, products } } };
    });
  };

  const updateProduct = (key, idx, patch) => {
    updateLangFlow((lf) => {
      const node = lf.questions[key];
      const products = node.products.map((p, i) => (i === idx ? { ...p, ...patch } : p));
      return { ...lf, questions: { ...lf.questions, [key]: { ...node, products } } };
    });
  };

  const removeProduct = (key, idx) => {
    updateLangFlow((lf) => {
      const node = lf.questions[key];
      const products = node.products.filter((_, i) => i !== idx);
      return { ...lf, questions: { ...lf.questions, [key]: { ...node, products } } };
    });
  };

  const uploadProductImage = async (key, idx, file) => {
    setUploadingFor(`${key}:${idx}`);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await api.post("/chatbots/upload-image", form);
      updateProduct(key, idx, { image: res.data.data.url });
    } catch (err) {
      alert(err.response?.data?.message || "Image upload failed");
    } finally {
      setUploadingFor(null);
    }
  };

  // ---- steps-node instruction cards ----
  const addStep = (key) => {
    updateLangFlow((lf) => {
      const node = lf.questions[key];
      const steps = [...(node.steps || []), { image: "", title: "", desc: "" }];
      return { ...lf, questions: { ...lf.questions, [key]: { ...node, steps } } };
    });
  };

  const updateStep = (key, idx, patch) => {
    updateLangFlow((lf) => {
      const node = lf.questions[key];
      const steps = node.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s));
      return { ...lf, questions: { ...lf.questions, [key]: { ...node, steps } } };
    });
  };

  const removeStep = (key, idx) => {
    updateLangFlow((lf) => {
      const node = lf.questions[key];
      const steps = node.steps.filter((_, i) => i !== idx);
      return { ...lf, questions: { ...lf.questions, [key]: { ...node, steps } } };
    });
  };

  const moveStep = (key, idx, dir) => {
    updateLangFlow((lf) => {
      const node = lf.questions[key];
      const steps = [...node.steps];
      const target = idx + dir;
      if (target < 0 || target >= steps.length) return lf;
      [steps[idx], steps[target]] = [steps[target], steps[idx]];
      return { ...lf, questions: { ...lf.questions, [key]: { ...node, steps } } };
    });
  };

  const uploadStepImage = async (key, idx, file) => {
    setUploadingFor(`${key}:step:${idx}`);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await api.post("/chatbots/upload-image", form);
      updateStep(key, idx, { image: res.data.data.url });
    } catch (err) {
      alert(err.response?.data?.message || "Image upload failed");
    } finally {
      setUploadingFor(null);
    }
  };

  const uploadClosingImage = async (key, file) => {
    setUploadingFor(`${key}:closing`);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await api.post("/chatbots/upload-image", form);
      updateNode(key, { closingImage: res.data.data.url });
    } catch (err) {
      alert(err.response?.data?.message || "Image upload failed");
    } finally {
      setUploadingFor(null);
    }
  };

  // ---- form-node dynamic fields ----
  const addFormField = (key) => {
    updateLangFlow((lf) => {
      const node = lf.questions[key];
      const existingKeys = (node.formFields || []).map((f) => f.key);
      const fieldKey = slugifyKey(`field${existingKeys.length + 1}`, existingKeys);
      const formFields = [
        ...(node.formFields || []),
        { key: fieldKey, label: "", fieldType: "text", required: false, placeholder: "" },
      ];
      return { ...lf, questions: { ...lf.questions, [key]: { ...node, formFields } } };
    });
  };

  const updateFormField = (key, idx, patch) => {
    updateLangFlow((lf) => {
      const node = lf.questions[key];
      const formFields = node.formFields.map((f, i) => {
        if (i !== idx) return f;
        const updated = { ...f, ...patch };
        // keep the internal key roughly in sync with the label, but stable
        // and unique, unless the admin explicitly typed a custom key
        if (patch.label !== undefined && !patch.key) {
          const otherKeys = node.formFields.filter((_, j) => j !== idx).map((x) => x.key);
          updated.key = slugifyKey(patch.label, otherKeys);
        }
        return updated;
      });
      return { ...lf, questions: { ...lf.questions, [key]: { ...node, formFields } } };
    });
  };

  const removeFormField = (key, idx) => {
    updateLangFlow((lf) => {
      const node = lf.questions[key];
      const formFields = node.formFields.filter((_, i) => i !== idx);
      return { ...lf, questions: { ...lf.questions, [key]: { ...node, formFields } } };
    });
  };

  const setStart = (key) => updateLangFlow((lf) => ({ ...lf, start: key }));

  // Single source of truth for pushing the in-editor `flow` state to the
  // server. Both the manual "Save Flow" button and "Generate"/"Re-generate"
  // go through this, so it's impossible for Generate to publish an older
  // saved flow while the editor shows newer, unsaved edits.
  const persistFlow = async () => {
    const res = await api.put(`/chatbots/${id}/flow`, { flow });
    setChatbot(res.data.data);
    setDirty(false);
    return res.data.data;
  };

  const saveFlow = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      await persistFlow();
      setSaveMsg("Flow saved.");
    } catch (err) {
      setSaveMsg(err.response?.data?.message || "Could not save flow");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(""), 4000);
    }
  };

  const generate = async () => {
    setGenerating(true);
    setGenError("");
    try {
      // Always save first: guarantees the published bot matches exactly
      // what's on screen, even if the admin forgot to hit "Save Flow"
      // after adding/editing a node (this is what previously let a newly
      // added Instruction Steps node look fine in the builder while the
      // live bot kept serving the older, already-published flow).
      await persistFlow();
      const res = await api.post(`/chatbots/${id}/generate`, { displayMode });
      setChatbot((prev) => ({ ...prev, ...res.data.data }));
      setTab("publish");
    } catch (err) {
      setGenError(err.response?.data?.message || "Could not generate chatbot");
    } finally {
      setGenerating(false);
    }
  };

  const copy = (text) => navigator.clipboard.writeText(text);

  const otherNodeKeys = (excludeKey) => Object.keys(questions).filter((k) => k !== excludeKey);

  return (
    <Layout
      title={chatbot.name}
      subtitle={`${chatbot.type === "product" ? "Product" : "Overall"} chatbot · ${chatbot.mode === "voice" ? "AI Voice engine" : "Normal engine"}`}
      actions={
        <>
          <button className="btn btn-outline" onClick={() => navigate("/admin/chatbots")}>
            ← Back
          </button>
          <button className="btn btn-primary" onClick={saveFlow} disabled={saving}>
            {saving ? "Saving…" : dirty ? "Save Flow •" : "Save Flow"}
          </button>
        </>
      }
    >
      <div className="tabs">
        <button className={"tab-btn" + (tab === "build" ? " active" : "")} onClick={() => setTab("build")}>
          Flow Builder
        </button>
        <button className={"tab-btn" + (tab === "theme" ? " active" : "")} onClick={() => setTab("theme")}>
          Theme
        </button>
        <button className={"tab-btn" + (tab === "publish" ? " active" : "")} onClick={() => setTab("publish")}>
          Publish &amp; Share
        </button>
      </div>

      {saveMsg && <p className="helper-text" style={{ marginBottom: 14 }}>{saveMsg}</p>}

      {dirty && !saveMsg && (
        <p
          className="helper-text"
          style={{
            marginBottom: 14,
            color: "#8a6100",
            background: "#fff6dc",
            border: "1px solid #f0dca0",
            borderRadius: 8,
            padding: "8px 12px",
          }}
        >
          You have unsaved changes. Customers won't see them until you click{" "}
          <strong>Save Flow</strong>{chatbot.status === "published" ? " and then Re-generate" : ""}.
        </p>
      )}

      {tab === "build" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div className="tabs" style={{ borderBottom: "none", marginBottom: 0 }}>
              {(chatbot.languages || ["english", "tamil"]).map((l) => (
                <button
                  key={l}
                  className={"tab-btn" + (lang === l ? " active" : "")}
                  onClick={() => setLang(l)}
                  style={{ marginRight: 12 }}
                >
                  {LANG_LABEL[l] || l}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className="view-toggle">
                <button
                  type="button"
                  className={"view-toggle-btn" + (buildView === "map" ? " active" : "")}
                  onClick={() => setBuildView("map")}
                >
                  🗺️ Flow Map
                </button>
                <button
                  type="button"
                  className={"view-toggle-btn" + (buildView === "list" ? " active" : "")}
                  onClick={() => setBuildView("list")}
                >
                  🧱 Node List
                </button>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowExcelModal(true)}>
                📊 Build from Excel
              </button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="field-row" style={{ alignItems: "center" }}>
              <div className="field" style={{ marginBottom: 0, flex: "0 0 260px" }}>
                <label>Start question (first message shown)</label>
                <select value={languageFlow.start} onChange={(e) => setStart(e.target.value)}>
                  {Object.keys(questions).map((k) => (
                    <option key={k} value={k}>
                      {k} {questions[k].text ? `— ${questions[k].text.slice(0, 30)}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-outline btn-sm" style={{ marginLeft: "auto" }} onClick={addNode}>
                + Add Question Node
              </button>
            </div>
          </div>

          {buildView === "map" && (
            <div className="card" style={{ marginBottom: 16 }}>
              <FlowMap questions={questions} start={languageFlow.start} onSelectNode={jumpToNode} />
            </div>
          )}

          {buildView === "list" && Object.entries(questions).map(([key, node]) => {
            const nodeType = node.nodeType || "message";
            return (
              <div className="card" key={key} ref={(el) => (nodeRefs.current[key] = el)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <span className="badge badge-new">{key}</span>
                      {languageFlow.start === key && <span className="badge badge-active">Start</span>}
                      {nodeType === "message" && node.isEnd && <span className="badge badge-draft">End message</span>}

                      <select
                        value={nodeType}
                        onChange={(e) => setNodeType(key, e.target.value)}
                        style={{ marginLeft: "auto", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5 }}
                      >
                        <option value="message">💬 Message / Options</option>
                        <option value="products">🛒 Product list</option>
                        <option value="steps">📋 Instruction steps</option>
                        <option value="form">📝 Form</option>
                      </select>
                    </div>

                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>{nodeType === "message" ? "Question / message text" : "Heading text shown above this node"}</label>
                      <textarea
                        rows={2}
                        value={node.text}
                        onChange={(e) => updateNode(key, { text: e.target.value })}
                        placeholder="e.g. How can we help you?"
                      />
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeNode(key)}>
                    Delete node
                  </button>
                </div>

                {/* ---------------- MESSAGE NODE ---------------- */}
                {nodeType === "message" && (
                  <>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 10 }}>
                      <input
                        type="checkbox"
                        checked={node.isEnd}
                        onChange={(e) => updateNode(key, { isEnd: e.target.checked, options: e.target.checked ? [] : node.options })}
                      />
                      This is a final message (no further options)
                    </label>

                    {!node.isEnd && (
                      <>
                        {(node.options || []).map((opt, idx) => (
                          <div
                            key={idx}
                            style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 8, marginBottom: 8 }}
                          >
                            <div className="field-row" style={{ alignItems: "center", marginBottom: opt.url ? 6 : 0 }}>
                              <div style={{ flex: "0 0 56px" }}>
                                <input
                                  type="text"
                                  value={opt.label}
                                  onChange={(e) => updateOption(key, idx, { label: e.target.value })}
                                  placeholder="A"
                                  style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, width: "100%", textAlign: "center" }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={(e) => updateOption(key, idx, { text: e.target.value })}
                                  placeholder="Option text shown to the customer"
                                  style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, width: "100%" }}
                                />
                              </div>
                              <div style={{ flex: "0 0 190px" }}>
                                <select
                                  value={opt.next || ""}
                                  onChange={(e) => updateOption(key, idx, { next: e.target.value })}
                                  style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, width: "100%" }}
                                >
                                  <option value="">— leads to end reply —</option>
                                  {otherNodeKeys(key).map((k) => (
                                    <option key={k} value={k}>
                                      → {k}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button className="btn btn-ghost btn-sm" onClick={() => removeOption(key, idx)}>
                                ✕
                              </button>
                            </div>
                            <div className="field-row" style={{ alignItems: "center", marginLeft: 64 }}>
                              <input
                                type="text"
                                value={opt.url || ""}
                                onChange={(e) => updateOption(key, idx, { url: e.target.value })}
                                placeholder="🔗 Link URL (optional) — e.g. https://youtube.com/... — opens in a new tab when tapped"
                                style={{ padding: "7px 10px", border: "1px dashed var(--border)", borderRadius: 8, width: "100%", fontSize: 12.5 }}
                              />
                            </div>
                          </div>
                        ))}
                        <button className="btn btn-outline btn-sm" onClick={() => addOption(key)}>
                          + Add option
                        </button>
                        <p className="helper-text" style={{ marginTop: 8 }}>
                          Set "leads to" to move within the flow, a link URL to open an external page (YouTube, Instagram,
                          website, ...), or both — the link opens and the flow still advances.
                        </p>
                      </>
                    )}
                  </>
                )}

                {/* ---------------- PRODUCTS NODE ---------------- */}
                {nodeType === "products" && (
                  <>
                    {(node.products || []).map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          padding: 12,
                          marginBottom: 10,
                          display: "flex",
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: "0 0 96px" }}>
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={p.title || "Product"}
                              style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 96,
                                height: 96,
                                borderRadius: 8,
                                border: "1px dashed var(--border)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                color: "#94a3b8",
                                textAlign: "center",
                                padding: 4,
                              }}
                            >
                              No image
                            </div>
                          )}
                          <label className="btn btn-outline btn-sm" style={{ marginTop: 8, display: "block", textAlign: "center", cursor: "pointer" }}>
                            {uploadingFor === `${key}:${idx}` ? "Uploading…" : p.image ? "Change" : "Upload"}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) uploadProductImage(key, idx, file);
                              }}
                            />
                          </label>
                        </div>

                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                          <input
                            type="text"
                            value={p.title}
                            onChange={(e) => updateProduct(key, idx, { title: e.target.value })}
                            placeholder="Product title"
                            style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, width: "100%" }}
                          />
                          <textarea
                            rows={2}
                            value={p.description}
                            onChange={(e) => updateProduct(key, idx, { description: e.target.value })}
                            placeholder="Short description"
                            style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, width: "100%", fontFamily: "inherit" }}
                          />
                          <div className="field-row" style={{ alignItems: "center" }}>
                            <input
                              type="text"
                              value={p.buttonText}
                              onChange={(e) => updateProduct(key, idx, { buttonText: e.target.value })}
                              placeholder="Button text (e.g. View on Amazon)"
                              style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, flex: "0 0 220px" }}
                            />
                            <input
                              type="text"
                              value={p.redirectUrl}
                              onChange={(e) => updateProduct(key, idx, { redirectUrl: e.target.value })}
                              placeholder="Redirect link (https://...)"
                              style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, flex: 1 }}
                            />
                            <button className="btn btn-ghost btn-sm" onClick={() => removeProduct(key, idx)}>
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button className="btn btn-outline btn-sm" onClick={() => addProduct(key)} style={{ marginBottom: 12 }}>
                      + Add product
                    </button>

                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>After viewing products, continue to (optional)</label>
                      <select
                        value={node.productsNext || ""}
                        onChange={(e) => updateNode(key, { productsNext: e.target.value || null })}
                      >
                        <option value="">— end here —</option>
                        {otherNodeKeys(key).map((k) => (
                          <option key={k} value={k}>
                            → {k}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* ---------------- STEPS NODE (instruction cards) ---------------- */}
                {nodeType === "steps" && (
                  <>
                    <p className="helper-text" style={{ marginBottom: 10 }}>
                      Shown one at a time on the widget with Back / Next buttons and a progress dial — perfect for cooking,
                      setup, or usage instructions. Add as many steps as you like.
                    </p>
                    {(node.steps || []).map((s, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          padding: 12,
                          marginBottom: 10,
                          display: "flex",
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: "0 0 96px" }}>
                          {s.image ? (
                            <img
                              src={s.image}
                              alt={s.title || "Step"}
                              style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 96,
                                height: 96,
                                borderRadius: 8,
                                border: "1px dashed var(--border)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                color: "#94a3b8",
                                textAlign: "center",
                                padding: 4,
                              }}
                            >
                              No photo
                            </div>
                          )}
                          <label className="btn btn-outline btn-sm" style={{ marginTop: 8, display: "block", textAlign: "center", cursor: "pointer" }}>
                            {uploadingFor === `${key}:step:${idx}` ? "Uploading…" : s.image ? "Change" : "Upload"}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) uploadStepImage(key, idx, file);
                              }}
                            />
                          </label>
                        </div>

                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                          <div className="field-row" style={{ alignItems: "center" }}>
                            <span className="badge badge-new" style={{ flex: "0 0 auto" }}>
                              Step {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={s.title}
                              onChange={(e) => updateStep(key, idx, { title: e.target.value })}
                              placeholder="Step title (e.g. Wash & Soak)"
                              style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, flex: 1 }}
                            />
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => moveStep(key, idx, -1)}
                              disabled={idx === 0}
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => moveStep(key, idx, 1)}
                              disabled={idx === (node.steps.length - 1)}
                              title="Move down"
                            >
                              ↓
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => removeStep(key, idx)}>
                              ✕
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            value={s.desc}
                            onChange={(e) => updateStep(key, idx, { desc: e.target.value })}
                            placeholder="Step instructions shown to the customer"
                            style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, width: "100%", fontFamily: "inherit" }}
                          />
                        </div>
                      </div>
                    ))}
                    <button className="btn btn-outline btn-sm" onClick={() => addStep(key)} style={{ marginBottom: 12 }}>
                      + Add step
                    </button>

                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>Closing screen (shown after the customer taps "Finish" on the last step)</label>
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: "0 0 96px" }}>
                          {node.closingImage ? (
                            <img
                              src={node.closingImage}
                              alt="Closing screen"
                              style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 96,
                                height: 96,
                                borderRadius: 8,
                                border: "1px dashed var(--border)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                color: "#94a3b8",
                                textAlign: "center",
                                padding: 4,
                              }}
                            >
                              No photo
                            </div>
                          )}
                          <label className="btn btn-outline btn-sm" style={{ marginTop: 8, display: "block", textAlign: "center", cursor: "pointer" }}>
                            {uploadingFor === `${key}:closing` ? "Uploading…" : node.closingImage ? "Change" : "Upload"}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) uploadClosingImage(key, file);
                              }}
                            />
                          </label>
                        </div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                          <input
                            type="text"
                            value={node.closingTitle || ""}
                            onChange={(e) => updateNode(key, { closingTitle: e.target.value })}
                            placeholder='Closing title (optional) — defaults to "All done! 🎉"'
                            style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, width: "100%" }}
                          />
                          <textarea
                            rows={2}
                            value={node.closingMessage || ""}
                            onChange={(e) => updateNode(key, { closingMessage: e.target.value })}
                            placeholder='Closing message (optional) — defaults to "Thanks for following along."'
                            style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, width: "100%", fontFamily: "inherit" }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>After the last step, continue to (optional)</label>
                      <select
                        value={node.stepsNext || ""}
                        onChange={(e) => updateNode(key, { stepsNext: e.target.value || null })}
                      >
                        <option value="">— end here —</option>
                        {otherNodeKeys(key).map((k) => (
                          <option key={k} value={k}>
                            → {k}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* ---------------- FORM NODE ---------------- */}
                {nodeType === "form" && (
                  <>
                    {(node.formFields || []).map((f, idx) => (
                      <div
                        className="field-row"
                        key={idx}
                        style={{ alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}
                      >
                        <div style={{ flex: "1 1 220px" }}>
                          <input
                            type="text"
                            value={f.label}
                            onChange={(e) => updateFormField(key, idx, { label: e.target.value })}
                            placeholder="Field label (e.g. Your name)"
                            style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, width: "100%" }}
                          />
                        </div>
                        <div style={{ flex: "0 0 170px" }}>
                          <select
                            value={f.fieldType}
                            onChange={(e) => updateFormField(key, idx, { fieldType: e.target.value })}
                            style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, width: "100%" }}
                          >
                            {FIELD_TYPES.map((ft) => (
                              <option key={ft.value} value={ft.value}>
                                {ft.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div style={{ flex: "1 1 180px" }}>
                          <input
                            type="text"
                            value={f.placeholder}
                            onChange={(e) => updateFormField(key, idx, { placeholder: e.target.value })}
                            placeholder="Placeholder (optional)"
                            style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, width: "100%" }}
                          />
                        </div>
                        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, flex: "0 0 auto" }}>
                          <input
                            type="checkbox"
                            checked={f.required}
                            onChange={(e) => updateFormField(key, idx, { required: e.target.checked })}
                          />
                          Required
                        </label>
                        <span className="mono" style={{ fontSize: 11, color: "#94a3b8", flex: "0 0 auto" }}>
                          key: {f.key}
                        </span>
                        <button className="btn btn-ghost btn-sm" onClick={() => removeFormField(key, idx)}>
                          ✕
                        </button>
                      </div>
                    ))}
                    <button className="btn btn-outline btn-sm" onClick={() => addFormField(key)} style={{ marginBottom: 12 }}>
                      + Add field
                    </button>

                    <div className="field-row">
                      <div className="field" style={{ flex: "0 0 220px" }}>
                        <label>Submit button text</label>
                        <input
                          type="text"
                          value={node.formSubmitLabel || "Submit"}
                          onChange={(e) => updateNode(key, { formSubmitLabel: e.target.value })}
                        />
                      </div>
                      <div className="field" style={{ flex: 1 }}>
                        <label>After submit, continue to (optional)</label>
                        <select
                          value={node.formNext || ""}
                          onChange={(e) => updateNode(key, { formNext: e.target.value || null })}
                        >
                          <option value="">— end here (thank-you) —</option>
                          {otherNodeKeys(key).map((k) => (
                            <option key={k} value={k}>
                              → {k}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </>
      )}

      {tab === "theme" && (
        <ThemeSetter chatbot={chatbot} onSaved={(updated) => setChatbot((prev) => ({ ...prev, ...updated }))} />
      )}

      {tab === "publish" && (
        <div className="card" style={{ maxWidth: 560 }}>
          {chatbot.status !== "published" ? (
            <>
              <h3>Generate this chatbot</h3>
              <p className="helper-text" style={{ margin: "8px 0 16px" }}>
                Choose how it should be shown, then generate a public link, QR code, and API key. Your current flow is
                saved automatically as part of generating.
              </p>

              <DisplayModePicker value={displayMode} onChange={setDisplayMode} />

              {genError && <p className="error-text" style={{ margin: "14px 0 10px" }}>{genError}</p>}
              <button className="btn btn-primary" onClick={generate} disabled={generating} style={{ marginTop: 14 }}>
                {generating ? "Generating…" : "Generate Chatbot"}
              </button>
            </>
          ) : (
            <>
              <h3 style={{ marginBottom: 4 }}>Live and ready to share</h3>
              <p className="helper-text" style={{ marginBottom: 14 }}>
                Published as{" "}
                <strong>{chatbot.displayMode === "widget" ? "a Website Widget" : "a Full Screen chat page"}</strong>. Change
                it below and re-generate at any time — re-generating always saves and publishes your latest flow edits
                too, so it's the button to reach for after building something new.
              </p>

              <DisplayModePicker value={displayMode} onChange={setDisplayMode} compact />

              <div className="field" style={{ marginTop: 16 }}>
                <label>Public link {chatbot.displayMode === "fullscreen" ? "(opens full screen)" : ""}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" readOnly value={chatbot.publicLink} className="mono" />
                  <button className="btn btn-outline btn-sm" onClick={() => copy(chatbot.publicLink)}>
                    Copy
                  </button>
                </div>
              </div>

              {chatbot.displayMode === "widget" && chatbot.embedSnippet && (
                <div className="field">
                  <label>Embed on your website</label>
                  <p className="helper-text" style={{ marginBottom: 8 }}>
                    Paste this snippet before <code>&lt;/body&gt;</code> on any page — it adds a floating chat bubble that
                    opens this bot in a corner panel.
                  </p>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <textarea readOnly rows={3} className="mono" value={chatbot.embedSnippet} style={{ flex: 1 }} />
                    <button className="btn btn-outline btn-sm" onClick={() => copy(chatbot.embedSnippet)}>
                      Copy
                    </button>
                  </div>
                </div>
              )}

              <div className="field">
                <label>API key (header: x-api-key)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" readOnly value={chatbot.apiKey} className="mono" />
                  <button className="btn btn-outline btn-sm" onClick={() => copy(chatbot.apiKey)}>
                    Copy
                  </button>
                </div>
              </div>

              <div className="field">
                <label>QR code</label>
                {chatbot.qrCodeDataUrl && (
                  <img src={chatbot.qrCodeDataUrl} alt="Chatbot QR code" width={160} height={160} style={{ borderRadius: 10, border: "1px solid var(--border)" }} />
                )}
                <a
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: 10, width: "fit-content" }}
                  href={`${api.defaults.baseURL}/chatbots/${chatbot._id}/qr.png`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download PNG
                </a>
              </div>

              {genError && <p className="error-text" style={{ marginBottom: 10 }}>{genError}</p>}
              <button className="btn btn-outline" style={{ marginTop: 6 }} onClick={generate} disabled={generating}>
                {generating ? "Re-generating…" : "Re-generate after edits"}
              </button>
            </>
          )}
        </div>
      )}

      {showExcelModal && (
        <ExcelImportModal
          chatbotId={id}
          hasExistingFlow={Object.keys(questions).length > 0}
          onClose={() => setShowExcelModal(false)}
          onImported={handleExcelImported}
        />
      )}
    </Layout>
  );
}

/*
|--------------------------------------------------------------------------
| DisplayModePicker
|--------------------------------------------------------------------------
| Asked in the Publish & Share tab, before the chatbot is generated (and
| editable afterwards too, for a re-generate): how should the published bot
| be shown?
|   "fullscreen" -> a standalone, edge-to-edge full-page chat experience
|                   (the reference full-screen chatbot design) — best for a
|                   QR code or a dedicated "Chat with us" page/link.
|   "widget"     -> a small floating chat-bubble launcher embedded into any
|                   website via a copy-paste <script> snippet.
*/
function DisplayModePicker({ value, onChange, compact }) {
  const options = [
    {
      value: "fullscreen",
      icon: "🖥️",
      title: "Full Screen",
      desc: "A standalone, edge-to-edge chat page — matches the reference full-screen chatbot design. Great for QR codes and a dedicated chat link.",
    },
    {
      value: "widget",
      icon: "🌐",
      title: "Website Widget",
      desc: "A floating chat bubble embedded on any website via a copy-paste script snippet. Opens as a corner panel over the page.",
    },
  ];

  return (
    <div>
      {!compact && <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>How should this chatbot be shown?</label>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="card"
            style={{
              textAlign: "left",
              cursor: "pointer",
              border: value === opt.value ? "2px solid var(--primary, #3b3486)" : "1px solid var(--border)",
              background: value === opt.value ? "rgba(59,52,134,0.05)" : "#fff",
              padding: 14,
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>{opt.icon}</div>
            <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              {opt.title}
              {value === opt.value && <span className="badge badge-active">Selected</span>}
            </div>
            <div className="helper-text" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
              {opt.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}