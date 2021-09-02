const User = require("../models/user");
const Post = require("../models/post");
const Hashtag = require("../models/hashTag");
const Comment = require("../models/comment");
const CommentReply = require("../models/commentReply");
const HttpError = require("../models/http-error");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.create = async (req, res, next) => {
  let { caption, allowComment, styles, tag, hashTag } = req.body;

  let media;

  styles = JSON.parse(styles);
  tag = JSON.parse(tag);
  hashTag = JSON.parse(hashTag);

  await cloudinary.uploader.upload(req.file.path, (err, image) => {
    if (err) {
      const error = new HttpError("Could not create post", 500);
      return next(error);
    }
    fs.unlinkSync(req.file.path);
    // res.json(image);
    media = image.secure_url;
  });

  const creator = await User.findById(req.userId).select({ post: 1 });

  const newPost = new Post({
    media,
    caption,
    allowComment,
    creator,
    styles,
  });

  let hashTagsId = [];

  for (let i = 0; i < hashTag.length; i++) {
    let isHashTag;
    try {
      isHashTag = await Hashtag.findOne({ name: hashTag[i] }).select({
        post: 1,
      });
    } catch (err) {
      const error = new HttpError("Something went wrong #a", 500);
      return next(error);
    }

    if (isHashTag) {
      isHashTag.post = [...isHashTag.post, newPost];

      try {
        await isHashTag.save();
      } catch (err) {
        const error = new HttpError("Something went wrong #b", 500);
        return next(error);
      }

      hashTagsId.push(isHashTag);
    } else {
      const newHashTag = new Hashtag({ name: hashTag[i], post: [newPost] });

      try {
        await newHashTag.save();
      } catch (err) {
        const error = new HttpError("Something went wrong #c", 500);
        return next(error);
      }
      hashTagsId.push(newHashTag);
    }
  }

  newPost.hashTag = hashTagsId;

  let tagIds = [];

  for (let i = 0; i < tag.length; i++) {
    let taggedUser;
    try {
      taggedUser = await User.findOne({ username: tag[i] });
    } catch (err) {
      const error = new HttpError("Something went wrong #d", 500);
      return next(error);
    }

    if (taggedUser) {
      if (taggedUser === creator) {
        taggedUser.taggedPost.push(newPost);
        tagIds.push(taggedUser);
      } else {
        const isTagAllowed = taggedUser.tag;
        if (isTagAllowed === "follow") {
          const isFollowing = taggedUser.following.find(
            (f) => f === req.userId
          );
          if (isFollowing) {
            tagIds.push(taggedUser);
            if (taggedUser.manuallyApproveTag) {
              taggedUser.pendingTaggedPost.push(newPost);
            } else {
              taggedUser.taggedPost.push(newPost);
            }
          }
        } else if (isTagAllowed === "everyone") {
          tagIds.push(taggedUser);
          if (taggedUser.manuallyApproveTag) {
            taggedUser.pendingTaggedPost.push(newPost);
          } else {
            taggedUser.taggedPost.push(newPost);
          }
        } else if (isTagAllowed == "none") {
        }
      }

      try {
        await taggedUser.save();
      } catch (err) {
        const error = new HttpError("Something went wrong #e", 500);
        return next(error);
      }
    }
  }

  newPost.tag = tagIds;
  creator.post.push(newPost);

  try {
    await Promise.all([newPost.save(), creator.save()]);
  } catch (err) {
    console.log(err);
    const error = new HttpError("Could not create post", 500);
    return next(error);
  }

  res.status(201).json({ message: "success", postId: newPost.id });
};

