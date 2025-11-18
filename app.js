// app.js
const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// Load MySQL connection
require("./db");

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
const mainController = require("./controllers/controller");
app.use("/", mainController);

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
