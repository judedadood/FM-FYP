// controllers/controller.js
const express = require("express");
const router = express.Router();
const db = require("../db"); // database connection

// ======================================================
// AUTH MIDDLEWARE – CHECK LOGIN
// ======================================================
function requireLogin(req, res, next) {
    if (!req.session || !req.session.userType) {
        return res.redirect("/login"); // not logged in
    }
    next();
}

// ADMIN-ONLY MIDDLEWARE
function requireAdmin(req, res, next) {
    if (!req.session || req.session.userType !== "admin") {
        // not admin – send back to login (or you can send 403)
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
// LOGIN FORM SUBMIT (POST) – PREFIX LOGIC (R / A)
// ======================================================
router.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.render("login", {
            title: "Login - Condo Management System",
            error: "Please enter username and password."
        });
    }

    const firstChar = username.charAt(0).toUpperCase(); // R or A

    if (firstChar === "R") {
        // RESIDENT
        req.session.userType = "resident";
        return res.redirect("/resident");
    }

    if (firstChar === "A") {
        // ADMIN
        req.session.userType = "admin";
        return res.redirect("/admin");
    }

    return res.render("login", {
        title: "Login - Condo Management System",
        error: "Invalid username format. Must start with R or A."
    });
});

// ======================================================
// SIMPLE RESIDENT & ADMIN ROUTES (PROTECTED)
// ======================================================
router.get("/resident", requireLogin, (req, res) => {
    // For now, residents land on Facilities
    res.redirect("/facilities");
});

// Admin dashboard (now protected by requireAdmin)
router.get("/admin", requireAdmin, (req, res) => {
    res.render("adminDashboard", {
        title: "Admin Dashboard"
    });
});

// Optional generic dashboard
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

// Show booking form (no DB query – map id -> name)
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

// Handle booking submission
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

// Show maintenance request form
router.get("/maintenance-request", requireLogin, (req, res) => {
    res.render("maintenanceRequest", {
        title: "Submit Maintenance Request"
    });
});

// Handle maintenance request submission
router.post("/maintenance-request", requireLogin, (req, res) => {
    const {
        resident_name,
        unit_number,    // from form
        contact_number,
        facility_name,
        issue_type,
        description     // textarea name="description"
    } = req.body;

    // For now, force numeric unit for unit_id (FK is INT)
    const unitId = parseInt(unit_number, 10);
    if (Number.isNaN(unitId)) {
        return res
            .status(400)
            .send("Unit Number must be a number, e.g. 101 (temporarily).");
    }

    const sql = `
        INSERT INTO maintenance_requests
          (unit_id, unit_label, requested_by, category, priority, status, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            unitId,                                  // unit_id (INT)
            unit_number,                             // unit_label (full text)
            `${resident_name} (${contact_number})`,  // requested_by
            issue_type || facility_name || "General",// category
            "Normal",                                // priority
            "Pending",                               // status
            description                              // description
        ],
        (err) => {
            if (err) {
                console.error("Error saving maintenance request:", err);
                return res
                    .status(500)
                    .send("Error saving request: " + (err.sqlMessage || err.message));
            }

            res.render("maintenanceSuccess", {
                title: "Request Submitted"
            });
        }
    );
});

// ======================================================
// ADMIN PAGES – BOOKINGS & MAINTENANCE OVERVIEW
// ======================================================

// Admin – view recent facility bookings
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

// Admin – view maintenance requests
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

// Admin – update status of a maintenance request
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
