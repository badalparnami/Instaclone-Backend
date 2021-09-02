const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  avatar: {
    type: String,
  },
  website: {
    type: String,
  },
  bio: {
    type: String,
  },
  private: {
    type: Boolean,
    default: false,
  },
  prevUsernameDetails: [], //username, date
  lastUsernameChanged: {
    type: Date,
  },
  manuallyApproveTag: {
    type: Boolean,
    default: false,
  },
  tag: {
    type: String,
    default: "everyone", //everyone, follow, none
  },
  mention: {
    type: String,
    default: "everyone",
  },
  date: {
    type: Date,
    default: Date.now,
  },
  post: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "Post",
    },
  ],
  like: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "Post",
    },
  ],
  saved: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "Post",
    },
  ],
  follower: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "User",
    },
  ],
  following: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "User",
    },
  ],
  blocked: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "User",
    },
  ],
  blockedby: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "User",
    },
  ],
  closeFriend: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "User",
    },
  ],
  pendingFollower: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "User",
    },
  ],
  pendingFollowing: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "User",
    },
  ],
  archivePost: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "Post",
    },
  ],
  taggedPost: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "Post",
    },
  ],
  pendingTaggedPost: [
    {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "Post",
    },
  ],
});

module.exports = mongoose.model("User", userSchema);
