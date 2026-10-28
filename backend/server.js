
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const movieRoutes = require("./routes/movieRoutes");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
}));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Movie Watchlist API is running.",
    data: null,
  });
});

app.use("/api/movies", movieRoutes);

// Consistent JSON for invalid routes and server errors.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
    data: null,
  });
});

app.use((err, req, res, next) => {
  console.error(err.message);

  if (err.name === "ValidationError" || err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: err.message,
      data: null,
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error.",
    data: null,
  });
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB Atlas connected successfully.");
    app.listen(PORT, () => {
      console.log(`Backend running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
