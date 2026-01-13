// controllers/controller.js
const express = require("express");
const router = express.Router();
const db = require("../db");

// ======================================================
// AUTH MIDDLEWARE
// ======================================================
function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect("/login");
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
      role: results[0] || { role_name: "N/A" },
    });
  });
});

// ======================================================
// LOGIN PAGE (GET) – PUBLIC
// ======================================================
router.get("/login", (req, res) => {
  res.render("login", {
    title: "Login - Condo Management System",
    error: null,
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
      error: "Please enter username and password.",
    });
  }

  const sql = "SELECT * FROM users WHERE name = ?";

  db.query(sql, [username], async (err, results) => {
    if (err) {
      console.error("Login DB error:", err);
      return res.render("login", {
        title: "Login - Condo Management System",
        error: "Server error. Please try again.",
      });
    }

    if (results.length === 0) {
      return res.render("login", {
        title: "Login - Condo Management System",
        error: "Invalid username or password.",
      });
    }

    const user = results[0];

    // Your DB stores password in password_hash (plain text currently)
    const passwordsMatch = password === user.password_hash;

    if (!passwordsMatch) {
      return res.render("login", {
        title: "Login - Condo Management System",
        error: "Invalid username or password.",
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
  res.redirect("/facilities");
});

router.get("/admin", requireAdmin, (req, res) => {
  res.render("adminDashboard", {
    title: "Admin Dashboard",
    userName: req.session.userName || "Admin",
  });
});

router.get("/dashboard", requireLogin, (req, res) => {
  res.send("You are logged in!");
});

// ======================================================
// RESIDENT PAGES – ANNOUNCEMENTS
// ======================================================
router.get("/announcements", requireLogin, (req, res) => {
  const annSql = "SELECT * FROM announcements ORDER BY created_at DESC";
  const eventSql = `
    SELECT event_id, title, event_date, event_time, description, image_url
    FROM events
    WHERE event_date >= CURDATE()
    ORDER BY event_date ASC, event_time ASC
  `;

  db.query(annSql, (err, announcements) => {
    if (err) {
      console.error("Announcements DB error:", err);
      return res.send("Database error");
    }

    db.query(eventSql, (err2, events) => {
      if (err2) {
        console.error("Events DB error:", err2);
        events = [];
      }

      res.render("announcements", {
        title: "Announcements",
        announcements,
        events,
      });
    });
  });
});

// ======================================================
// RESIDENT PAGES – FACILITIES (DB-DRIVEN)
// Table: Facilities (facility_id, name, description, open_time, close_time, image_url)
// ======================================================
router.get("/facilities", requireLogin, (req, res) => {
  const sql = "SELECT * FROM Facilities ORDER BY facility_id ASC";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Facilities DB error:", err);
      return res.send("Database error");
    }

    res.render("facilities", {
      title: "Facilities",
      facilities: results,
    });
  });
});

// ======================================================
// FACILITY BOOKING (RESIDENT) - BOOK PAGE (DB-DRIVEN)
// ======================================================
router.get("/facilities/book/:facilityId", requireLogin, (req, res) => {
  const facilityId = parseInt(req.params.facilityId, 10);
  const selectedDate = req.query.date || new Date().toISOString().slice(0, 10);

  const facilitySql = `
    SELECT facility_id, name, description, capacity
    FROM Facilities
    WHERE facility_id = ?
  `;

  db.query(facilitySql, [facilityId], (err, facilities) => {
    if (err) return res.status(500).send("Database error");
    if (facilities.length === 0) return res.status(404).send("Facility not found");

    const facility = facilities[0];

    const countSql = `
      SELECT time_slot, COUNT(*) AS booked_count
      FROM FacilityBookings
      WHERE facility_id = ? AND booking_date = ?
      GROUP BY time_slot
    `;

    db.query(countSql, [facilityId, selectedDate], (err2, rows) => {
      if (err2) return res.status(500).send("Database error");

      const bookedMap = {};
      rows.forEach((r) => (bookedMap[r.time_slot] = r.booked_count));

      res.render("bookFacility", {
        title: "Book Facility",
        facility,
        selectedDate,
        bookedMap,
      });
    });
  });
});

// ======================================================
// FACILITY BOOKING (RESIDENT) - SUBMIT BOOKING (USES facility_id)
// Table: FacilityBookings (facility_id, resident_name, unit_number, contact_number, booking_date, time_slot, ...)
// ======================================================
router.post("/facilities/book", requireLogin, (req, res) => {
  const facilityId = parseInt(req.body.facility_id, 10);
  const { resident_name, unit_number, contact_number, booking_date, time_slot } = req.body;

  const capSql = `SELECT name, capacity FROM Facilities WHERE facility_id = ?`;
  db.query(capSql, [facilityId], (err, frows) => {
    if (err) return res.status(500).send(err.message);
    if (frows.length === 0) return res.status(400).send("Invalid facility");

    const facility_name = frows[0].name;
    const capacity = frows[0].capacity;

    const countSql = `
      SELECT COUNT(*) AS booked
      FROM FacilityBookings
      WHERE facility_id = ? AND booking_date = ? AND time_slot = ?
    `;
    db.query(countSql, [facilityId, booking_date, time_slot], (err2, crows) => {
      if (err2) return res.status(500).send(err2.message);

      if (crows[0].booked >= capacity) {
        return res.status(400).send("This time slot is FULL. Please choose another.");
      }

      const insertSql = `
        INSERT INTO FacilityBookings
        (facility_id, resident_name, unit_number, contact_number, booking_date, time_slot)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      db.query(insertSql, [facilityId, resident_name, unit_number, contact_number, booking_date, time_slot], (err3) => {
        if (err3) return res.status(500).send(err3.message);

        res.render("bookingSuccess", {
          title: "Booking Confirmed",
          facility_name,
          booking_date,
          time_slot,
        });
      });
    });
  });
});

// ======================================================
// MAINTENANCE REQUEST (RESIDENT)
// ======================================================
router.get("/maintenance-request", requireLogin, (req, res) => {
  res.render("maintenanceRequest", {
    title: "Submit Maintenance Request",
    error: null,
  });
});

router.post("/maintenance-request", requireLogin, (req, res) => {
  const { resident_name, unit_number, contact_number, facility_name, issue_type, description } = req.body;

  if (!resident_name || !unit_number || !contact_number || !issue_type || !description) {
    return res.status(400).render("maintenanceRequest", {
      title: "Submit Maintenance Request",
      error: "All required fields must be filled.",
    });
  }

  const findUnitSql = "SELECT unit_id FROM units WHERE unit_no = ?";

  db.query(findUnitSql, [unit_number], (err, rows) => {
    if (err) {
      console.error("Error looking up unit:", err);
      return res.status(500).render("maintenanceRequest", {
        title: "Submit Maintenance Request",
        error: "Database error when checking unit number.",
      });
    }

    if (rows.length === 0) {
      return res.status(400).render("maintenanceRequest", {
        title: "Submit Maintenance Request",
        error: "Unit not found. Please enter a valid unit number.",
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
      [unitId, unit_number, `${resident_name} (${contact_number})`, issue_type || facility_name || "General", "Normal", "Pending", description],
      (err2) => {
        if (err2) {
          console.error("Database error on insert:", err2);
          return res.status(500).render("maintenanceRequest", {
            title: "Submit Maintenance Request",
            error: "Error: " + err2.message,
          });
        }

        return res.render("maintenanceSuccess", {
          title: "Request Submitted",
          resident_name,
          unit_number,
          issue_type: issue_type || facility_name || "General",
        });
      }
    );
  });
});

// ======================================================
// ADMIN PAGES – BOOKINGS (JOIN Facilities so name always correct)
// ======================================================
router.get("/admin/bookings", requireAdmin, (req, res) => {
  const sql = `
    SELECT 
      fb.id,
      f.name AS facility_name,
      fb.resident_name,
      fb.unit_number,
      fb.contact_number,
      fb.booking_date,
      fb.time_slot,
      fb.created_at
    FROM FacilityBookings fb
    JOIN Facilities f ON fb.facility_id = f.facility_id
    ORDER BY fb.created_at DESC
    LIMIT 20
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Admin bookings DB error:", err);
      return res.send("Database error");
    }

    res.render("adminBookings", {
      title: "Facility Bookings",
      bookings: results,
    });
  });
});

// ======================================================
// ADMIN PAGES – MAINTENANCE OVERVIEW
// ======================================================
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
      requests: results,
    });
  });
});

