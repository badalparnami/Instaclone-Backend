const Comment = require("../models/comment");
const CommentReply = require("../models/commentReply");
const Post = require("../models/post");
const User = require("../models/user");
const HttpError = require("../models/http-error");

exports.create = async (req, res, next) => {
  const { postid, text } = req.body;

  let post;
  try {
    post = await Post.findById(postid);
  } catch (err) {
    const error = new HttpError("Could not create comment #a", 500);
    return next(error);
  }

  if (!post) {
    const error = new HttpError("Post not found", 404);
    return next(error);
  }

  if (!post.allowComment) {
    const error = new HttpError("Comments not allowed", 422);
    return next(error);
  }

  let creator;
  try {
    creator = await User.findById(req.userId);
  } catch (err) {
    const error = new HttpError("Could not create comment #b", 500);
    return next(error);
  }

  let isBlocked = creator.blocked.find((b) => b == post.creator);

  if (isBlocked) {
    const error = new HttpError(
      "Could not perform this action on blocked user #a",
      422
    );
    return next(error);
  }

  isBlocked = creator.blockedby.find((b) => b == post.creator);

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

  res.status(201).json({
    message: "success",
    commentId: comment.id,
    text: comment.text,
    date: comment.date,
  });
};

exports.toggleLike = async (req, res, next) => {
  const { commentId } = req.body;

  let comment;
  try {
    comment = await Comment.findById(commentId);
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
    user = await User.findById(req.userId);
  } catch (err) {
    const error = new HttpError("Could not perform action #b", 500);
    return next(error);
  }

  const isAlreadyLiked = comment.like.find((cl) => cl == user.id);

  if (isAlreadyLiked) {
    comment.like = comment.like.filter((cl) => cl != user.id);
  } else {
    let isBlocked = user.blocked.find((b) => b == comment.creator);

    if (isBlocked) {
      const error = new HttpError(
        "Could not perform this action on blocked user #a",
        422
      );
      return next(error);
    }

    isBlocked = user.blockedby.find((b) => b == comment.creator);

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
    comment = await Comment.findById(commentId);
  } catch (err) {
    const error = new HttpError("Could not delete comment #a", 500);
    return next(error);
  }

  if (!comment) {
    const error = new HttpError("Comment not found", 404);
    return next(error);
  }

  let user;
  try {
    user = await User.findById(req.userId);
  } catch (err) {
    const error = new HttpError("Could not delete comment #b", 500);
    return next(error);
  }

  if (comment.creator != user.id) {
    const error = new HttpError("Not authorized to delete comment", 401);
    return next(error);
  }

  let post;
  try {
    post = await Post.findById(comment.post);
  } catch (err) {
    const error = new HttpError("Could not delete comment #c", 500);
    return next(error);
  }

  post.comment = post.comment.filter((pc) => pc != comment.id);

  try {
    await CommentReply.deleteMany({ parentComment: comment.id });
    await Comment.findByIdAndDelete(commentId);
    await post.save();
  } catch (err) {
    const error = new HttpError("Could not delete comment #d", 500);
    return next(error);
  }

  res.status(201).json({ message: "success" });
};

exports.getCommentReplies = async (req, res, next) => {
  const { id, skip } = req.params;

  let comment;

  try {
    comment = await Comment.findById(id).populate({
      path: "reply",
      options: { sort: { date: -1 }, limit: 3, skip: +skip },
      populate: { path: "creator" },
    });
  } catch (err) {
    const error = new HttpError("Could not update profile #a", 500);
    return next(error);
  }

  if (!comment) {
    const error = new HttpError("Comment Not Found", 404);
    return next(error);
  }

  const commentDetails = comment.reply.map((c) => ({
    username: c.creator.username,
    avatar: c.creator.avatar,
    text: c.text,
    likeCount: c.like.length,
    isLiked: req.userId
      ? c.like.find((l) => l == req.userId)
        ? true
        : false
      : false,
    id: c._id,
    date: c.date,
  }));

  res.status(200).json({ details: commentDetails.reverse() });
};

exports.getComments = async (req, res, next) => {
  const { id, skip } = req.params;

  let post;

  try {
    post = await Post.findById(id).populate({
      path: "comment",
      options: { limit: 18, skip: +skip * 18 },
      populate: { path: "creator" },
    });
  } catch (err) {
    const error = new HttpError("Could not get comments #a", 500);
    return next(error);
  }

  if (!post) {
    const error = new HttpError("Post Not Found", 404);
    return next(error);
  }

  const commentDetails = post.comment.map((c) => ({
    username: c.creator.username,
    avatar: c.creator.avatar,
    text: c.text,
    likeCount: c.like.length,
    replyCount: c.reply.length,
    isLiked: req.userId
      ? c.like.find((l) => l == req.userId)
        ? true
        : false
      : false,
    id: c._id,
    date: c.date,
  }));

  res.status(200).json({ details: commentDetails });
};
