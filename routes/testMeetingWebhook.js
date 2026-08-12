const express = require("express");
const router = express.Router();

const { meetingWebhook } = require("../controllers/meetingWebhookController");

router.post("/", meetingWebhook);

module.exports = router;