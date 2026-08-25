const express = require("express");
const router = express.Router();

const { textAddressWebhook } = require("../controllers/textAddressWebhookController");

router.post("/", textAddressWebhook);

module.exports = router;