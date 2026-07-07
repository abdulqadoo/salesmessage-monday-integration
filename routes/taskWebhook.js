const express = require("express");
const router = express.Router();

const {
    taskWebhook
} = require("../controllers/taskWebhookController");

// Handle Monday task creation webhook events
router.post("/", taskWebhook);

module.exports = router;