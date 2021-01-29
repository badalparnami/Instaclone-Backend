const Comment = require("../models/comment");
const Post = require("../models/post");
const User = require("../models/user");
const HttpError = require("../models/http-error");

exports.create = async (req, res, next) => {
  const { postid, text } = req.body;

  let post;
  try {
    post = Post.findById(postid);
  } catch (err) {
    const error = new HttpError("Could not create comment #a", 500);
    return next(error);
  }

  if (!post) {
    const error = new HttpError("Post not found", 404);
    return next(error);
  }

  let creator;
  try {
    creator = User.findById(req.userId);
  } catch (err) {
    const error = new HttpError("Could not create comment #b", 500);
    return next(error);
  }

  let isBlocked = creator.blocked.find((b) => b === post.creator);

  if (isBlocked) {
    const error = new HttpError(
      "Could not perform this action on blocked user #a",
      422
    );
    return next(error);
  }

  isBlocked = creator.blockedby.find((b) => b === post.creator);

  if (isBlocked) {
    const error = new HttpError(
      "Could not perform this action on blocked user #b",
      422
    );
    return next(error);
  }

  const comment = new Comment({ creator, post, text });

  post.comment = [...post.comment, comment];

  try {
    await post.save();
    await comment.save();
  } catch (err) {
    const error = new HttpError("Could not create comment #c", 500);
    return next(error);
  }
};

exports.toggleLike = async (req, res, next) => {
  const { commentId } = req.body;

  let comment;
  try {
    comment = Comment.findById(commentId);
  } catch (err) {
    const error = new HttpError("Could not perform action #a", 500);
    return next(error);
  }

  if (!comment) {
    const error = new HttpError("Comment not found", 404);
    return next(error);
  }

  let user;
  try {
    user = User.findById(req.userId);
  } catch (err) {
    const error = new HttpError("Could not perform action #b", 500);
    return next(error);
  }

  const isAlreadyLiked = comment.like.find((cl) => cl === user);

  if (isAlreadyLiked) {
    comment.like = comment.like.filter((cl) => cl !== user);
  } else {
    let isBlocked = user.blocked.find((b) => b === comment.creator);

    if (isBlocked) {
      const error = new HttpError(
        "Could not perform this action on blocked user #a",
        422
      );
      return next(error);
    }

    isBlocked = user.blockedby.find((b) => b === comment.creator);

    if (isBlocked) {
      const error = new HttpError(
        "Could not perform this action on blocked user #b",
        422
      );
      return next(error);
    }

    comment.like = [...comment.like, user];
  }

  try {
    await comment.save();
  } catch (err) {
    const error = new HttpError("Could not perform action #c", 500);
    return next(error);
  }

  res.status(201).json({ message: "success" });
};

exports.delete = async (req, res, next) => {
  const { commentId } = req.body;

  let comment;
  try {
    comment = Comment.findById(commentId);
  } catch (err) {
    const error = new HttpError("Could not delte comment #a", 500);
    return next(error);
  }

  if (!comment) {
    const error = new HttpError("Comment not found", 404);
    return next(error);
  }

  let user;
  try {
    user = User.findById(req.userId);
  } catch (err) {
    const error = new HttpError("Could not delete comment #b", 500);
    return next(error);
  }

  if (comment.creator !== user) {
    const error = new HttpError("Not authorized to delete comment", 401);
    return next(error);
  }

  let post;
  try {
    post = Post.findById(comment.post);
  } catch (err) {
    const error = new HttpError("Could not delete comment #c", 500);
    return next(error);
  }

  post.comment = post.comment.filter((pc) => pc !== comment);

  try {
    await Comment.findByIdAndDelete(commentId);
    await post.save();
  } catch (err) {
    const error = new HttpError("Could not delete comment #d", 500);
    return next(error);
  }
};
