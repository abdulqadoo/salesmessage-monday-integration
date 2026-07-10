const monday = require("../config/monday");
const axios = require("axios");
const FormData = require("form-data");

const BOARD_ID = process.env.BOARD_ID;
const PHONE_COLUMN = process.env.PHONE_COLUMN;

// =====================================
// SEARCH ITEM BY PHONE
// =====================================
async function searchByPhone(phone) {

    const query = `
        query {
            items_page_by_column_values(
                board_id: ${BOARD_ID},
                columns: [{
                    column_id: "${PHONE_COLUMN}",
                    column_values: ["${phone}"]
                }]
            ) {
                items {
                    id
                    name
                }
            }
        }
    `;

    try {

        const response = await monday.post("", { query });

        return response.data.data.items_page_by_column_values.items;

    } catch (error) {

        console.log(error.response?.data || error.message);

        return [];

    }

}

// =====================================
// CREATE ITEM
// =====================================
async function createItem(contact) {

    const mutation = `
        mutation {
            create_item(
                board_id: ${BOARD_ID},
                item_name: "${contact.name}",
                column_values: "{\\"${PHONE_COLUMN}\\":\\"${contact.phone}\\"}"
            ) {
                id
                name
            }
        }
    `;

    try {

        const response = await monday.post("", {
            query: mutation
        });

        return response.data.data.create_item;

    } catch (error) {

        console.log(error.response?.data || error.message);

        return null;

    }

}

// =====================================
// UPDATE ITEM
// =====================================
async function updateItem(itemId, contact) {

    const mutation = `
        mutation {
            change_multiple_column_values(
                board_id: ${BOARD_ID},
                item_id: ${itemId},
                column_values: "{\\"${PHONE_COLUMN}\\":\\"${contact.phone}\\"}"
            ) {
                id
                name
            }
        }
    `;

    try {

        const response = await monday.post("", {
            query: mutation
        });

        return response.data.data.change_multiple_column_values;

    } catch (error) {

        console.log(error.response?.data || error.message);

        return null;

    }

}

// =====================================
// CREATE UPDATE
// =====================================
async function createUpdate(itemId, message) {

    const mutation = `
        mutation {
            create_update(
                item_id: ${itemId},
                body: ${JSON.stringify(message)}
            ) {
                id
            }
        }
    `;

    try {

        const response = await monday.post("", {
            query: mutation
        });

        console.log("Monday Update Response:");
        console.log(response.data);

        return response.data.data.create_update;

    } catch (error) {

        console.log("Monday Update Error:");
        console.log(error.response?.data || error.message);

        throw error;

    }

}

// =====================================
// CREATE TIMELINE ACTIVITY (EMAIL & ACTIVITIES)
// =====================================
async function createTimelineItem(itemId, title, message) {

    const mutation = `
        mutation CreateTimelineItem($itemId: ID!, $title: String!, $content: String!, $timestamp: ISO8601DateTime!) {
            create_timeline_item(
                item_id: $itemId,
                title: $title,
                content: $content,
                timestamp: $timestamp
            ) {
                id
            }
        }
    `;

    const variables = {
        itemId: String(itemId),
        title: title,
        content: message,
        timestamp: new Date().toISOString().split('.')[0] + 'Z'
    };

    try {

        console.log("====== TIMELINE VARIABLES ======");
        console.log(JSON.stringify(variables, null, 2));

        const response = await monday.post("", {
            query: mutation,
            variables
        });

        console.log("====== TIMELINE RESPONSE ======");
        console.log(JSON.stringify(response.data, null, 2));

        return response.data.data.create_timeline_item;

    } catch (error) {

        console.log("====== TIMELINE ERROR ======");

        if (error.response) {
            console.log(JSON.stringify(error.response.data, null, 2));
        } else {
            console.log(error.message);
        }

        throw error;
    }
}

