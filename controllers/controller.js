// controllers/controller.js
const express = require("express");
const router = express.Router();
const db = require("../db");

// HOME PAGE
router.get("/", (req, res) => {
    db.query("SELECT * FROM roles LIMIT 1", (err, results) => {
        if (err) {
            console.error(err);
            return res.send("Database error");
        }

        res.render("index", {
            title: "Condo Management System",
            role: results[0] || { role_name: "N/A" }
        });
    });
});

// LOGIN PAGE (GET)
router.get("/login", (req, res) => {
    res.render("login", {
        title: "Login - Condo Management System",
        error: null
    });
});

// LOGIN FORM SUBMIT (POST)
router.post("/login", (req, res) => {
    const { username, password } = req.body;

    // change table/fields to match your schema
    const sql = "SELECT * FROM users WHERE username = ?";
    db.query(sql, [username], (err, results) => {
        if (err) {
            console.error(err);
            return res.render("login", {
                title: "Login - Condo Management System",
                error: "Database error. Please try again."
            });
        }

        if (results.length === 0) {
            return res.render("login", {
                title: "Login - Condo Management System",
                error: "Invalid username or password."
            });
        }

        const user = results[0];

        // simple password check (plain text) – replace with bcrypt if needed
        if (user.password !== password) {
            return res.render("login", {
                title: "Login - Condo Management System",
                error: "Invalid username or password."
            });
        }

        // if you are using sessions:
        // req.session.user = { id: user.id, username: user.username };

        // redirect to some protected page
        res.redirect("/dashboard");
    });
});

// SIMPLE DASHBOARD (example)
router.get("/dashboard", (req, res) => {
    // if using sessions, you can check if user is logged in here
    res.send("You are logged in. (Dashboard page placeholder)");
});

module.exports = router;

