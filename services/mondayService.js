const monday = require("../config/monday");

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

module.exports = {
    searchByPhone,
    createItem,
    updateItem,
    createUpdate
};