exports.toggleLike = async (req, res, next) => {
  const { postId } = req.body;

  let post;

  try {
    post = await Post.findById(postId).populate("creator").populate("like");
  } catch (err) {
    const error = new HttpError("Could not perform action #a", 500);
    return next(error);
  }

  if (!post) {
    const error = new HttpError("Post not available", 404);
    return next(error);
  }

  let user;
  try {
    user = await User.findById(req.userId)
      .populate("blocked")
      .populate("blockedby")
      .populate("like");
  } catch (err) {
    const error = new HttpError("Could not perform action #b", 500);
    return next(error);
  }

  let isBlocked = user.blocked.find((b) => b.id == post.creator.id);

  if (isBlocked) {
    const error = new HttpError(
      "Could not perform this action on blocked user #a",
      422
    );
    return next(error);
  }

  isBlocked = user.blockedby.find((b) => b.id == post.creator.id);

  if (isBlocked) {
    const error = new HttpError(
      "Could not perform this action on blocked user #b",
      422
    );
    return next(error);
  }

  const userData = user.like;
  const postData = post.like;

  const isAdded = userData.find((l) => l.id == post.id);

  if (isAdded) {
    user.like = userData.filter((l) => l.id != post.id);
    post.like = postData.filter((l) => l.id != user.id);
  } else {
    user.like = [...userData, post];
    post.like = [...postData, user];
  }

  try {
    await user.save();
    await post.save();
  } catch (err) {
    const error = new HttpError("Could not perfrom action #c", 500);
    return next(error);
  }

  res.status(201).json({ message: "success" });
};

exports.toggleSaved = async (req, res, next) => {
  const { postId } = req.body;

  let post;
  try {
    post = await Post.findById(postId).populate("creator");
  } catch (err) {
    const error = new HttpError("Could not perform action #a", 500);
    return next(error);
  }
  if (!post) {
    const error = new HttpError("No post found", 404);
    return next(error);
  }

  let user;
  try {
    user = await User.findById(req.userId)
      .populate("saved")
      .populate("blocked")
      .populate("blockedby");
  } catch (err) {
    const error = new HttpError("Could not perform action #b", 500);
    return next(error);
  }

  const userData = user.saved;

  const isAdded = userData.find((s) => s.id == post.id);

  if (isAdded) {
    user.saved = userData.filter((s) => s.id != post.id);
  } else {
    let isBlocked = user.blocked.find((b) => b.id == post.creator.id);

    if (isBlocked) {
      const error = new HttpError(
        "Could not perform this action on blocked user #a",
        422
      );
      return next(error);
    }

    isBlocked = user.blockedby.find((b) => b.id == post.creator.id);

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
    post = await Post.findById(postId).populate("creator");
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
    user = await User.findById(req.userId).populate("archivePost");
  } catch (err) {
    const error = new HttpError("Could not perform action #b", 500);
    return next(error);
  }

  if (post.creator.id != user.id) {
    const error = new HttpError("Not Authorized to perform this action", 401);
    return next(error);
  }

  const userData = user.archivePost;

  const isAdded = userData.find((a) => a.id == post.id);

  if (isAdded) {
    user.archivePost = userData.filter((a) => a.id != post.id);
    post.isArchived = false;
  } else {
    user.archivePost = [...userData, post];
    post.isArchived = true;
  }

  try {
    await user.save();
    await post.save();
  } catch (err) {
    const error = new HttpError("Could not perform action #c", 500);
    return next(error);
  }

  res.status(201).json({ message: "success" });
};

