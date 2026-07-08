const express = require("express");
const router = express.Router();

const {
    contactWebhook
} = require("../controllers/webhookController");

const {
    relationshipWebhook
} = require("../controllers/relationshipWebhookController");

// SalesMessage webhook
router.post("/", contactWebhook);

// Relationship Board webhook
router.post("/relationship", relationshipWebhook);

module.exports = router;