// =====================================
// UPLOAD FILE TO UPDATE (from a URL)
// =====================================
async function addFileToUpdateFromUrl(updateId, imageUrl, fileName) {

    try {

        // Step 1: Download the image into memory
        let imageResponse;

        try {
            imageResponse = await axios.get(imageUrl, {
                responseType: "arraybuffer"
            });
        } catch (downloadError) {
            if (!process.env.SALESMESSAGE_API_TOKEN) {
                throw downloadError;
            }

            imageResponse = await axios.get(imageUrl, {
                responseType: "arraybuffer",
                headers: {
                    Authorization: `Bearer ${process.env.SALESMESSAGE_API_TOKEN}`
                }
            });
        }

        const imageBuffer = Buffer.from(imageResponse.data);

        // Step 2: Build the multipart form for Monday's file upload
        const form = new FormData();

        const mutation = `
            mutation ($updateId: ID!, $file: File!) {
                add_file_to_update (update_id: $updateId, file: $file) {
                    id
                }
            }
        `;

        form.append("query", mutation);
        form.append("variables", JSON.stringify({ updateId: String(updateId) }));
        form.append("map", JSON.stringify({ image: ["variables.file"] }));
        form.append("image", imageBuffer, { filename: fileName || "image.jpg" });

        // Step 3: Send it to Monday's API (multipart, not JSON)
        const response = await axios.post(
            "https://api.monday.com/v2/file",
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    Authorization: process.env.MONDAY_TOKEN
                }
            }
        );

        console.log("====== FILE UPLOAD RESPONSE ======");
        console.log(JSON.stringify(response.data, null, 2));

        return response.data.data.add_file_to_update;

    } catch (error) {

        console.log("====== FILE UPLOAD ERROR ======");

        if (error.response) {
            console.log(JSON.stringify(error.response.data, null, 2));
        } else {
            console.log(error.message);
        }

        throw error;

    }

}

// =====================================
// UPLOAD FILE TO UPDATE (from a Buffer)
// =====================================
async function addFileToUpdateFromBuffer(updateId, fileBuffer, fileName) {

    try {

        const form = new FormData();

        const mutation = `
            mutation ($updateId: ID!, $file: File!) {
                add_file_to_update (update_id: $updateId, file: $file) {
                    id
                }
            }
        `;

        form.append("query", mutation);
        form.append("variables", JSON.stringify({ updateId: String(updateId) }));
        form.append("map", JSON.stringify({ image: ["variables.file"] }));
        form.append("image", fileBuffer, { filename: fileName || "image.jpg" });

        const response = await axios.post(
            "https://api.monday.com/v2/file",
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    Authorization: process.env.MONDAY_TOKEN
                }
            }
        );

        console.log("====== FILE BUFFER UPLOAD RESPONSE ======");
        console.log(JSON.stringify(response.data, null, 2));

        return response.data.data.add_file_to_update;

    } catch (error) {

        console.log("====== FILE BUFFER UPLOAD ERROR ======");

        if (error.response) {
            console.log(JSON.stringify(error.response.data, null, 2));
        } else {
            console.log(error.message);
        }

        throw error;

    }

}
// =====================================
// SEARCH ITEM BY NAME (any board)
// =====================================
async function searchItemByName(boardId, name) {

    const query = `
        query {
            items_page_by_column_values(
                board_id: ${boardId},
                columns: [{
                    column_id: "name",
                    column_values: ["${name}"]
                }]
            ) {
                items {
                    id
                    name
                }
            }
        }
    `;

    try {

        const response = await monday.post("", { query });

        return response.data.data.items_page_by_column_values.items;

    } catch (error) {

        console.log(error.response?.data || error.message);

        return [];

    }

}

