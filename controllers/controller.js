// controllers/controller.js
const express = require("express");
const router = express.Router();
const db = require("../db"); // database connection
// const bcrypt = require("bcrypt"); // <-- enable when you switch to hashed passwords

// ======================================================
// AUTH MIDDLEWARE
// ======================================================
function requireLogin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.redirect("/login"); // not logged in
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session || req.session.userType !== "admin") {
        return res.redirect("/login");
    }
    next();
}

// ======================================================
// HOME PAGE (PUBLIC)
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
// LOGIN PAGE (GET) – PUBLIC
// ======================================================
router.get("/login", (req, res) => {
    res.render("login", {
        title: "Login - Condo Management System",
        error: null
    });
});

// ======================================================
// LOGIN FORM SUBMIT (POST) – USE users TABLE
// ======================================================
router.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.render("login", {
            title: "Login - Condo Management System",
            error: "Please enter username and password."
        });
    }

    // Here we assume your login form uses "username" that matches users.name
    const sql = "SELECT * FROM users WHERE name = ?";

    db.query(sql, [username], async (err, results) => {
        if (err) {
            console.error("Login DB error:", err);
            return res.render("login", {
                title: "Login - Condo Management System",
                error: "Server error. Please try again."
            });
        }

        if (results.length === 0) {
            // No such user
            return res.render("login", {
                title: "Login - Condo Management System",
                error: "Invalid username or password."
            });
        }

        const user = results[0];

        // FOR NOW (your DB stores plain "Password"):
        const passwordsMatch = (password === user.password_hash);

        // WHEN YOU SWITCH TO HASHED PASSWORDS, use this instead:
        // const passwordsMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordsMatch) {
            return res.render("login", {
                title: "Login - Condo Management System",
                error: "Invalid username or password."
            });
        }

        // SAVE SESSION
        req.session.userId = user.user_id;
        req.session.userName = user.name;
        req.session.userType = user.role; // 'admin' or 'resident'

        // REDIRECT BY ROLE
        if (user.role === "admin") {
            return res.redirect("/admin");
        } else {
            return res.redirect("/resident");
        }
    });
});

// ======================================================
// LOGOUT
// ======================================================
router.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/login");
    });
});

// ======================================================
// SIMPLE RESIDENT & ADMIN ROUTES (PROTECTED)
// ======================================================
router.get("/resident", requireLogin, (req, res) => {
    // Residents land on Facilities
    res.redirect("/facilities");
});

router.get("/admin", requireAdmin, (req, res) => {
    res.render("adminDashboard", {
        title: "Admin Dashboard",
        userName: req.session.userName || "Admin"
    });
});

router.get("/dashboard", requireLogin, (req, res) => {
    res.send("You are logged in!");
});

