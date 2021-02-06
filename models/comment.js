const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const commentSchema = new Schema({
  creator: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  post: {
    type: Schema.Types.ObjectId,
    ref: "Post",
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  like: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "User",
    },
  ],
  reply: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "CommentReply",
    },
  ],
});

module.exports = mongoose.model("Comment", commentSchema);
