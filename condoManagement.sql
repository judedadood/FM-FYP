CREATE DATABASE IF NOT EXISTS `condoManagement`;
USE `condoManagement`;

-- ===============================
--  roles
-- ===============================
CREATE TABLE roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL
);

-- ===============================
--  users
-- ===============================
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
--  user_roles
-- ===============================
CREATE TABLE user_roles (
    user_id INT,
    role_id INT,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

-- ===============================
--  residents
-- ===============================
CREATE TABLE residents (
    resident_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    phone VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ===============================
--  units
-- ===============================
CREATE TABLE units (
    unit_id INT AUTO_INCREMENT PRIMARY KEY,
    unit_no VARCHAR(20) NOT NULL,
    type VARCHAR(50),
    owner_resident_id INT,
    tenant_resident_id INT,
    FOREIGN KEY (owner_resident_id) REFERENCES residents(resident_id),
    FOREIGN KEY (tenant_resident_id) REFERENCES residents(resident_id)
);

-- ===============================
--  amenities
-- ===============================
CREATE TABLE amenities (
    amenity_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    deposit_required DECIMAL(10,2),
    booking_fee DECIMAL(10,2)
);

-- ===============================
--  amenity_bookings
-- ===============================
CREATE TABLE amenity_bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    amenity_id INT,
    resident_id INT,
    start_dt DATETIME,
    end_dt DATETIME,
    status VARCHAR(30),
    paid_amount DECIMAL(10,2),
    FOREIGN KEY (amenity_id) REFERENCES amenities(amenity_id),
    FOREIGN KEY (resident_id) REFERENCES residents(resident_id)
);

-- ===============================
--  maintenance_requests
-- ===============================
CREATE TABLE maintenance_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    unit_id INT,
    requested_by INT,
    category VARCHAR(100),
    priority VARCHAR(50),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (unit_id) REFERENCES units(unit_id),
    FOREIGN KEY (requested_by) REFERENCES residents(resident_id)
);

-- ===============================
--  vendors
-- ===============================
CREATE TABLE vendors (
    vendor_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact_email VARCHAR(100),
    phone VARCHAR(20)
);

-- ===============================
--  work_orders
-- ===============================
CREATE TABLE work_orders (
    workorder_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT,
    vendor_id INT,
    assigned_to INT,
    scheduled_dt DATETIME,
    completed_dt DATETIME,
    cost DECIMAL(10,2),
    status VARCHAR(50),
    FOREIGN KEY (request_id) REFERENCES maintenance_requests(request_id),
    FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
    FOREIGN KEY (assigned_to) REFERENCES users(user_id)
);

-- ===============================
--  invoices
-- ===============================
CREATE TABLE invoices (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    unit_id INT,
    period_start DATE,
    period_end DATE,
    status VARCHAR(30),
    total_amount DECIMAL(10,2),
    FOREIGN KEY (unit_id) REFERENCES units(unit_id)
);

-- ===============================
--  payments
-- ===============================
CREATE TABLE payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT,
    method VARCHAR(50),
    reference_no VARCHAR(100),
    amount DECIMAL(10,2),
    paid_at DATETIME,
    status VARCHAR(30),
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
);
