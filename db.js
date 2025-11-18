// db.js
const mysql = require("mysql2");

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Republic_C207',
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
