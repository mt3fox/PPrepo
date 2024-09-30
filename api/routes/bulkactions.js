const express = require("express");
const router = express.Router();
const bulkactions = require("../controllers/bulkactions");
const authenticate = require("../middleware/auth");

router.post(
  "/bulkactions/download-all-pdf",
  authenticate,
  bulkactions.DownloadAllPdf
);

router.post("/invoices/mark-paid-bulk", authenticate, bulkactions.markPaidBulk);

router.post(
  "/invoices/delete-all",
  authenticate,
  bulkactions.DeleteAllInvoices
);

module.exports = router;