// ======================================================
// RESIDENT PAGES – ANNOUNCEMENTS / FACILITIES
// ======================================================
router.get("/announcements", requireLogin, (req, res) => {
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

router.get("/facilities", requireLogin, (req, res) => {
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

// ======================================================
// FACILITY BOOKING (RESIDENT)
// ======================================================
router.get("/facilities/book/:facilityId", requireLogin, (req, res) => {
    const facilityId = parseInt(req.params.facilityId, 10);

    const facilityMap = {
        1: { id: 1, name: "Resort-Style Swimming Pool" },
        2: { id: 2, name: "Fully-Equipped Gym" },
        3: { id: 3, name: "Event Function Room" }
    };

    const facility = facilityMap[facilityId];

    if (!facility) {
        return res.send("Facility not found");
    }

    res.render("bookFacility", {
        title: "Book Facility",
        facility
    });
});

router.post("/facilities/book", requireLogin, (req, res) => {
    const {
        facility_id,
        facility_name,
        resident_name,
        unit_number,
        contact_number,
        booking_date,
        time_slot
    } = req.body;

    const sql = `
        INSERT INTO FacilityBookings
          (facility_name, resident_name, unit_number, contact_number, booking_date, time_slot)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [facility_name, resident_name, unit_number, contact_number, booking_date, time_slot],
        (err) => {
            if (err) {
                console.error("Error saving booking:", err);
                return res.status(500).send("Error saving booking");
            }

            res.render("bookingSuccess", {
                title: "Booking Confirmed",
                facility_name,
                booking_date,
                time_slot
            });
        }
    );
});

// ======================================================
// MAINTENANCE REQUEST (RESIDENT)
// ======================================================
router.get("/maintenance-request", requireLogin, (req, res) => {
    res.render("maintenanceRequest", {
        title: "Submit Maintenance Request",
        error: null
    });
});

router.post("/maintenance-request", requireLogin, (req, res) => {
    const {
        resident_name,
        unit_number,
        contact_number,
        facility_name,
        issue_type,
        description
    } = req.body;

    // Validate required fields
    if (!resident_name || !unit_number || !contact_number || !issue_type || !description) {
        return res.status(400).render("maintenanceRequest", {
            title: "Submit Maintenance Request",
            error: "All required fields must be filled."
        });
    }

    // 1) Look up unit_id from units using the unit number
    const findUnitSql = "SELECT unit_id FROM units WHERE unit_no = ?";

    db.query(findUnitSql, [unit_number], (err, rows) => {
        if (err) {
            console.error("Error looking up unit:", err);
            return res.status(500).render("maintenanceRequest", {
                title: "Submit Maintenance Request",
                error: "Database error when checking unit number."
            });
        }

        if (rows.length === 0) {
            // No such unit in DB
            return res.status(400).render("maintenanceRequest", {
                title: "Submit Maintenance Request",
                error: "Unit not found. Please enter a valid unit number."
            });
        }

        const unitId = rows[0].unit_id;

        const sql = `
            INSERT INTO maintenance_requests
              (unit_id, unit_label, requested_by, category, priority, status, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [
                unitId,
                unit_number,
                `${resident_name} (${contact_number})`,
                issue_type || facility_name || "General",
                "Normal",
                "Pending",
                description
            ],
            (err2) => {
                if (err2) {
                    console.error("Database error on insert:", err2);
                    return res.status(500).render("maintenanceRequest", {
                        title: "Submit Maintenance Request",
                        error: "Error: " + err2.message
                    });
                }

                console.log("Request saved successfully");

                return res.render("maintenanceSuccess", {
                    title: "Request Submitted",
                    resident_name,
                    unit_number,
                    issue_type: issue_type || facility_name || "General"
                });
            }
        );
    });
});

// ======================================================
// ADMIN PAGES – BOOKINGS & MAINTENANCE OVERVIEW
// ======================================================
router.get("/admin/bookings", requireAdmin, (req, res) => {
    const sql = `
        SELECT id, facility_name, resident_name, unit_number,
               contact_number, booking_date, time_slot, created_at
        FROM FacilityBookings
        ORDER BY created_at DESC
        LIMIT 20
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Admin bookings DB error:", err);
            return res.send("Database error");
        }

        res.render("adminBookings", {
            title: "Facility Bookings",
            bookings: results
        });
    });
});

router.get("/admin/maintenance", requireAdmin, (req, res) => {
    const sql = `
        SELECT request_id, unit_id, unit_label, requested_by,
               category, priority, status, description, created_at
        FROM maintenance_requests
        ORDER BY created_at DESC
        LIMIT 20
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Admin maintenance DB error:", err);
            return res.send("Database error");
        }

        res.render("adminMaintenance", {
            title: "Maintenance Requests",
            requests: results
        });
    });
});

router.post("/admin/maintenance/:id/status", requireAdmin, (req, res) => {
    const requestId = req.params.id;
    const { status } = req.body;  // Pending / In Progress / Completed

    const sql = `
        UPDATE maintenance_requests
        SET status = ?
        WHERE request_id = ?
    `;

    db.query(sql, [status, requestId], (err) => {
        if (err) {
            console.error("Update status error:", err);
            return res.send("Error updating status");
        }

        res.redirect("/admin/maintenance");
    });
});

// ======================================================
// EXPORT ROUTES
// ======================================================
module.exports = router;
