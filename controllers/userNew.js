const User = require("../models/user");
const HttpError = require("../models/http-error");
const ObjectId = require("mongoose").Types.ObjectId;
const cloudinary = require("cloudinary").v2;
const fs = require("fs");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const DETAILS = [
  "like",
  "saved",
  "follower",
  "following",
  "blocked",
  "pendingFollower",
  "archivePost",
  "taggedPost",
  "pendingTaggedPost",
  "post",
];

const DeepPopulate = [
  "like",
  "saved",
  "archivePost",
  "taggedPost",
  "pendingTaggedPost",
  "post",
];

exports.getDetails = async (req, res, next) => {
  const { detail, skip } = req.params;
  const isValid = DETAILS.includes(detail);

  if (!isValid) {
    const error = new HttpError("Invalid parameter", 422);
    return next(error);
  }

  let user, totalDoc;

  try {
    if (+skip == 0 && detail !== "follower") {
      totalDoc = await User.findById(req.userId).select(detail).lean();
    }
  } catch (err) {
    const error = new HttpError("Something went wrong #a", 500);
    return next(error);
  }

  if (DeepPopulate.includes(detail)) {
    const isArchived = detail === "archivePost";
    try {
      user = await User.aggregate([
        {
          $match: {
            _id: new ObjectId(req.userId),
          },
        },
        {
          $lookup: {
            from: "posts",
            localField: detail,
            foreignField: "_id",
            as: "detail",
          },
        },
        {
          $unwind: {
            path: "$detail",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            "detail.isArchived": isArchived,
          },
        },
        {
          $sort: {
            "detail.date": -1,
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
              date: "$detail.date",
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
        {
          $sort: {
            "details.date": -1,
          },
        },
      ]);
    } catch (err) {
      const error = new HttpError("Could not get data #a", 500);
      return next(error);
    }

    const mapped = user.map((p) => ({
      id: p._id,
      styles: p.details.styles,
      media: p.details.media,
      likeCount: p.details.likeCount,
      commentCount: p.details.commentCount + p.replyCount,
    }));

    return res.status(200).json({
      detail: mapped,
      total: totalDoc ? totalDoc[detail].length : 0,
    });
  } else {
    if (detail === "follower") {
      try {
        totalDoc = await User.findById(req.userId)
          .select({ follower: 1, following: 1, pendingFollowing: 1 })
          .lean();

        user = await User.aggregate([
          {
            $match: {
              _id: new ObjectId(req.userId),
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "follower",
              foreignField: "_id",
              as: "followerD",
            },
          },
          {
            $unwind: {
              path: "$followerD",
            },
          },
          {
            $skip: +skip * 18,
          },
          {
            $limit: 18,
          },
          {
            $project: {
              _id: 0,
              id: "$followerD._id",
              name: "$followerD.name",
              username: "$followerD.username",
              avatar: "$followerD.avatar",
            },
          },
        ]);
      } catch (err) {
        const error = new HttpError("Could not update profile #a", 500);
        return next(error);
      }

      const mapped = user.map((user) => {
        const relations = [];
        let relation = totalDoc.following.find(
          (u) => String(u) == String(user.id)
        );

        relation && relations.push("Following");

        relation = totalDoc.pendingFollowing.find(
          (u) => String(u) == String(user.id)
        );

        relation && relations.push("Requested");

        relations.push("Follow");

        return {
          name: user.name,
          username: user.username,
          avatar: user.avatar,
          relation: relations[0],
        };
      });

      return res.status(200).json({
        detail: mapped,
        total: totalDoc ? totalDoc.follower.length : 0,
      });
    } else {
      try {
        user = await User.aggregate([
          {
            $match: {
              _id: new ObjectId(req.userId),
            },
          },
          {
            $lookup: {
              from: "users",
              localField: detail,
              foreignField: "_id",
              as: "detail",
            },
          },
          {
            $unwind: {
              path: "$detail",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $skip: +skip * 18,
          },
          {
            $limit: 18,
          },
          {
            $project: {
              _id: 0,
              name: "$detail.name",
              username: "$detail.username",
              avatar: "$detail.avatar",
            },
          },
        ]);
      } catch (err) {
        const error = new HttpError("Could not get data #b", 500);
        return next(error);
      }
      let relation;

      if (detail === "following") {
        relation = "Following";
      } else if (detail === "blocked") {
        relation = "Unblock";
      } else if (detail === "pendingFollower") {
        relation = "Approve";
      }

      let validData = user.filter((value) => Object.keys(value).length !== 0);

      validData = validData.map((u) => ({ ...u, relation }));

      res.status(200).json({
        detail: validData,
        total: totalDoc ? totalDoc[detail].length : 0,
      });
    }
  }
};

exports.avatar = async (req, res, next) => {
  let media;

  await cloudinary.uploader.upload(
    req.file.path,
    { width: 200, height: 200, gravity: "face", crop: "thumb" },
    (err, image) => {
      if (err) {
        const error = new HttpError("Could not update avatar", 500);
        return next(error);
      }
      fs.unlinkSync(req.file.path);
      // res.json(image);
      media = image.secure_url;
    }
  );

  let user;
  try {
    user = await User.updateOne(
      { _id: req.userId },
      { $set: { avatar: media } },
      { upsert: true }
    );
  } catch (err) {
    const error = new HttpError("Could not update avatar #a", 500);
    return next(error);
  }

  if (!user.nModified) {
    throw new Error("Could not update avatar #b");
  }

  res.status(201).json({ avatar: media });
};

const USER_DETAILS = ["follower", "following", "taggedPost", "post"];

exports.userData = async (req, res, next) => {
  const { username, id, skip } = req.params;

  const isValid = USER_DETAILS.includes(id);

  if (!isValid) {
    const error = new HttpError("Invalid Parameter", 422);
    return next(error);
  }

  let usernameDetails, user, totalDoc;

  try {
    if (+skip == 0) {
      if (id === "taggedPost") {
        totalDoc = await User.findOne({ username })
          .select({
            private: 1,
            taggedPost: 1,
          })
          .lean();
      } else if (id === "post") {
        totalDoc = await User.findOne({ username })
          .select({
            private: 1,
            post: 1,
          })
          .lean();
      } else if (id === "follower") {
        totalDoc = await User.findOne({ username })
          .select({
            private: 1,
            follower: 1,
          })
          .lean();
      } else {
        totalDoc = await User.findOne({ username })
          .select({
            private: 1,
            following: 1,
          })
          .lean();
      }
    }

    if (id === "taggedPost" || id === "post") {
      usernameDetails = await User.aggregate([
        {
          $match: {
            username: username,
          },
        },
        {
          $lookup: {
            from: "posts",
            localField: id,
            foreignField: "_id",
            as: "detail",
          },
        },
        {
          $unwind: {
            path: "$detail",
            preserveNullAndEmptyArrays: true,
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
          $skip: +skip * 18,
        },
        {
          $limit: 18,
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
              date: "$detail.date",
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
        {
          $sort: {
            "details.date": -1,
          },
        },
      ]);
    } else {
      usernameDetails = await User.aggregate([
        {
          $match: {
            username: username,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: id,
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
          $skip: +skip * 18,
        },
        {
          $limit: 18,
        },
        {
          $project: {
            _id: 0,
            id: "$detail._id",
            name: "$detail.name",
            username: "$detail.username",
            avatar: "$detail.avatar",
          },
        },
      ]);
    }
  } catch (err) {
    console.log(err);
    const error = new HttpError("Could not get user data #a", 500);
    return next(error);
  }

  if (!totalDoc) {
    const error = new HttpError("No user found", 404);
    return next(error);
  }

  if (req.userId) {
    try {
      user = await User.findById(req.userId).lean();
    } catch (err) {
      const error = new HttpError("Could not get user data #b", 500);
      return next(error);
    }
  }

  let dataToSend;

  if (id === "taggedPost" || id === "post") {
    dataToSend = usernameDetails.map((p) => ({
      id: p._id,
      styles: p.details.styles,
      media: p.details.media,
      likeCount: p.details.likeCount,
      commentCount: p.details.commentCount + p.replyCount,
    }));
  } else {
    dataToSend = usernameDetails.map((u) => ({
      name: u.name,
      username: u.username,
      avatar: u.avatar,
      relation: "Follow",
    }));
  }

  const relationHandler = (detail, relation) => {
    return {
      ...detail,
      relation,
    };
  };

  if (user && (id === "following" || id === "follower")) {
    dataToSend = usernameDetails.map((u) => {
      const detail = {
        name: u.name,
        username: u.username,
        avatar: u.avatar,
      };

      if (String(u.id) == String(user._id)) {
        return relationHandler(detail, "Self");
      }

      relation = user.following.find((a) => String(a) == String(u.id));
      if (relation) {
        return relationHandler(detail, "Following");
      }

      relation = user.pendingFollowing.find((a) => String(a) == String(u.id));
      if (relation) {
        return relationHandler(detail, "Requested");
      }

      relation = user.follower.find((a) => String(a) == String(u.id));
      if (relation) {
        return relationHandler(detail, "Follow");
      }

      relation = user.pendingFollower.find((a) => String(a) == String(u.id));
      if (relation) {
        return relationHandler(detail, "Approve");
      }

      relation = user.blocked.find((a) => String(a) == String(u.id));
      if (relation) {
        return relationHandler(detail, "Unblock");
      }

      relation = user.blockedby.find((a) => String(a) == String(u.id));
      if (relation) {
      } else {
        return relationHandler(detail, "Follow");
      }
    });

    dataToSend = dataToSend.filter((d) => d !== undefined);
  }

  if (totalDoc.private) {
    if (!user) {
      res.status(200).json({ detail: [], total: 0 });
      return;
    }

    const isUserFollowing = user.following.find(
      (u) => String(u) == String(totalDoc._id)
    );

    if (!isUserFollowing) {
      res.status(200).json({ detail: [], total: 0 });
      return;
    }

    res.status(200).json({ detail: dataToSend, total: totalDoc[id].length });
    return;
  }

  if (user) {
    res.status(200).json({ detail: dataToSend, total: totalDoc[id].length });
  } else {
    res.status(200).json({ detail: dataToSend, total: totalDoc[id].length });
  }
};
