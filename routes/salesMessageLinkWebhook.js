// routes/salesMessageLinkWebhook.js
const express = require("express");
const router = express.Router();
const { handleSalesMessageLinkWebhook } = require("../controllers/salesMessageLinkController");

router.post("/", handleSalesMessageLinkWebhook);

module.exports = router;