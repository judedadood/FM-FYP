// controllers/controller.js
const express = require("express");
const router = express.Router();
const db = require("../db"); // database connection

// ======================================================
// HOME PAGE
// ======================================================
router.get("/", (req, res) => {
    db.query("SELECT * FROM roles LIMIT 1", (err, results) => {
        if (err) {
            console.error("Home page DB error:", err);
            return res.send("Database error");
        }

        res.render("index", {
            title: "Condo Management System",
            role: results[0] || { role_name: "N/A" }
        });
    });
});

// ======================================================
// LOGIN PAGE (GET)
// ======================================================
router.get("/login", (req, res) => {
    res.render("login", {
        title: "Login - Condo Management System",
        error: null
    });
});

// ======================================================
// LOGIN FORM SUBMIT (POST)
// ======================================================
router.post("/login", (req, res) => {
    const { username, password } = req.body;

    db.query("SELECT * FROM users WHERE username = ?", [username], (err, results) => {
        if (err) {
            console.error("Login error:", err);
            return res.render("login", {
                title: "Login - Condo Management System",
                error: "Database error. Try again."
            });
        }

        if (results.length === 0) {
            return res.render("login", {
                title: "Login - Condo Management System",
                error: "Invalid username or password."
            });
        }

        const user = results[0];

        if (user.password !== password) {
            return res.render("login", {
                title: "Login - Condo Management System",
                error: "Invalid username or password."
            });
        }

        // Login success
        res.redirect("/dashboard");
    });
});

// DASHBOARD PLACEHOLDER
router.get("/dashboard", (req, res) => {
    res.send("You are logged in!");
});

// ======================================================
// ANNOUNCEMENTS PAGE
// ======================================================
router.get("/announcements", (req, res) => {
    const sql = "SELECT * FROM announcements ORDER BY created_at DESC";

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Announcements DB error:", err);
            return res.send("Database error");
        }

        res.render("announcements", {
            title: "Announcements",
            announcements: results
        });
    });
});

// ======================================================
// FACILITIES PAGE
// ======================================================
router.get("/facilities", (req, res) => {
    const sql = "SELECT * FROM facilities";

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Facilities DB error:", err);
            return res.send("Database error");
        }

        res.render("facilities", {
            title: "Facilities",
            facilities: results
        });
    });
});

// EXPORT ROUTES
module.exports = router;
