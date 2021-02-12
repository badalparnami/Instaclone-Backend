const User = require("../models/user");
const Post = require("../models/post");
const HttpError = require("../models/http-error");
const ObjectId = require("mongoose").Types.ObjectId;

exports.toggleLike = async (req, res, next) => {
  const { postId } = req.body;

  let post;

  try {
    post = await Post.findById(postId).select({
      creator: 1,
      like: 1,
      isArchived: 1,
    });
  } catch (err) {
    const error = new HttpError("Could not perform action #a", 500);
    return next(error);
  }

  if (!post) {
    const error = new HttpError("Post not available", 404);
    return next(error);
  }

  if (post.isArchived) {
    const error = new HttpError(
      "Could not perform this action on archived post",
      422
    );
    return next(error);
  }

  let user;
  try {
    user = await User.findById(req.userId).select({
      blocked: 1,
      blockedby: 1,
      like: 1,
    });
  } catch (err) {
    const error = new HttpError("Could not perform action #b", 500);
    return next(error);
  }

  let isBlocked = user.blocked.find((b) => String(b) == String(post.creator));

  if (isBlocked) {
    const error = new HttpError(
      "Could not perform this action on blocked user #a",
      422
    );
    return next(error);
  }

  isBlocked = user.blockedby.find((b) => String(b) == String(post.creator));

  if (isBlocked) {
    const error = new HttpError(
      "Could not perform this action on blocked user #b",
      422
    );
    return next(error);
  }

  const userData = user.like;
  const postData = post.like;

  const isAdded = userData.find((l) => String(l) == String(post._id));

  if (isAdded) {
    user.like = userData.filter((l) => String(l) != String(post._id));
    post.like = postData.filter((l) => String(l) != String(user._id));
  } else {
    user.like = [...userData, post];
    post.like = [...postData, user];
  }

  try {
    await Promise.all([user.save(), post.save()]);
  } catch (err) {
    const error = new HttpError("Could not perform action #c", 500);
    return next(error);
  }

  res.status(201).json({ message: "success" });
};

exports.toggleSaved = async (req, res, next) => {
  const { postId } = req.body;

  let post;
  try {
    post = await Post.findById(postId)
      .select({ creator: 1, isArchived: 1 })
      .lean();
  } catch (err) {
    const error = new HttpError("Could not perform action #a", 500);
    return next(error);
  }
  if (!post) {
    const error = new HttpError("No post found", 404);
    return next(error);
  }

  if (post.isArchived) {
    const error = new HttpError(
      "Could not perform this action on archived post",
      422
    );
    return next(error);
  }

  let user;
  try {
    user = await User.findById(req.userId).select({
      blocked: 1,
      blockedby: 1,
      saved: 1,
    });
  } catch (err) {
    const error = new HttpError("Could not perform action #b", 500);
    return next(error);
  }

  const userData = user.saved;

  const isAdded = userData.find((s) => String(s) == String(post._id));

  if (isAdded) {
    user.saved = userData.filter((s) => String(s) == String(post._id));
  } else {
    let isBlocked = user.blocked.find((b) => String(b) == String(post.creator));

    if (isBlocked) {
      const error = new HttpError(
        "Could not perform this action on blocked user #a",
        422
      );
      return next(error);
    }

    isBlocked = user.blockedby.find((b) => String(b) == String(post.creator));

    if (isBlocked) {
      const error = new HttpError(
        "Could not perform this action on blocked user #b",
        422
      );
      return next(error);
    }

    user.saved = [...userData, post];
  }

  try {
    await user.save();
  } catch (err) {
    const error = new HttpError("Could not perform action #c", 500);
    return next(error);
  }

  res.status(201).json({ message: "success" });
};

exports.toggleArchive = async (req, res, next) => {
  const { postId } = req.body;

  let post;

  try {
    post = await Post.findById(postId).select({ isArchived: 1, creator: 1 });
  } catch (err) {
    const error = new HttpError("Could not perform action #a", 500);
    return next(error);
  }
  if (!post) {
    const error = new HttpError("No Post Found", 404);
    return next(error);
  }

  let user;
  try {
    user = await User.findById(req.userId).select({ archivePost: 1 });
  } catch (err) {
    const error = new HttpError("Could not perform action #b", 500);
    return next(error);
  }

  if (String(post.creator) != String(user._id)) {
    const error = new HttpError("Not Authorized to perform this action", 401);
    return next(error);
  }

  const userData = user.archivePost;

  const isAdded = userData.find((a) => String(a) == String(post._id));

  if (isAdded) {
    user.archivePost = userData.filter((a) => String(a) != String(post._id));
    post.isArchived = false;
  } else {
    user.archivePost = [...userData, post];
    post.isArchived = true;
  }

  try {
    await Promise.all([user.save(), post.save()]);
  } catch (err) {
    const error = new HttpError("Could not perform action #c", 500);
    return next(error);
  }

  res.status(201).json({ message: "success" });
};

