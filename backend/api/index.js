const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/status", (req, res) => {
  res.json({
    message: "Welcome to Troop API!",
    status: "Active",
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
