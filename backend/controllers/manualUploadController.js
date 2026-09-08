const XLSX = require("xlsx");
const Query = require("../models/Query");

/*
|--------------------------------------------------------------------------
| POST /api/manual-queries/upload
|--------------------------------------------------------------------------
| Admins with access.manualQueryUpload can bulk-import customer queries/FAQs
| from an Excel file instead of collecting them through a chatbot flow.
|
| Expected columns (header row): customerName, contactNumber, email, message
| (any missing column is just left blank on each record)
*/
exports.uploadQueries = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length) {
      return res.status(400).json({ success: false, message: "The file has no data rows" });
    }

    const docs = rows.map((row) => ({
      admin: req.user.id,
      chatbot: null,
      source: "manual",
      language: (row.language || "english").toString().toLowerCase(),
      customerName: row.customerName || row.CustomerName || "",
      contactNumber: row.contactNumber || row.ContactNumber || "",
      email: row.email || row.Email || "",
      message: row.message || row.Message || row.query || row.Query || "",
    }));

    const inserted = await Query.insertMany(docs);

    res.status(201).json({
      success: true,
      message: `${inserted.length} queries uploaded`,
      count: inserted.length,
      data: inserted,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/manual-queries/sample
|--------------------------------------------------------------------------
| Returns a downloadable sample .xlsx so the Admin knows the expected format.
*/
exports.downloadSampleTemplate = async (req, res) => {
  try {
    const sampleRows = [
      {
        customerName: "John Doe",
        contactNumber: "9876543210",
        email: "john@example.com",
        language: "english",
        message: "Sample manually-uploaded query",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Queries");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=manual-query-upload-sample.xlsx",
    });
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
