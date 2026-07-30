const express = require("express");
const router = express.Router();

const { invoiceWebhook } = require("../controllers/invoiceWebhookController");

router.post("/", invoiceWebhook);

module.exports = router;