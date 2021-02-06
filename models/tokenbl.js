const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const tokenBlSchema = new Schema({
  token: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("TokenBl", tokenBlSchema);