exports.removeTag = async (req, res, next) => {
  const { postId, username } = req.body;

  let post;

  try {
    post = await Post.findById(postId).populate("creator").populate("tag");
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
    user = await User.findById(req.userId);
  } catch (err) {
    const error = new HttpError("Could not remove tag #b", 500);
    return next(error);
  }

  let usernameDetail;

  try {
    usernameDetail = await User.findOne({ username })
      .populate("taggedPost")
      .populate("pendingTaggedPost");
  } catch (err) {
    const error = new HttpError("Could not remove tag #c", 500);
    return next(error);
  }

  if (post.creator.id == user.id || usernameDetail.id == user.id) {
    const postTag = post.tag;
    const isTagged = postTag.find((pt) => pt.id == usernameDetail.id);
    if (!isTagged) {
      const error = new HttpError("User is not tagged #a", 422);
      return next(error);
    }
    const isInTaggedList = usernameDetail.taggedPost.find(
      (pt) => pt.id == post.id
    );

    if (isInTaggedList === undefined) {
      const isInPendingTaggedList = usernameDetail.pendingTaggedPost.find(
        (pt) => pt.id == post.id
      );

      if (isInPendingTaggedList === undefined) {
        const error = new HttpError("User is not tagged #b", 422);
        return next(error);
      }

      usernameDetail.pendingTaggedPost =
        usernameDetail.pendingTaggedPost.filter((pt) => pt.id != post.id);
    } else {
      usernameDetail.taggedPost = usernameDetail.taggedPost.filter(
        (pt) => pt.id != post.id
      );
    }

    post.tag = postTag.filter((pt) => pt.id != usernameDetail.id);

    try {
      await user.save();
      await post.save();
      await usernameDetail.save();
    } catch (err) {
      const error = new HttpError("Could not remove tag #d", 500);
      return next(error);
    }
  } else {
    const error = new HttpError("Not authorized to remove tag", 401);
    return next(error);
  }
};

