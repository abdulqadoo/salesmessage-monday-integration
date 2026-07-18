require("dotenv").config();

const express = require("express");
const webhookRoutes = require("./routes/webhook");
const taskWebhookRoutes = require("./routes/taskWebhook");
const meetingWebhookRoutes = require("./routes/meetingWebhook");

const {
    searchByPhone,
    createItem,
    updateItem,
    createUpdate
} = require("./services/mondayService");

const app = express();

// Middleware
app.use(express.json());

// Webhook Routes
app.use("/webhook", webhookRoutes);
app.use("/monday-task-webhook", taskWebhookRoutes);
app.use("/monday-meeting-webhook", meetingWebhookRoutes);


// ===============================
// SEARCH ITEM
// ===============================
app.get("/search", async (req, res) => {

    const phone = "03051462034";

    const items = await searchByPhone(phone);

    res.json(items);

});


// ===============================
// CREATE ITEM
// ===============================
app.get("/create", async (req, res) => {

    const contact = {
        name: "Test Contact",
        phone: "03000000000"
    };

    const item = await createItem(contact);

    res.json(item);

});


// ===============================
// UPDATE ITEM
// ===============================
app.get("/update", async (req, res) => {

    const itemId = "12400579143";

    const contact = {
        phone: "03112223333"
    };

    const item = await updateItem(itemId, contact);

    res.json(item);

});


// ===============================
// CREATE MONDAY UPDATE
// ===============================
app.get("/message", async (req, res) => {

    const itemId = "12400579143";

    const message = `
📨 Incoming SMS

Phone:
03051462034

Time:
${new Date().toLocaleString()}

Message:

Hello from SalesMessage!
`;

    const result = await createUpdate(itemId, message);

    res.json(result);

});

// ===============================
// GET SALESMESSAGE MESSAGES
// ===============================
app.get("/messages", async (req, res) => {

    const axios = require("axios");

    try {

        const response = await axios.get(
            "https://api.salesmessage.com/v1/messages",
            {
                headers: {
                    Authorization: `Bearer ${process.env.SALESMESSAGE_TOKEN}`,
                    Accept: "application/json"
                }
            }
        );

        res.json(response.data);

    } catch (error) {

        console.log(error.response?.data || error.message);

        res.status(500).json(error.response?.data || {
            error: error.message
        });

    }

});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});