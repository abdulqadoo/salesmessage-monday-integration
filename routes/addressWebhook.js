const express = require("express");
const router = express.Router();

const { addressWebhook } = require("../controllers/addressWebhookController");

router.post("/", addressWebhook);

module.exports = router;