exports.removeTag = async (req, res, next) => {
  const { postId } = req.body;

  let post;

  try {
    post = await Post.findById(postId).select({ creator: 1, tag: 1 });
  } catch (err) {
    const error = new HttpError("Could not remove tag #a", 500);
    return next(error);
  }
  if (!post) {
    const error = new HttpError("Post not found", 404);
    return next(error);
  }

  let user;
  try {
    user = await User.findById(req.userId).select({
      taggedPost: 1,
      pendingTaggedPost: 1,
    });
  } catch (err) {
    const error = new HttpError("Could not remove tag #b", 500);
    return next(error);
  }

  const postTag = post.tag;
  const isTagged = postTag.find((pt) => String(pt) == String(user._id));
  if (!isTagged) {
    const error = new HttpError("User is not tagged #a", 422);
    return next(error);
  }
  const isInTaggedList = user.taggedPost.find(
    (pt) => String(pt) == String(post._id)
  );

  if (isInTaggedList === undefined) {
    const isInPendingTaggedList = user.pendingTaggedPost.find(
      (pt) => String(pt) == String(post._id)
    );

    if (isInPendingTaggedList === undefined) {
      const error = new HttpError("User is not tagged #b", 422);
      return next(error);
    }

    user.pendingTaggedPost = user.pendingTaggedPost.filter(
      (pt) => String(pt) != String(post._id)
    );
  } else {
    user.taggedPost = user.taggedPost.filter(
      (pt) => String(pt) != String(post._id)
    );
  }

  post.tag = postTag.filter((pt) => String(pt) != String(user._id));

  try {
    await Promise.all([post.save(), user.save()]);
  } catch (err) {
    const error = new HttpError("Could not remove tag #d", 500);
    return next(error);
  }

  res.status(201).json({ message: "success" });
};

exports.allowComment = async (req, res, next) => {
  const { postId } = req.body;

  let post;
  try {
    post = await Post.findById(postId).select({ creator: 1, allowComment: 1 });
  } catch (err) {
    const error = new HttpError("Could not perform action #a", 500);
    return next(error);
  }

  if (!post) {
    const error = new HttpError("Post not found", 404);
    return next(error);
  }

  if (String(post.creator) != String(req.userId)) {
    const error = new HttpError("Not authorized", 401);
    return next(error);
  }

  post.allowComment = !post.allowComment;

  try {
    await post.save();
  } catch (err) {
    const error = new HttpError("Could not perform action #b", 500);
    return next(error);
  }

  res.status(201).json({ message: "success" });
};

