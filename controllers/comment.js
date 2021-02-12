const Comment = require("../models/comment");
const CommentReply = require("../models/commentReply");
const Post = require("../models/post");
const User = require("../models/user");
const HttpError = require("../models/http-error");
const ObjectId = require("mongoose").Types.ObjectId;

exports.create = async (req, res, next) => {
  const { postid, text } = req.body;

  let post;
  try {
    post = await Post.findById(postid).select({
      creator: 1,
      allowComment: 1,
      comment: 1,
      isArchived: 1,
    });
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

  if (post.isArchived) {
    const error = new HttpError(
      "Comments not allowed on the archive post",
      422
    );
    return next(error);
  }

  let creator;
  try {
    creator = await User.findById(req.userId)
      .select({
        blocked: 1,
        blockedby: 1,
      })
      .lean();
  } catch (err) {
    const error = new HttpError("Could not create comment #b", 500);
    return next(error);
  }

  let isBlocked = creator.blocked.find(
    (b) => String(b) == String(post.creator)
  );

  if (isBlocked) {
    const error = new HttpError(
      "Could not perform this action on blocked user #a",
      422
    );
    return next(error);
  }

  isBlocked = creator.blockedby.find((b) => String(b) == String(post.creator));

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
    await Promise.all([post.save(), comment.save()]);
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
    comment = await Comment.findById(commentId).select({ like: 1, creator: 1 });
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
    user = await User.findById(req.userId)
      .select({ blocked: 1, blockedby: 1 })
      .lean();
  } catch (err) {
    const error = new HttpError("Could not perform action #b", 500);
    return next(error);
  }

  const isAlreadyLiked = comment.like.find(
    (cl) => String(cl) == String(user._id)
  );

  if (isAlreadyLiked) {
    comment.like = comment.like.filter((cl) => String(cl) != String(user._id));
  } else {
    let isBlocked = user.blocked.find(
      (b) => String(b) == String(comment.creator)
    );

    if (isBlocked) {
      const error = new HttpError(
        "Could not perform this action on blocked user #a",
        422
      );
      return next(error);
    }

    isBlocked = user.blockedby.find(
      (b) => String(b) == String(comment.creator)
    );

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
    comment = await Comment.findById(commentId)
      .select({ creator: 1, post: 1 })
      .lean();
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
    user = await User.findById(req.userId).select({ id: 1 }).lean();
  } catch (err) {
    const error = new HttpError("Could not delete comment #b", 500);
    return next(error);
  }

  if (String(comment.creator) != String(user._id)) {
    const error = new HttpError("Not authorized to delete comment", 401);
    return next(error);
  }

  let post;
  try {
    post = await Post.findById(comment.post).select({ comment: 1 });
  } catch (err) {
    const error = new HttpError("Could not delete comment #c", 500);
    return next(error);
  }

  post.comment = post.comment.filter((pc) => String(pc) != String(comment._id));

  try {
    await CommentReply.deleteMany({ parentComment: comment._id });
    await Comment.findByIdAndDelete(commentId);
    await post.save();
  } catch (err) {
    const error = new HttpError("Could not delete comment #d", 500);
    return next(error);
  }

  res.status(201).json({ message: "success" });
};

//r
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

//r
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

exports.getCommentReplies2 = async (req, res, next) => {
  const { id, skip } = req.params;

  let comment;

  try {
    comment = await Comment.aggregate([
      {
        $match: {
          _id: new ObjectId(id),
        },
      },
      {
        $lookup: {
          from: "commentreplies",
          localField: "reply",
          foreignField: "_id",
          as: "detail",
        },
      },
      {
        $unwind: {
          path: "$detail",
        },
      },
      {
        $sort: {
          "detail.date": -1,
        },
      },
      {
        $skip: +skip,
      },
      {
        $limit: 3,
      },
      {
        $project: {
          _id: "$detail._id",
          like: "$detail.like",
          text: "$detail.text",
          date: "$detail.date",
          creator: "$detail.creator",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "creator",
          foreignField: "_id",
          as: "detail",
        },
      },
      {
        $unwind: {
          path: "$detail",
        },
      },
      {
        $project: {
          _id: 1,
          like: 1,
          text: 1,
          date: 1,
          username: "$detail.username",
          avatar: "$detail.avatar",
        },
      },
    ]);
  } catch (err) {
    const error = new HttpError("Could not get comments #a", 500);
    return next(error);
  }

  if (comment.length === 0) {
    const error = new HttpError("Comment Not Found", 404);
    return next(error);
  }

  const commentDetails = comment.map((c) => ({
    username: c.username,
    avatar: c.avatar,
    text: c.text,
    likeCount: c.like.length,
    isLiked: req.userId
      ? c.like.find((l) => String(l) == String(req.userId))
        ? true
        : false
      : false,
    id: c._id,
    date: c.date,
  }));

  res.status(200).json({ details: commentDetails.reverse() });
};

exports.getComments2 = async (req, res, next) => {
  const { id, skip } = req.params;

  let post;

  try {
    post = await Post.aggregate([
      {
        $match: {
          _id: new ObjectId(id),
        },
      },
      {
        $addFields: {
          comments: {
            $slice: ["$comment", +skip * 18, 18],
          },
        },
      },
      {
        $lookup: {
          from: "comments",
          localField: "comments",
          foreignField: "_id",
          as: "detail",
        },
      },
      {
        $unwind: {
          path: "$detail",
        },
      },
      {
        $project: {
          _id: "$detail._id",
          text: "$detail.text",
          like: "$detail.like",
          date: "$detail.date",
          replyCount: {
            $size: "$detail.reply",
          },
          creator: "$detail.creator",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "creator",
          foreignField: "_id",
          as: "detail",
        },
      },
      {
        $unwind: {
          path: "$detail",
        },
      },
      {
        $project: {
          _id: 1,
          text: 1,
          like: 1,
          date: 1,
          replyCount: 1,
          username: "$detail.username",
          avatar: "$detail.avatar",
        },
      },
    ]);
  } catch (err) {
    const error = new HttpError("Could not get comments #a", 500);
    return next(error);
  }

  if (post.length == 0) {
    const error = new HttpError("Post Not Found", 404);
    return next(error);
  }

  const commentDetails = post.map((c) => ({
    username: c.username,
    avatar: c.avatar,
    text: c.text,
    likeCount: c.like.length,
    replyCount: c.replyCount,
    isLiked: req.userId
      ? c.like.find((l) => String(l) == String(req.userId))
        ? true
        : false
      : false,
    id: c._id,
    date: c.date,
  }));

  res.status(200).json({ details: commentDetails });
};
