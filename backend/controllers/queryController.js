const mongoose = require("mongoose");
const Query = require("../models/Query");
const Chatbot = require("../models/Chatbot");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
| chatbot.flow (and languageFlow.questions) are Mongoose Maps. Depending on
| how the document was fetched they may come back as a real Map instance
| or (rarely) a plain object — this normalizes either shape into an array
| of [key, value] entries so the rest of the code never has to care which
| one it got.
*/
const entriesOf = (mapLike) => {
  if (!mapLike) return [];
  if (typeof mapLike.entries === "function" && typeof mapLike.get === "function") {
    return Array.from(mapLike.entries());
  }
  return Object.entries(mapLike);
};

/*
|--------------------------------------------------------------------------
| GET /api/queries/overview
|--------------------------------------------------------------------------
| Powers the card-grid landing view of the Queries section: one card per
| chatbot (+ a "Manual Uploads" bucket) showing how many customer queries
| have come in, so the Admin picks a chatbot before seeing its table.
*/
exports.getQueryOverview = async (req, res) => {
  try {
    const adminId = req.user.id;

    const chatbots = await Chatbot.find({ admin: adminId })
      .select("name type mode status createdAt")
      .sort({ createdAt: -1 });

    // Aggregate query counts per chatbot (and a null-chatbot bucket for
    // manually uploaded queries) in one pass.
    const grouped = await Query.aggregate([
      { $match: { admin: new mongoose.Types.ObjectId(adminId) } },
      { $group: { _id: "$chatbot", count: { $sum: 1 }, lastAt: { $max: "$createdAt" } } },
    ]);

    const countMap = {};
    let manualCount = 0;
    let manualLastAt = null;
    grouped.forEach((g) => {
      if (g._id) {
        countMap[g._id.toString()] = { count: g.count, lastAt: g.lastAt };
      } else {
        manualCount = g.count;
        manualLastAt = g.lastAt;
      }
    });

    const cards = chatbots.map((bot) => {
      const stat = countMap[bot._id.toString()];
      return {
        _id: bot._id,
        name: bot.name,
        type: bot.type,
        mode: bot.mode,
        status: bot.status,
        queryCount: stat ? stat.count : 0,
        lastQueryAt: stat ? stat.lastAt : null,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        chatbots: cards,
        manual: { queryCount: manualCount, lastQueryAt: manualLastAt },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/queries/columns/:chatbotId
|--------------------------------------------------------------------------
| Returns the dynamic table columns for one chatbot — exactly the fields
| the Admin defined on that chatbot's "form" flow node(s) (e.g. name,
| contact, problem, img/file), in the order the Admin added them. Also
| folds in any keys found on already-submitted queries so nothing is
| dropped if the flow was edited/trimmed after customers already replied.
*/
exports.getChatbotColumns = async (req, res) => {
  try {
    const chatbot = await Chatbot.findOne({ _id: req.params.chatbotId, admin: req.user.id });

    if (!chatbot) {
      return res.status(404).json({ success: false, message: "Chatbot not found" });
    }

    const columns = [];
    const seen = new Set();
    const addColumn = (key, label, type) => {
      if (!key || seen.has(key)) return;
      seen.add(key);
      columns.push({ key, label: label || key, type: type === "file" ? "file" : "text" });
    };

    // 1) Admin-defined form fields, straight from the flow builder.
    for (const [, languageFlow] of entriesOf(chatbot.flow)) {
      for (const [, node] of entriesOf(languageFlow?.questions)) {
        if (node?.nodeType === "form") {
          for (const field of node.formFields || []) {
            addColumn(field.key, field.label, field.fieldType === "file" ? "file" : "text");
          }
        }
      }
    }

    // 2) Anything already captured on submitted queries (covers fields
    // from a flow version that has since changed).
    const queries = await Query.find({ admin: req.user.id, chatbot: chatbot._id })
      .select("formResponses attachments")
      .lean();

    for (const q of queries) {
      for (const fr of q.formResponses || []) addColumn(fr.key, fr.label, "text");
      for (const at of q.attachments || []) addColumn(at.key, at.label, "file");
    }

    res.status(200).json({
      success: true,
      data: {
        chatbot: { _id: chatbot._id, name: chatbot.name, type: chatbot.type, mode: chatbot.mode },
        columns,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/queries
|--------------------------------------------------------------------------
| Table of all customer queries for the logged-in Admin. Supports filtering
| by chatbot, source (normal/voice/manual), and status.
*/
exports.getQueries = async (req, res) => {
  try {
    const filter = { admin: req.user.id };
    if (req.query.chatbot) filter.chatbot = req.query.chatbot;
    if (req.query.source) filter.source = req.query.source;
    if (req.query.status) filter.status = req.query.status;

    const queries = await Query.find(filter)
      .populate("chatbot", "name type mode")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: queries.length, data: queries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/queries/:id
|--------------------------------------------------------------------------
*/
exports.getQuery = async (req, res) => {
  try {
    const query = await Query.findOne({ _id: req.params.id, admin: req.user.id }).populate(
      "chatbot",
      "name type mode"
    );

    if (!query) {
      return res.status(404).json({ success: false, message: "Query not found" });
    }

    res.status(200).json({ success: true, data: query });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| PATCH /api/queries/:id/status
|--------------------------------------------------------------------------
| body: { status: "new" | "in_progress" | "resolved" }
*/
exports.updateQueryStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["new", "in_progress", "resolved"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const query = await Query.findOneAndUpdate(
      { _id: req.params.id, admin: req.user.id },
      { status },
      { new: true }
    );

    if (!query) {
      return res.status(404).json({ success: false, message: "Query not found" });
    }

    res.status(200).json({ success: true, message: "Status updated", data: query });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| DELETE /api/queries/:id
|--------------------------------------------------------------------------
*/
exports.deleteQuery = async (req, res) => {
  try {
    const query = await Query.findOneAndDelete({ _id: req.params.id, admin: req.user.id });
    if (!query) {
      return res.status(404).json({ success: false, message: "Query not found" });
    }
    res.status(200).json({ success: true, message: "Query deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};