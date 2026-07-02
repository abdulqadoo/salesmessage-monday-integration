const express = require("express");
const router = express.Router();

const {
    contactWebhook
} = require("../controllers/webhookController");

// Handle all webhook events
router.post("/", contactWebhook);

module.exports = router;