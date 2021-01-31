const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const hashTagSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  post: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "Post",
    },
  ],
});

module.exports = mongoose.model("Hashtag", hashTagSchema);