exports.allowComment = async (req, res, next) => {
  const { postId } = req.body;

  let post;
  try {
    post = await Post.findById(postId).populate("creator");
  } catch (err) {
    const error = new HttpError("Could not perform action #a", 500);
    return next(error);
  }

  if (!post) {
    const error = new HttpError("Post not found", 404);
    return next(error);
  }

  if (post.creator.id != req.userId) {
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
  let user, users;
  const { skip } = req.params;

  try {
    user = await User.findById(req.userId);
  } catch (err) {
    const error = new HttpError("Something went wrong #a", 500);
    return next(error);
  }

  let post;
  try {
    // users = await User.find({ private: false }).populate({
    //   path: "post",
    //   match: { isArchived: false },
    //   options: { limit: 18, sort: { date: -1 }, skip: 0 },
    //   populate: { path: "comment" },
    // });

    // totalDoc = await Post.find({
    //   isArchived: false,
    // }).countDocuments();

    post = await Post.find({ isArchived: false })
      .populate({
        path: "creator",
        // match: { private: false },
      })
      .populate("comment")
      .limit(18)
      .sort({ date: -1 })
      .skip(+skip * 18);
  } catch (err) {
    const error = new HttpError("Could not get posts", 500);
    return next(error);
  }

  const removePrivate = post.filter((p) => p.creator.private !== true);

  const filter1 = removePrivate.filter(
    (u) => !user.blocked.includes(u.creator._id)
  );
  const filter2 = filter1.filter(
    (u) => !user.blockedby.includes(u.creator._id)
  );

  const posts = filter2.map((p) => ({
    media: p.media,
    styles: p.styles,
    likeCount: p.like.length,
    commentCount:
      p.comment.length + p.comment.reduce((sum, i) => sum + i.reply.length, 0),
    id: p._id,
  }));

  // ----------------------

  let total,
    filter2Total = [];
  if (+skip == 0) {
    try {
      total = await Post.find({ isArchived: false }).populate({
        path: "creator",
      });
    } catch (err) {
      const error = new HttpError("Could not update profile #a", 500);
      return next(error);
    }

    const removePrivateTotal = total.filter((p) => p.creator.private !== true);

    const filter1Total = removePrivateTotal.filter(
      (u) => !user.blocked.includes(u.creator._id)
    );
    filter2Total = filter1Total.filter(
      (u) => !user.blockedby.includes(u.creator._id)
    );
  }

  res.status(200).json({ detail: posts, total: filter2Total.length });
};

exports.feed = async (req, res, next) => {
  let followingUser, post, totalDoc;
  const { skip } = req.params;

  try {
    /*
    user = await User.findById(req.userId)
      .populate({
        path: "post",
        match: { isArchived: false },
        populate: [
          { path: "comment", options: { sort: { date: -1 } } },
          { path: "creator" },
        ],
      })
      .populate({
        path: "following",
        populate: {
          path: "post",
          match: { isArchived: false },
          populate: [
            {
              path: "comment",
              options: { sort: { date: -1 } }, //Can add limit if there is a field of total comments in post modal.
            },
            { path: "creator" },
          ],
        },
      });
      */

    followingUser = await User.findById(req.userId);

    if (+skip == 0) {
      totalDoc = await Post.find({
        $or: [
          { creator: req.userId },
          { creator: { $in: followingUser.following } },
        ],
        isArchived: false,
      });
    }

    post = await Post.find({
      $or: [
        { creator: req.userId },
        { creator: { $in: followingUser.following } },
      ],
      isArchived: false,
    })
      .populate("creator")
      .populate({
        path: "comment",
        options: { sort: { date: -1 } },
        populate: { path: "creator" },
      })
      .limit(20)
      .sort({ date: -1 })
      .skip(+skip * 20);
  } catch (err) {
    const error = new HttpError("Something went wrong #a", 500);
    return next(error);
  }

  // merged.sort((a, b) => {
  //   let da = new Date(a.date),
  //     db = new Date(b.date);
  //   return db - da;
  // });

  let posts = post.map((p) => ({
    id: p._id,
    media: p.media,
    caption: p.caption,
    allowComment: p.allowComment,
    styles: p.styles,
    date: p.date,
    likeCount: p.like.length,
    creatorUsername: p.creator.username,
    avatar: p.creator.avatar,
    commentCount:
      p.comment.length + p.comment.reduce((sum, i) => sum + i.reply.length, 0),
    comment: p.comment.slice(0, 2).map((c) => ({
      id: c.id,
      username: c.creator.username,
      avatar: c.creator.avatar,
      text: c.text,
      isLiked: c.like.find((l) => l == followingUser.id) ? true : false,
    })),
    isSaved: followingUser.saved.find((pt) => pt.id == p._id) ? true : false,
    isLiked: p.like.find((u) => u.id == followingUser.id) ? true : false,
  }));

  res.status(200).json({ posts, total: totalDoc && totalDoc.length });
};

exports.detail = async (req, res, next) => {
  const postId = req.params.id;
  let post;

  try {
    post = await Post.findById(postId)
      .populate("like")
      .populate("creator")
      .populate("tag")
      .populate({ path: "comment", populate: { path: "creator" } });
  } catch (err) {
    const error = new HttpError("Could not get post #a", 500);
    return next(error);
  }

  if (!post) {
    const error = new HttpError("Post Not Found", 404);
    return next(error);
  }

  let user;
  if (req.userId) {
    try {
      user = await User.findById(req.userId)
        .populate("saved")
        .populate("follower")
        .populate("following")
        .populate("blocked")
        .populate("blockedby")
        .populate("pendingFollower")
        .populate("pendingFollowing")
        .populate("pendingTaggedPost")
        .populate("taggedPost");
    } catch (err) {
      const error = new HttpError("Could not get post #b", 500);
      return next(error);
    }
  }

  const slicedComments = post.comment.slice(0, 18);

  const commentDetails = slicedComments.map((c) => ({
    username: c.creator.username,
    avatar: c.creator.avatar,
    text: c.text,
    likeCount: c.like.length,
    replyCount: c.reply.length,
    isLiked: req.userId
      ? c.like.find((l) => l == user.id)
        ? true
        : false
      : false,
    id: c._id,
    date: c.date,
  }));

  const postDetails = {
    media: post.media,
    caption: post.caption,
    allowComment: post.allowComment,
    styles: post.styles,
    isArchived: post.isArchived,
    date: post.date,
    tag: post.tag.map((p) => p.username),
    likeCount: post.like.length,
    creatorUsername: post.creator.username,
    avatar: post.creator.avatar,
    comment: commentDetails,
    totalComments: post.comment.length,
  };

  let postCtaByUser;

  if (user) {
    const isSaved = user.saved.find((p) => p.id == post.id) ? true : false;
    const isLiked = post.like.find((u) => u.id == user.id) ? true : false;

    const isInPendingTagged = user.pendingTaggedPost.find(
      (p) => p.id == post.id
    )
      ? true
      : false;
    let isInTaggedList;
    if (!isInPendingTagged) {
      isInTaggedList = user.taggedPost.find((p) => p.id == post.id)
        ? true
        : false;
    }

    postCtaByUser = { isSaved, isLiked, isInPendingTagged, isInTaggedList };
  }

  if (user && user.id == post.creator.id) {
    return res.status(200).json({
      postDetails: { ...postDetails, ...postCtaByUser },
      relation: "Creator",
    });
  }

  if (post.isArchived) {
    // const error = new HttpError("Redirect user to /404", 404);
    // return next(error);
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
      const rel = user[findRelations[i]].find((u) => u.id == post.creator.id);
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

exports.delete = async (req, res, next) => {
  const { id } = req.body;

  let post;
  try {
    post = await Post.findById(id).select({ creator: 1, media: 1, comment: 1 });
  } catch (err) {
    const error = new HttpError("Could not delete post #a", 500);
    return next(error);
  }

  if (!post) {
    const error = new HttpError("Post not found", 404);
    return next(error);
  }

  // let user;

  // try {
  //   user = await User.findById(req.userId).select({ id: 1 }).lean();
  // } catch (err) {
  //   const error = new HttpError("Could not delete post #b", 500);
  //   return next(error);
  // }

  if (String(post.creator) != String(req.userId)) {
    const error = new HttpError("Not authorized to delete post", 401);
    return next(error);
  }

  const splitImg = post.media.split("/");
  const publicId = splitImg[splitImg.length - 1].split(".")[0];

  await cloudinary.uploader.destroy(publicId, (err) => {
    if (err) {
      return res.status(500).json({ err });
    }
  });

  let users;
  try {
    // users = await User.updateMany(
    //   [{ post: post.id }, { saved: post.id }, { like: post.id }],
    //   {
    //     $pull: { post: post.id },
    //   },
    //   { multi: true }
    // );

    await Hashtag.bulkWrite([
      {
        updateMany: {
          filter: { post: post.id },
          update: { $pull: { post: post.id } },
        },
      },
    ]);

    users = await User.bulkWrite([
      {
        updateMany: {
          filter: { post: post.id },
          update: { $pull: { post: post.id } },
        },
      },
      {
        updateMany: {
          filter: { like: post.id },
          update: { $pull: { like: post.id } },
        },
      },
      {
        updateMany: {
          filter: { saved: post.id },
          update: { $pull: { saved: post.id } },
        },
      },
      {
        updateMany: {
          filter: { archivePost: post.id },
          update: { $pull: { archivePost: post.id } },
        },
      },
      {
        updateMany: {
          filter: { taggedPost: post.id },
          update: { $pull: { taggedPost: post.id } },
        },
      },
      {
        updateMany: {
          filter: { pendingTaggedPost: post.id },
          update: { $pull: { pendingTaggedPost: post.id } },
        },
      },
    ]);
  } catch (err) {
    const error = new HttpError("Could not delete post #c", 500);
    return next(error);
  }

  try {
    // await CommentReply.deleteMany({ parentComment: { $in: post.comment } });
    // await Comment.deleteMany({ post: post.id });
    // await Post.findByIdAndDelete(post.id);

    await Promise.all([
      CommentReply.deleteMany({ parentComment: { $in: post.comment } }),
      Comment.deleteMany({ post: post.id }),
      Post.findByIdAndDelete(post.id),
    ]);
  } catch (err) {
    const error = new HttpError("Could not delete post #d", 500);
    return next(error);
  }

  res.status(200).json({ message: "success" });
};
