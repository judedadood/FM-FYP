// app.js
const express = require("express");
const path = require("path");
const session = require("express-session");
const routes = require("./controllers/controller");

const app = express();
const PORT = process.env.PORT || 3000;

// view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// middlewares
app.use(express.urlencoded({ extended: true })); // for form data
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // if you have css/js

// session (optional but useful for login)
app.use(
    session({
        secret: "supersecretkey",
        resave: false,
        saveUninitialized: false,
    })
);

// use routes
app.use("/", routes);

// start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
