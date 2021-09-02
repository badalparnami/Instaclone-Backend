const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const postSchema = new Schema({
  media: {
    type: String,
    required: true,
  },
  caption: {
    type: String,
  },
  allowComment: {
    type: Boolean,
    default: true,
  },
  creator: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  styles: {
    type: Object,
  },
  isArchived: {
    type: Boolean,
    default: false,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  tag: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "User",
    },
  ],
  like: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "User",
    },
  ],
  comment: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "Comment",
    },
  ],
  hashTag: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "Hashtag",
    },
  ],
});

module.exports = mongoose.model("Post", postSchema);
