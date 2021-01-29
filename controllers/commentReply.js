const User = require("../models/user");
const Comment = require("../models/comment");
const CommentReply = require("../models/commentReply");
const HttpError = require("../models/http-error");

exports.create = async (req, res, next) => {
  const { comment, text } = req.body;

  let parentComment;
  try {
    parentComment = Comment.findById(comment);
  } catch (err) {
    const error = new HttpError("Could not create comment #a", 500);
    return next(error);
  }

  if (!parentComment) {
    const error = new HttpError("Could not found parent comment", 404);
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

  const commentReply = new CommentReply({ creator, parentComment, text });

  parentComment.reply = [...parentComment.reply, commentReply];

  try {
    await parentComment.save();
    await commentReply.save();
  } catch (err) {
    const error = new HttpError("Could not create comment #c", 500);
    return next(error);
  }
};

exports.toggleLike = async (req, res, next) => {
  const { commentId } = req.body;

  let commentReply;
  try {
    commentReply = CommentReply.findById(commentId);
  } catch (err) {
    const error = new HttpError("Could not perform action #a", 500);
    return next(error);
  }

  if (!commentReply) {
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

  const isAlreadyLiked = commentReply.like.find((cl) => cl === user);

  if (isAlreadyLiked) {
    commentReply.like = commentReply.like.filter((cl) => cl !== user);
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

    commentReply.like = [...commentReply.like, user];
  }

  try {
    await commentReply.save();
  } catch (err) {
    const error = new HttpError("Could not perform action #c", 500);
    return next(error);
  }

  res.status(201).json({ message: "success" });
};

exports.delete = async (req, res, next) => {
  const { commentId } = req.body;

  let commentReply;
  try {
    commentReply = CommentReply.findById(commentId);
  } catch (err) {
    const error = new HttpError("Could not delete comment #a", 500);
    return next(error);
  }

  if (!commentReply) {
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

  if (commentReply.creator !== user) {
    const error = new HttpError("Not authorized to delete comment", 401);
    return next(error);
  }

  let comment;
  try {
    comment = Comment.findById(commentReply.parentComment);
  } catch (err) {
    const error = new HttpError("Could not delete comment #c", 500);
    return next(error);
  }

  comment.reply = comment.reply.filter((cr) => cr !== commentReply);

  try {
    await CommentReply.findByIdAndDelete(commentId);
    await comment.save();
  } catch (err) {
    const error = new HttpError("Could not delete comment #d", 500);
    return next(error);
  }
};
