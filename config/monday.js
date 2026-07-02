const axios = require("axios");
require("dotenv").config();

const monday = axios.create({
  baseURL: "https://api.monday.com/v2",
  headers: {
    Authorization: process.env.MONDAY_TOKEN,
    "Content-Type": "application/json",
  },
});

module.exports = monday;