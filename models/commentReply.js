const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const commentReplySchema = new Schema({
  creator: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  parentComment: {
    type: Schema.Types.ObjectId,
    ref: "Comment",
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now(),
  },
  like: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "User",
    },
  ],
});

module.exports = mongoose.model("CommentReply", commentReplySchema);