// =====================================
// CREATE TASK
// =====================================
async function createTask(boardId, taskName) {

    const mutation = `
        mutation (
            $boardId: ID!,
            $itemName: String!
        ) {
            create_item(
                board_id: $boardId,
                item_name: $itemName
            ) {
                id
                name
            }
        }
    `;

    const variables = {
        boardId: String(boardId),
        itemName: taskName
    };

    try {

        const response = await monday.post("", {
            query: mutation,
            variables
        });

        console.log("====== CREATE TASK ======");
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.errors) {
            throw new Error(JSON.stringify(response.data.errors));
        }

        return response.data.data.create_item;

    } catch (error) {

        console.log("====== CREATE TASK ERROR ======");
        console.log(error.response?.data || error.message);

        throw error;

    }

}

// CONNECT TWO ITEMS VIA CONNECT BOARDS COLUMN
// =====================================
async function connectItems(boardId, itemId, connectColumnId, targetItemId) {

    const mutation = `
        mutation (
            $boardId: ID!,
            $itemId: ID!,
            $columnId: String!,
            $value: JSON!
        ) {
            change_column_value(
                board_id: $boardId,
                item_id: $itemId,
                column_id: $columnId,
                value: $value
            ) {
                id
            }
        }
    `;

    const variables = {
        boardId: String(boardId),
        itemId: String(itemId),
        columnId: connectColumnId,
        value: JSON.stringify({
            item_ids: [String(targetItemId)]
        })
    };

    try {

        const response = await monday.post("", {
            query: mutation,
            variables
        });

        console.log("====== CONNECT RESPONSE ======");
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.errors) {
            throw new Error(JSON.stringify(response.data.errors));
        }

        return response.data.data.change_column_value;

    } catch (error) {

        console.log("====== CONNECT ERROR ======");
        console.log(error.response?.data || error.message);

        throw error;

    }

}
// =====================================
// GET ITEM DETAILS
// =====================================
async function getItem(itemId) {

    const query = `
        query {
            items(ids: [${itemId}]) {
                id
                name
                column_values {
                    id
                    text
                    value
                }
            }
        }
    `;

    try {

        const response = await monday.post("", { query });

        return response.data.data.items[0];

    } catch (error) {

        console.log(error.response?.data || error.message);
        return null;

    }

}
// =====================================
// =====================================
// CREATE SMS TIMELINE ENTRY (Emails & Activities)
// =====================================
async function createSmsTimelineItem(itemId, title, content) {

    const CUSTOM_ACTIVITY_ID = "cf290fab-7393-4ab4-9af2-37e1e45e9e5b";

    const mutation = `
        mutation CreateTimelineItem($itemId: ID!, $title: String!, $content: String!, $timestamp: ISO8601DateTime!, $customActivityId: String!) {
            create_timeline_item(
                item_id: $itemId,
                title: $title,
                content: $content,
                timestamp: $timestamp,
                custom_activity_id: $customActivityId
            ) {
                id
            }
        }
    `;

    const variables = {
        itemId: String(itemId),
        title: title,
        content: content,
        timestamp: new Date().toISOString().split('.')[0] + 'Z',
        customActivityId: CUSTOM_ACTIVITY_ID
    };

    try {

        console.log("====== SMS TIMELINE VARIABLES ======");
        console.log(JSON.stringify(variables, null, 2));

        const response = await monday.post("", {
            query: mutation,
            variables
        });

        console.log("====== SMS TIMELINE RESPONSE ======");
        console.log(JSON.stringify(response.data, null, 2));

        return response.data.data.create_timeline_item;

    } catch (error) {

        console.log("====== SMS TIMELINE ERROR ======");

        if (error.response) {
            console.log(JSON.stringify(error.response.data, null, 2));
        } else {
            console.log(error.message);
        }

        throw error;
    }
}

module.exports = {
    searchByPhone,
    createItem,
    updateItem,
    createUpdate,
    createTimelineItem,
    addFileToUpdateFromUrl,
    addFileToUpdateFromBuffer,
    searchItemByName,
    createTask,
    connectItems,
    getItem,
    createSmsTimelineItem
};