router.post("/admin/maintenance/:id/status", requireAdmin, (req, res) => {
  const requestId = req.params.id;
  const { status } = req.body;

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
// ADMIN PAGES – EVENTS (CRUD: CREATE + UPDATE)
// Table: events (event_id, title, event_date, event_time, description, image_url, created_at)
// ======================================================

// List events
router.get("/admin/events", requireAdmin, (req, res) => {
  const sql = `
    SELECT event_id, title, event_date, event_time, description, image_url, created_at
    FROM events
    ORDER BY event_date ASC, event_time ASC
  `;

  db.query(sql, (err, events) => {
    if (err) {
      console.error("Admin events list DB error:", err);
      return res.status(500).send("Database error");
    }

    res.render("adminEvents", {
      title: "Manage Events",
      events,
    });
  });
});

// New event form
router.get("/admin/events/new", requireAdmin, (req, res) => {
  res.render("adminEventForm", {
    title: "Create Event",
    mode: "create",
    event: {
      title: "",
      event_date: "",
      event_time: "",
      description: "",
      image_url: "",
    },
    error: null,
  });
});

// Create event (POST)
router.post("/admin/events/new", requireAdmin, (req, res) => {
  const { title, event_date, event_time, description, image_url } = req.body;

  if (!title || !event_date || !event_time) {
    return res.render("adminEventForm", {
      title: "Create Event",
      mode: "create",
      event: { title, event_date, event_time, description, image_url },
      error: "Title, Event Date and Event Time are required.",
    });
  }

  const sql = `
    INSERT INTO events (title, event_date, event_time, description, image_url)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [title, event_date, event_time, description || null, image_url || null], (err) => {
    if (err) {
      console.error("Create event DB error:", err);
      return res.render("adminEventForm", {
        title: "Create Event",
        mode: "create",
        event: { title, event_date, event_time, description, image_url },
        error: "Database error: " + err.message,
      });
    }

    res.redirect("/admin/events");
  });
});

// Edit event form
router.get("/admin/events/:id/edit", requireAdmin, (req, res) => {
  const eventId = parseInt(req.params.id, 10);

  const sql = `
    SELECT event_id, title, event_date, event_time, description, image_url
    FROM events
    WHERE event_id = ?
    LIMIT 1
  `;

  db.query(sql, [eventId], (err, rows) => {
    if (err) {
      console.error("Edit event lookup DB error:", err);
      return res.status(500).send("Database error");
    }
    if (rows.length === 0) return res.status(404).send("Event not found");

    // Format date to YYYY-MM-DD for <input type="date">
    const ev = rows[0];
    const dateVal = ev.event_date ? new Date(ev.event_date).toISOString().slice(0, 10) : "";

    // TIME could be "19:00:00", keep "HH:MM" for <input type="time">
    let timeVal = "";
    if (ev.event_time) {
      if (typeof ev.event_time === "string") timeVal = ev.event_time.slice(0, 5);
      else if (ev.event_time instanceof Date) {
        const hh = String(ev.event_time.getHours()).padStart(2, "0");
        const mm = String(ev.event_time.getMinutes()).padStart(2, "0");
        timeVal = `${hh}:${mm}`;
      } else {
        timeVal = String(ev.event_time).slice(0, 5);
      }
    }

    res.render("adminEventForm", {
      title: "Update Event",
      mode: "edit",
      event: {
        event_id: ev.event_id,
        title: ev.title || "",
        event_date: dateVal,
        event_time: timeVal,
        description: ev.description || "",
        image_url: ev.image_url || "",
      },
      error: null,
    });
  });
});

// Update event (POST)
router.post("/admin/events/:id/edit", requireAdmin, (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  const { title, event_date, event_time, description, image_url } = req.body;

  if (!title || !event_date || !event_time) {
    return res.render("adminEventForm", {
      title: "Update Event",
      mode: "edit",
      event: { event_id: eventId, title, event_date, event_time, description, image_url },
      error: "Title, Event Date and Event Time are required.",
    });
  }

  const sql = `
    UPDATE events
    SET title = ?, event_date = ?, event_time = ?, description = ?, image_url = ?
    WHERE event_id = ?
  `;

  db.query(
    sql,
    [title, event_date, event_time, description || null, image_url || null, eventId],
    (err) => {
      if (err) {
        console.error("Update event DB error:", err);
        return res.render("adminEventForm", {
          title: "Update Event",
          mode: "edit",
          event: { event_id: eventId, title, event_date, event_time, description, image_url },
          error: "Database error: " + err.message,
        });
      }

      res.redirect("/admin/events");
    }
  );
});

// ======================================================
// PAYMENTS (CONDO FEE + CARPARK FEE) USING invoices + payments tables
// ======================================================

// RESIDENT: view invoices + latest payment status
router.get("/resident/payments", requireLogin, (req, res) => {
  const userId = req.session.userId;

  const sql = `
    SELECT 
      i.invoice_id,
      i.unit_id,
      u.unit_no,
      i.period_start,
      i.period_end,
      i.status AS invoice_status,
      i.total_amount,
      i.condo_fee,
      i.carpark_fee,

      p.payment_id,
      p.method,
      p.reference_no,
      p.amount AS paid_amount,
      p.paid_at,
      p.status AS payment_status
    FROM residents r
    JOIN units u 
      ON (u.owner_resident_id = r.resident_id OR u.tenant_resident_id = r.resident_id)
    JOIN invoices i 
      ON i.unit_id = u.unit_id
    LEFT JOIN payments p 
      ON p.payment_id = (
        SELECT p2.payment_id
        FROM payments p2
        WHERE p2.invoice_id = i.invoice_id
        ORDER BY p2.paid_at DESC
        LIMIT 1
      )
    WHERE r.user_id = ?
    ORDER BY i.period_start DESC
  `;

  db.query(sql, [userId], (err, invoices) => {
    if (err) {
      console.error("Resident payments DB error:", err);
      return res.render("residentPayments", {
        title: "Payments",
        error: "Database error: " + err.message,
        invoices: [],
        userName: req.session.userName || "Resident",
      });
    }

    res.render("residentPayments", {
      title: "Payments",
      error: null,
      invoices,
      userName: req.session.userName || "Resident",
    });
  });
});

// RESIDENT: submit payment for an invoice
router.post("/resident/payments/submit", requireLogin, (req, res) => {
  const { invoiceId, method, referenceNo, amount } = req.body;

  if (!invoiceId || !method || !amount) {
    return res.redirect("/resident/payments");
  }

  const insertSql = `
    INSERT INTO payments (invoice_id, method, reference_no, amount, paid_at, status)
    VALUES (?, ?, ?, ?, NOW(), 'Pending')
  `;

  db.query(
    insertSql,
    [Number(invoiceId), method, referenceNo || null, Number(amount)],
    (err) => {
      if (err) {
        console.error("Submit payment error:", err);
        return res.redirect("/resident/payments");
      }

      // Optional: mark invoice as Pending
      db.query(
        `UPDATE invoices SET status = 'Pending' WHERE invoice_id = ?`,
        [Number(invoiceId)],
        () => res.redirect("/resident/payments")
      );
    }
  );
});

// ADMIN: view all submitted payments
router.get("/admin/payments", requireAdmin, (req, res) => {
  const sql = `
    SELECT
      p.payment_id,
      p.invoice_id,
      p.method,
      p.reference_no,
      p.amount,
      p.paid_at,
      p.status AS payment_status,

      i.unit_id,
      u.unit_no,
      i.period_start,
      i.period_end,
      i.status AS invoice_status,
      i.total_amount,
      i.condo_fee,
      i.carpark_fee
    FROM payments p
    JOIN invoices i ON i.invoice_id = p.invoice_id
    JOIN units u ON u.unit_id = i.unit_id
    ORDER BY p.paid_at DESC
  `;

  db.query(sql, (err, payments) => {
    if (err) {
      console.error("Admin payments DB error:", err);
      return res.render("adminPayments", {
        title: "Manage Payments",
        error: "Database error: " + err.message,
        payments: [],
        userName: req.session.userName || "Admin",
      });
    }

    res.render("adminPayments", {
      title: "Manage Payments",
      error: null,
      payments,
      userName: req.session.userName || "Admin",
    });
  });
});

// ADMIN: approve/reject a payment
router.post("/admin/payments/update", requireAdmin, (req, res) => {
  const { paymentId, action } = req.body; // Approved / Rejected

  if (!paymentId || !["Approved", "Rejected"].includes(action)) {
    return res.redirect("/admin/payments");
  }

  db.query(
    `UPDATE payments SET status = ? WHERE payment_id = ?`,
    [action, Number(paymentId)],
    (err) => {
      if (err) {
        console.error("Update payment status error:", err);
        return res.redirect("/admin/payments");
      }

      const invoiceSql =
        action === "Approved"
          ? `
            UPDATE invoices i
            JOIN payments p ON p.invoice_id = i.invoice_id
            SET i.status = 'Paid'
            WHERE p.payment_id = ?
          `
          : `
            UPDATE invoices i
            JOIN payments p ON p.invoice_id = i.invoice_id
            SET i.status = 'Unpaid'
            WHERE p.payment_id = ?
          `;

      db.query(invoiceSql, [Number(paymentId)], () => {
        res.redirect("/admin/payments");
      });
    }
  );
});

/// ======================================================
// ADMIN: RESIDENT MANAGEMENT
// Uses:
//   users(user_id, name, email, password_hash, role, created_at)
//   residents(resident_id, user_id, phone)
//   units(unit_id, unit_no, owner_resident_id, tenant_resident_id)
// ======================================================

// LIST residents
router.get("/admin/residents", requireAdmin, (req, res) => {
  const sql = `
    SELECT
      r.resident_id,
      u.user_id,
      u.name,
      u.email,
      u.created_at,
      r.phone,
      GROUP_CONCAT(DISTINCT un.unit_no ORDER BY un.unit_no SEPARATOR ', ') AS unit_numbers
    FROM residents r
    JOIN users u ON u.user_id = r.user_id
    LEFT JOIN units un
      ON un.owner_resident_id = r.resident_id
      OR un.tenant_resident_id = r.resident_id
    GROUP BY r.resident_id, u.user_id, u.name, u.email, u.created_at, r.phone
    ORDER BY r.resident_id DESC
  `;

  db.query(sql, (err, residents) => {
    if (err) {
      console.error("Admin residents list error:", err);
      return res.render("adminResidents", {
        title: "Manage Residents",
        error: "Database error: " + err.message,
        residents: [],
        userName: req.session.userName || "Admin",
      });
    }

    res.render("adminResidents", {
      title: "Manage Residents",
      error: null,
      residents,
      userName: req.session.userName || "Admin",
    });
  });
});

// SHOW add resident form
router.get("/admin/residents/new", requireAdmin, (req, res) => {
  res.render("adminResidentForm", {
    title: "Add Resident",
    error: null,
    form: { name: "", email: "", password: "", phone: "", unit_no: "", unit_role: "owner" }, // unit_role: owner/tenant
    userName: req.session.userName || "Admin",
  });
});

// CREATE resident (users row + residents row + optional link unit)
router.post("/admin/residents/new", requireAdmin, (req, res) => {
  const { name, email, password, phone, unit_no, unit_role } = req.body;

  if (!name || !email || !password) {
    return res.render("adminResidentForm", {
      title: "Add Resident",
      error: "Name, Email and Password are required.",
      form: { name, email, password, phone, unit_no, unit_role: unit_role || "owner" },
      userName: req.session.userName || "Admin",
    });
  }

  // 1) create user
  const userSql = `
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, 'resident')
  `;

  db.query(userSql, [name, email, password], (err, userResult) => {
    if (err) {
      console.error("Create resident user error:", err);
      return res.render("adminResidentForm", {
        title: "Add Resident",
        error: "Database error: " + err.message,
        form: { name, email, password, phone, unit_no, unit_role: unit_role || "owner" },
        userName: req.session.userName || "Admin",
      });
    }

    const newUserId = userResult.insertId;

    // 2) create resident profile
    const residentSql = `INSERT INTO residents (user_id, phone) VALUES (?, ?)`;
    db.query(residentSql, [newUserId, phone || null], (err2, resResult) => {
      if (err2) {
        console.error("Create resident profile error:", err2);
        return res.render("adminResidentForm", {
          title: "Add Resident",
          error: "Database error: " + err2.message,
          form: { name, email, password, phone, unit_no, unit_role: unit_role || "owner" },
          userName: req.session.userName || "Admin",
        });
      }

      const newResidentId = resResult.insertId;

      // 3) optional: link unit by unit_no
      if (!unit_no) return res.redirect("/admin/residents");

      // make sure unit exists
      db.query(`SELECT unit_id FROM units WHERE unit_no = ? LIMIT 1`, [unit_no], (err3, unitRows) => {
        if (err3) {
          console.error("Unit lookup error:", err3);
          return res.render("adminResidentForm", {
            title: "Add Resident",
            error: "Unit lookup failed: " + err3.message,
            form: { name, email, password, phone, unit_no, unit_role: unit_role || "owner" },
            userName: req.session.userName || "Admin",
          });
        }

        if (unitRows.length === 0) {
          return res.render("adminResidentForm", {
            title: "Add Resident",
            error: "Unit not found. Please enter a valid unit number (e.g., 101).",
            form: { name, email, password, phone, unit_no, unit_role: unit_role || "owner" },
            userName: req.session.userName || "Admin",
          });
        }

        const col = (unit_role || "owner") === "tenant" ? "tenant_resident_id" : "owner_resident_id";
        const updSql = `UPDATE units SET ${col} = ? WHERE unit_no = ?`;

        db.query(updSql, [newResidentId, unit_no], (err4) => {
          if (err4) console.error("Link unit error:", err4);
          return res.redirect("/admin/residents");
        });
      });
    });
  });
});

// RESIDENT detail page (optional)
router.get("/admin/residents/:id", requireAdmin, (req, res) => {
  const residentId = parseInt(req.params.id, 10);
  if (Number.isNaN(residentId)) return res.status(400).send("Invalid resident id");

  const sql = `
    SELECT
      r.resident_id,
      r.phone,
      u.user_id,
      u.name,
      u.email,
      u.created_at,
      GROUP_CONCAT(DISTINCT un.unit_no ORDER BY un.unit_no SEPARATOR ', ') AS unit_numbers
    FROM residents r
    JOIN users u ON u.user_id = r.user_id
    LEFT JOIN units un
      ON un.owner_resident_id = r.resident_id
      OR un.tenant_resident_id = r.resident_id
    WHERE r.resident_id = ?
    GROUP BY r.resident_id, r.phone, u.user_id, u.name, u.email, u.created_at
    LIMIT 1
  `;

  db.query(sql, [residentId], (err, rows) => {
    if (err) {
      console.error("Resident lookup error:", err);
      return res.status(500).send("Database error: " + err.message);
    }
    if (rows.length === 0) return res.status(404).send("Resident not found");

    // If you have a EJS detail page, change this:
    // res.render("adminResidentDetail", { title: "Resident Details", resident: rows[0] });
    res.json(rows[0]);
  });
});
module.exports = router;