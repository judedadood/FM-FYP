const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// EJS setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
const mainController = require("./controllers/controller");
app.use("/", mainController);

// Run app
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