exports.explore = async (req, res, next) => {
  const { skip } = req.params;

  let post;

  try {
    post = await Post.aggregate([
      {
        $match: {
          isArchived: false,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "creator",
          foreignField: "_id",
          as: "userD",
        },
      },
      {
        $unwind: {
          path: "$userD",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "userD.private": false,
          "userD.blocked": {
            $nin: [new ObjectId(req.userId)],
          },
          "userD.blockedby": {
            $nin: [new ObjectId(req.userId)],
          },
        },
      },
      {
        $sort: {
          date: -1,
        },
      },
      {
        $skip: +skip * 18,
      },
      {
        $limit: 18,
      },
      {
        $lookup: {
          from: "comments",
          localField: "comment",
          foreignField: "_id",
          as: "commentsD",
        },
      },
      {
        $unwind: {
          path: "$commentsD",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          replyCount: {
            $size: {
              $ifNull: ["$commentsD.reply", []],
            },
          },
          id: 1,
          detail: {
            commentCount: {
              $size: {
                $ifNull: ["$comment", []],
              },
            },
            media: "$media",
            styles: "$styles",
            likeCount: {
              $size: {
                $ifNull: ["$like", []],
              },
            },
            date: "$date",
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          totalreply: {
            $sum: "$replyCount",
          },
          detail: {
            $first: "$detail",
          },
        },
      },
      // {
      //   $sort: {
      //     "detail.date": -1,
      //   },
      // },
    ]);
  } catch (err) {
    const error = new HttpError("Could not get posts", 500);
    return next(error);
  }

  const posts = post.map((p) => ({
    media: p.detail.media,
    styles: p.detail.styles,
    likeCount: p.detail.likeCount,
    commentCount: p.detail.commentCount + p.totalreply,
    id: p._id,
  }));

  // ----------------------

  let total = [];
  if (+skip == 0) {
    try {
      total = await Post.aggregate([
        {
          $match: {
            isArchived: false,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "creator",
            foreignField: "_id",
            as: "userD",
          },
        },
        {
          $unwind: {
            path: "$userD",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            "userD.private": false,
            "userD.blocked": {
              $nin: [new ObjectId(req.userId)],
            },
            "userD.blockedby": {
              $nin: [new ObjectId(req.userId)],
            },
          },
        },
        {
          $count: "media",
        },
      ]);
    } catch (err) {
      const error = new HttpError("Could not get posts #b", 500);
      return next(error);
    }
  }

  res.status(200).json({
    detail: posts,
    total: total.length > 0 ? total[0].media : 0,
  });
};

exports.feed = async (req, res, next) => {
  let followingUser, post, totalDoc;
  const { skip } = req.params;

  try {
    followingUser = await User.findById(req.userId)
      .select({ following: 1, saved: 1, like: 1 })
      .lean();

    if (+skip == 0) {
      totalDoc = await Post.find({
        $or: [
          { creator: req.userId },
          { creator: { $in: followingUser.following } },
        ],
        isArchived: false,
      })
        .select({ id: 1 })
        .lean();
    }

    post = await Post.aggregate([
      {
        $match: {
          isArchived: false,
          $or: [
            {
              creator: new ObjectId(req.userId),
            },
            {
              creator: {
                $in: followingUser.following,
              },
            },
          ],
        },
      },
      {
        $sort: {
          date: -1,
        },
      },
      {
        $skip: +skip * 18,
      },
      {
        $limit: 18,
      },
      {
        $lookup: {
          from: "users",
          localField: "creator",
          foreignField: "_id",
          as: "creatorD",
        },
      },
      {
        $unwind: {
          path: "$creatorD",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "comments",
          localField: "comment",
          foreignField: "_id",
          as: "commentD",
        },
      },
      {
        $unwind: {
          path: "$commentD",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          comments: {
            $slice: ["$comment", -2],
          },
        },
      },
      {
        $lookup: {
          from: "comments",
          localField: "comments",
          foreignField: "_id",
          as: "commentsD",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "commentsD.creator",
          foreignField: "_id",
          as: "commeentDC",
        },
      },
      {
        $project: {
          replyCount: {
            $size: {
              $ifNull: ["$commentD.reply", []],
            },
          },
          id: 1,
          detail: {
            commentCount: {
              $size: {
                $ifNull: ["$comment", []],
              },
            },
            media: "$media",
            styles: "$styles",
            likeCount: {
              $size: {
                $ifNull: ["$like", []],
              },
            },
            caption: "$caption",
            allowComment: "$allowComment",
            date: "$date",
            creatorUsername: "$creatorD.username",
            avatar: "$creatorD.avatar",
            comments: "$commentsD",
            commentDC: "$commeentDC",
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          totalreply: {
            $sum: "$replyCount",
          },
          detail: {
            $first: "$detail",
          },
        },
      },
      {
        $sort: {
          "detail.date": -1,
        },
      },
    ]);
  } catch (err) {
    const error = new HttpError("Something went wrong #a", 500);
    return next(error);
  }

  let posts = post.map((p) => ({
    id: p._id,
    media: p.detail.media,
    caption: p.detail.caption,
    allowComment: p.detail.allowComment,
    styles: p.detail.styles,
    date: p.detail.date,
    likeCount: p.detail.like,
    creatorUsername: p.detail.creatorUsername,
    avatar: p.detail.avatar,
    commentCount: p.totalreply + p.detail.commentCount,
    comment: p.detail.comments.map((c) => {
      const creator = p.detail.commentDC.find(
        (cr) => String(cr._id) == String(c.creator)
      );

      return {
        id: c._id,
        username: creator.username,
        avatar: creator.avatar,
        text: c.text,
        isLiked: c.like.find((l) => String(l) == String(followingUser._id))
          ? true
          : false,
      };
    }),
    isSaved: followingUser.saved.find((pt) => String(pt) == String(p._id))
      ? true
      : false,
    isLiked: followingUser.like.find((u) => String(u) == String(p._id))
      ? true
      : false,
  }));

  res.status(200).json({ posts, total: totalDoc ? totalDoc.length : 0 });
};

exports.detail = async (req, res, next) => {
  const postId = req.params.id;
  let post;

  try {
    post = await Post.aggregate([
      {
        $match: {
          _id: new ObjectId(postId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "creator",
          foreignField: "_id",
          as: "creatorD",
        },
      },
      {
        $unwind: {
          path: "$creatorD",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          comments: {
            $slice: ["$comment", 0, 18],
          },
        },
      },
      {
        $lookup: {
          from: "comments",
          localField: "comments",
          foreignField: "_id",
          as: "commentsD",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "commentsD.creator",
          foreignField: "_id",
          as: "commentsDC",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "tag",
          foreignField: "_id",
          as: "tagD",
        },
      },
      {
        $project: {
          id: 1,
          allowComment: 1,
          isArchived: 1,
          likeCount: {
            $size: {
              $ifNull: ["$like", []],
            },
          },
          commentCount: {
            $size: {
              $ifNull: ["$comment", []],
            },
          },
          media: 1,
          caption: 1,
          styles: 1,
          date: 1,
          creator: {
            id: "$creatorD._id",
            private: "$creatorD.private",
            avatar: "$creatorD.avatar",
            username: "$creatorD.username",
          },
          comments: "$commentsD",
          tagDetail: {
            $map: {
              input: "$tagD",
              in: "$$this.username",
            },
          },
          commentsCreator: {
            $map: {
              input: "$commentsDC",
              in: {
                username: "$$this.username",
                avatar: "$$this.avatar",
                id: "$$this._id",
              },
            },
          },
        },
      },
    ]);
  } catch (err) {
    const error = new HttpError("Could not get post #a", 500);
    return next(error);
  }

  if (post.length === 0) {
    const error = new HttpError("Post Not Found", 404);
    return next(error);
  }

  let user;
  if (req.userId) {
    try {
      user = await User.findById(req.userId).lean();
    } catch (err) {
      const error = new HttpError("Could not get post #b", 500);
      return next(error);
    }
  }

  post = post[0];

  const commentDetails = post.comments.map((c) => {
    const creator = post.commentsCreator.find(
      (cr) => String(cr.id) == String(c.creator)
    );
    return {
      username: creator.username,
      avatar: creator.avatar,
      text: c.text,
      likeCount: c.like.length,
      replyCount: c.reply.length,
      isLiked: req.userId
        ? c.like.find((l) => String(l) == String(user._id))
          ? true
          : false
        : false,
      id: c._id,
      date: c.date,
    };
  });

  const postDetails = {
    media: post.media,
    caption: post.caption,
    allowComment: post.allowComment,
    styles: post.styles,
    isArchived: post.isArchived,
    date: post.date,
    tag: post.tagDetail,
    likeCount: post.likeCount,
    creatorUsername: post.creator.username,
    avatar: post.creator.avatar,
    comment: commentDetails,
    totalComments: post.commentCount,
  };

  let postCtaByUser;

  if (user) {
    const isSaved = user.saved.find((p) => String(p) == String(post._id))
      ? true
      : false;

    const isLiked = user.like.find((u) => String(u) == String(post._id))
      ? true
      : false;

    const isInPendingTagged = user.pendingTaggedPost.find(
      (p) => String(p) == String(post._id)
    )
      ? true
      : false;

    let isInTaggedList;
    if (!isInPendingTagged) {
      isInTaggedList = user.taggedPost.find(
        (p) => String(p) == String(post._id)
      )
        ? true
        : false;
    }

    postCtaByUser = { isSaved, isLiked, isInPendingTagged, isInTaggedList };
  }

  if (user && String(user._id) == String(post.creator.id)) {
    return res.status(200).json({
      postDetails: { ...postDetails, ...postCtaByUser },
      relation: "Creator",
    });
  }

  if (post.isArchived) {
    res.status(200).json({ message: "fail", error: "redirect user to /404" });
    return;
  }

  let relationWithCreator = [];

  if (user) {
    const findRelations = [
      "blocked",
      "blockedby",
      "follower",
      "following",
      "pendingFollower",
      "pendingFollowing",
    ];

    const relations = [
      "Blocked",
      "Blocked",
      "Follow",
      "Following", //private
      "Approve",
      "Requested",
    ];

    for (let i = 0; i < findRelations.length; i++) {
      const rel = user[findRelations[i]].find(
        (u) => String(u) == String(post.creator.id)
      );
      if (rel) {
        relationWithCreator.push(relations[i]);
      }
    }
  }

  if (post.creator.private) {
    if (!user) {
      res.status(200).json({ message: "fail", error: "redirect user to /404" });
      return;
    }

    const isUserFollowingCreator = relationWithCreator.find(
      (r) => r === "Following"
    );

    if (isUserFollowingCreator) {
      return res.status(200).json({
        postDetails: {
          ...postDetails,
          ...postCtaByUser,
        },
        relation: "Following",
        private: post.creator.private,
      });
    }

    res.status(200).json({ message: "fail", error: "redirect user to /404" });
    return;
  }

  if (user) {
    const isBlocked = relationWithCreator.find((r) => r === "Blocked");

    if (isBlocked) {
      res.status(200).json({ message: "fail", error: "redirect user to /404" });
      return;
    }

    const relation = relationWithCreator.find((r) => r === "Following")
      ? "Following"
      : relationWithCreator.find((r) => r === "Approve")
      ? "Approve"
      : "Follow";

    return res.status(200).json({
      postDetails: {
        ...postDetails,
        ...postCtaByUser,
      },
      relation,
      private: post.creator.private,
    });
  } else {
    return res
      .status(200)
      .json({ postDetails, relation: "Follow", private: post.creator.private });
  }
};
