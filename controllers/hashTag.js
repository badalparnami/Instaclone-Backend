const Hashtag = require("../models/hashTag");
const HttpError = require("../models/http-error");

//r
exports.getPost = async (req, res, next) => {
  const { tag, skip } = req.params;

  let hashtag, totalDoc;
  try {
    totalDoc = await Hashtag.findOne({ name: tag });

    hashtag = await Hashtag.findOne({ name: tag }).populate({
      path: "post",
      populate: { path: "commment", populate: { path: "reply" } },
      options: { limit: 18, skip: +skip * 18, sort: { date: -1 } },
    });
  } catch (err) {
    const error = new HttpError("Could not get posts #a", 500);
    return next(error);
  }

  if (!hashtag) {
    const error = new HttpError("Could not get posts #b", 404);
    return next(error);
  }

  const mappedPost = hashtag.post.map((p) => ({
    media: p.media,
    styles: p.styles,
    id: p._id,
    likeCount: p.like.length,
    commentCount:
      p.comment.length + p.comment.reduce((sum, i) => sum + i.reply.length, 0),
  }));

  const random = mappedPost[Math.floor(Math.random() * mappedPost.length)];

  res.status(200).json({
    posts: mappedPost,
    main: random.media,
    total: totalDoc ? totalDoc.post.length : 0,
  });
};

exports.getPost2 = async (req, res, next) => {
  const { tag, skip } = req.params;

  let hashtag, totalDoc;
  try {
    if (+skip == 0) {
      totalDoc = await Hashtag.findOne({ name: tag })
        .select({ post: 1 })
        .lean();
    }

    hashtag = await Hashtag.aggregate([
      {
        $match: {
          name: tag,
        },
      },
      {
        $addFields: {
          posts: {
            $slice: ["$post", +skip * 18, 18],
          },
        },
      },
      {
        $lookup: {
          from: "posts",
          localField: "posts",
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
        $match: {
          "detail.isArchived": false,
        },
      },
      {
        $sort: {
          "detail.date": -1,
        },
      },
      {
        $lookup: {
          from: "comments",
          localField: "detail.comment",
          foreignField: "_id",
          as: "cDetails",
        },
      },
      {
        $unwind: {
          path: "$cDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: "$detail._id",
          replyCount: {
            $size: {
              $ifNull: ["$cDetails.reply", []],
            },
          },
          details: {
            likeCount: {
              $size: {
                $ifNull: ["$detail.like", []],
              },
            },
            commentCount: {
              $size: {
                $ifNull: ["$detail.comment", []],
              },
            },
            media: "$detail.media",
            styles: "$detail.styles",
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          replyCount: {
            $sum: "$replyCount",
          },
          details: {
            $first: "$details",
          },
        },
      },
    ]);
  } catch (err) {
    const error = new HttpError("Could not get posts #a", 500);
    return next(error);
  }

  if (hashtag.length == 0) {
    const error = new HttpError("Could not get posts #b", 404);
    return next(error);
  }

  const mappedPost = hashtag.map((p) => ({
    media: p.details.media,
    styles: p.details.styles,
    id: p._id,
    likeCount: p.details.likeCount,
    commentCount: p.details.commentCount + p.replyCount,
  }));

  const random = mappedPost[Math.floor(Math.random() * mappedPost.length)];

  res.status(200).json({
    posts: mappedPost,
    main: random.media,
    total: totalDoc ? totalDoc.post.length : 0,
  });
};
