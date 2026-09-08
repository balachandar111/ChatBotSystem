const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");
const { loadAdmin } = require("../middlewares/accessMiddleware");

const {
  getQueryOverview,
  getChatbotColumns,
  getQueries,
  getQuery,
  updateQueryStatus,
  deleteQuery,
} = require("../controllers/queryController");

router.use(protect, authorizeRoles("ADMIN"), loadAdmin);

// NOTE: these two must stay above the generic "/:id" route below, or
// Express would try to treat "overview" as a query id.
router.get("/overview", getQueryOverview);
router.get("/columns/:chatbotId", getChatbotColumns);

router.get("/", getQueries);
router.get("/:id", getQuery);
router.patch("/:id/status", updateQueryStatus);
router.delete("/:id", deleteQuery);

module.exports = router;