// controllers/controller.js
const express = require("express");
const router = express.Router();
const db = require("../db"); // database connection

// Home page (index)
router.get("/", (req, res) => {
    db.query("SELECT * FROM roles LIMIT 1", (err, results) => {
        if (err) {
            console.error(err);
            return res.send("Database error");
        }

        res.render("index", {
            title: "Condo Management System",
            role: results[0]   // pass the first role
        });
    });
});

module.exports = router;
