// db.js
const mysql = require("mysql2");

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Republic_C207', // Standard PW is Republic_C207, change this password when running code.
    database: 'condoManagement',
    port: 3306
});

// Connect to MySQL
connection.connect((err) => {
    if (err) {
        console.error("MySQL connection failed:", err);
        return;
    }
    console.log("MySQL connected successfully.");
});

module.exports = connection;
