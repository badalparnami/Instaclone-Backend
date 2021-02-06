const Hashtag = require("../models/hashTag");
const HttpError = require("../models/http-error");

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
    total: totalDoc && totalDoc.post.length,
  });
};
