const User = require("../models/user");
const HttpError = require("../models/http-error");
const bcrypt = require("bcryptjs");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CHANGE = {
  name: {
    min: 3,
    max: 50,
    unique: false,
  },
  username: {
    min: 3,
    max: 20,
    unique: true,
  },
  website: {
    min: 0,
    max: 120,
    unique: false,
  },
  bio: {
    min: 0,
    max: 120,
    unique: false,
  },
  email: {
    min: 0,
    max: 100,
    unique: true,
  },
};

function validURL(str) {
  var pattern = new RegExp(
    "^(https?:\\/\\/)?" + // protocol
      "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name
      "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
      "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
      "(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
      "(\\#[-a-z\\d_]*)?$",
    "i"
  ); // fragment locator
  return !!pattern.test(str);
}

const notAllowedUsernames = [
  "signup",
  "profile",
  "explore",
  "post",
  "newpost",
  "404",
];

exports.profile = async (req, res, next) => {
  const { updates } = req.body;

  let user;
  try {
    user = await User.findById(req.userId);
  } catch (err) {
    const error = new HttpError("Could not update profile #a", 500);
    return next(error);
  }

  for (let i = 0; i < updates.length; i++) {
    const change = updates[i]["change"];
    const value = updates[i]["value"];

    const isChangeAvailable = CHANGE.hasOwnProperty(change);

    if (!isChangeAvailable) {
      const error = new HttpError(`Invalid Parameter ${change}`, 422);
      return next(error);
    }

    if (
      value.length < CHANGE[change].min ||
      value.length > CHANGE[change].max
    ) {
      if (change === "bio" && value.length === 0) {
        continue;
      }
      const error = new HttpError(`Invalid Value for the ${change}`, 422);
      return next(error);
    }
    if (change === "email") {
      if (
        !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(
          value
        )
      ) {
        const error = new HttpError(`Invalid Value for the ${change}`, 422);
        return next(error);
      }
    } else if (change === "website" && value.length > 1) {
      const isUrlValid = validURL(value);
      if (!isUrlValid) {
        const error = new HttpError(`Invalid Value for the ${change}`, 422);
        return next(error);
      }
    }

    if (CHANGE[change].unique === true && user[change] !== value) {
      let isValueAvailable;

      if (change === "username") {
        if (notAllowedUsernames.includes(value.toString().toLowerCase())) {
          const error = new HttpError("This username is not allowed", 422);
          return next(error);
        }

        try {
          isValueAvailable = await User.findOne({ username: value })
            .select({ username: 1 })
            .lean();
        } catch (err) {
          const error = new HttpError("Could not update profile #b", 500);
          return next(error);
        }
      } else {
        try {
          isValueAvailable = await User.findOne({ email: value })
            .select({ email: 1 })
            .lean();
        } catch (err) {
          const error = new HttpError("Could not update profile #c", 500);
          return next(error);
        }
      }

      if (isValueAvailable) {
        const error = new HttpError(
          `${value} is already taken for ${change}`,
          422
        );
        return next(error);
      }
    }
  }

  const isUsername = updates.find((u) => u["change"] === "username");

  let prevUsernameDetails;
  let allowed = "no";

  if (isUsername !== undefined) {
    if (user.lastUsernameChanged) {
      const lastChanged = user.lastUsernameChanged.getTime();
      const today = new Date();
      const isGreaterInSec = today.getTime() - lastChanged;
      allowed = isGreaterInSec / 86400000 > 25;
    }

    if (allowed || allowed === "no") {
      prevUsernameDetails = [user.username, new Date()];
      user.prevUsernameDetails = prevUsernameDetails;
      user.lastUsernameChanged = new Date();
    }

    if (!allowed) {
      const error = new HttpError(
        "Could not change username as you can change it once within 25 days.",
        500
      );
      return next(error);
    }
  }

  // lastUsernameChanged + 25 < new Date()

  for (let i = 0; i < updates.length; i++) {
    const change = updates[i]["change"];
    const value = updates[i]["value"];
    // if (!allowed && change === "username") {
    //   error.push(
    //     "Could not change username as you can change it once within 25 days."
    //   );
    //   continue;
    // }
    user[change] = value;
  }

  try {
    await user.save();
  } catch (err) {
    const error = new HttpError("Could not update profile #d", 500);
    return next(error);
  }

  res.status(201).json({
    message: "success",
  });
};

const SECURITY = {
  private: [true, false],
  manuallyApproveTag: [true, false],
  tag: ["everyone", "follow", "none"],
  mention: ["everyone", "follow", "none"],
};

exports.security = async (req, res, next) => {
  const [change, value] = req.body.security;

  const isSecurityAvailable = SECURITY.hasOwnProperty(change);

  if (!isSecurityAvailable) {
    const error = new HttpError("Invalid paramater", 422);
    return next(error);
  }

  const isValid = SECURITY[change].includes(value);

  if (!isValid) {
    const error = new HttpError(
      `Invalid value for the ${change} parameter`,
      422
    );
    return next(error);
  }

  let user;
  try {
    user = await User.findById(req.userId);
  } catch (err) {
    const error = new HttpError(`Could not update ${change} setting #a`, 500);
    return next(error);
  }

  user[change] = value;

  if (change === "private" && user.pendingFollower.length > 0) {
    user.follower = [...user.follower, ...user.pendingFollower];

    let updates;
    try {
      updates = await User.updateMany(
        { _id: { $in: user.pendingFollower } },
        {
          $pull: { pendingFollowing: user.id },
          $push: { following: user.id },
        },
        { multi: true }
      );
    } catch (err) {
      const error = new HttpError("Something went wrong #a", 500);
      return next(error);
    }

    user.pendingFollower = [];

    // console.log(updates);
  }

  if (change === "manuallyApproveTag" && user.pendingTaggedPost.length > 0) {
    user.taggedPost = [...user.taggedPost, ...user.pendingTaggedPost];
    user.pendingTaggedPost = [];
  }

  try {
    await user.save();
  } catch (err) {
    const error = new HttpError(`Could not update ${change} setting  #b`, 500);
    return next(error);
  }

  res.status(201).json({ message: "success" });
};

exports.updatePassword = async (req, res, next) => {
  const { pass, newPass, confirmNewPass } = req.body;

  if (
    !/(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/.test(pass) ||
    !/(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/.test(newPass) ||
    !/(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/.test(confirmNewPass)
  ) {
    const error = new HttpError(
      "Password should of minimum 6 characters containing at least one number, uppercase and lowercase",
      422
    );
    return next(error);
  }

  if (newPass !== confirmNewPass) {
    const error = new HttpError("Please make sure both passwords match.", 422);
    return next(error);
  }

  let user;

  try {
    user = await User.findById(req.userId).select({ password: 1 });
  } catch (err) {
    const error = new HttpError("Could not update password #a", 500);
    return next(error);
  }

  let isValidPassword = false;

  try {
    isValidPassword = await bcrypt.compare(pass, user.password);
  } catch (err) {
    const error = new HttpError("Something went wrong please try again", 500);
    return next(error);
  }

  if (!isValidPassword) {
    const error = new HttpError(
      "Your old password was entered incorrectly. Please enter again.",
      403
    );
    return next(error);
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(newPass, 12);
  } catch (err) {
    const error = new HttpError(
      "Could not update password. Please try again",
      500
    );
    return next(error);
  }

  user.password = hashedPassword;

  try {
    await user.save();
  } catch (err) {
    const error = new HttpError("Could not update password #b", 500);
    return next(error);
  }

  res.status(201).json({ message: "success" });
};

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

//r
exports.getDetails = async (req, res, next) => {
  const { detail, skip } = req.params;
  const isValid = DETAILS.includes(detail);

  if (!isValid) {
    const error = new HttpError("Invalid parameter", 422);
    return next(error);
  }

  let user, totalDoc;

  if (detail !== "follower") {
    try {
      if (+skip == 0) {
        totalDoc = await User.findById(req.userId);
      }

      if (DeepPopulate.includes(detail)) {
        user = await User.findById(req.userId, "-password -_id").populate({
          path: detail,
          options: { sort: { date: -1 }, limit: 18, skip: +skip * 18 },
          populate: { path: "comment" },
        });
      } else {
        user = await User.findById(req.userId).populate(detail);
      }
    } catch (err) {
      const error = new HttpError("Something went wrong #a", 500);
      return next(error);
    }

    if (detail === "pendingFollower" && !user.private) {
      const error = new HttpError(
        "Account should be private for accessing pending follower",
        422
      );
      return next(error);
    }

    if (detail === "pendingTaggedPost" && !user.manuallyApproveTag) {
      const error = new HttpError(
        "Account's tag setting should be set to manually in order to access pending tagged post",
        422
      );
      return next(error);
    }
  }

  let filter;
  if (
    detail === "like" ||
    detail === "saved" ||
    detail === "archivePost" ||
    detail === "taggedPost" ||
    detail === "pendingTaggedPost" ||
    detail === "post"
  ) {
    let userDetail = user[detail];

    if (detail === "post") {
      userDetail = user.post.filter((p) => p.isArchived !== true);
    }

    filter = userDetail.map((u) => ({
      media: u.media,
      styles: u.styles,
      id: u._id,
      likeCount: u.like.length,
      commentCount:
        u.comment &&
        u.comment.length +
          u.comment.reduce((sum, i) => i.reply && sum + i.reply.length, 0),
    }));
  } else {
    let relation;

    if (detail === "following") {
      relation = "Following";
    } else if (detail === "blocked") {
      relation = "Unblock";
    } else if (detail === "pendingFollower") {
      relation = "Approve";
    } else {
      try {
        if (+skip == 0) {
          totalDoc = await User.findById(req.userId);
        }
        user = await User.findById(req.userId)
          .populate("follower")
          .populate("following")
          .populate("pendingFollowing");
      } catch (err) {
        const error = new HttpError("Something went wrong #b", 500);
        return next(error);
      }

      filter = user.follower.map((u) => {
        const id = u._id;
        const isFollowing = user.following.find((u) => u.id == id);
        if (isFollowing) {
          return {
            name: u.name,
            username: u.username,
            avatar: u.avatar,
            relation: "Following",
          };
        }

        const isRequested = user.pendingFollowing.find((u) => u.id == id);
        if (isRequested) {
          return {
            name: u.name,
            username: u.username,
            avatar: u.avatar,
            relation: "Requested",
          };
        } else {
          return {
            name: u.name,
            username: u.username,
            avatar: u.avatar,
            relation: "Follow",
          };
        }
      });

      return res.status(200).json({
        detail: filter,
        total: totalDoc && totalDoc[detail].length,
      });
    }

    filter = user[detail].map((u) => ({
      name: u.name,
      username: u.username,
      avatar: u.avatar,
      relation,
    }));
  }

  res.status(200).json({
    detail: filter,
    total: totalDoc && totalDoc[detail].length,
  });
};

//r
exports.avatar = async (req, res, next) => {
  let media;

  await cloudinary.uploader.upload(
    req.file.path,
    { width: 200, height: 200, gravity: "face", crop: "thumb" },
    (err, image) => {
      if (err) {
        return res.xtatus(500).json({ err });
      }
      fs.unlinkSync(req.file.path);
      // res.json(image);
      media = image.secure_url;
    }
  );

  let user;
  try {
    user = await User.findById(req.userId);
  } catch (err) {
    const error = new HttpError("Could not update avatar #a", 500);
    return next(error);
  }

  user.avatar = media;

  try {
    await user.save();
  } catch (err) {
    const error = new HttpError("Could not update avatar #b", 500);
    return next(error);
  }

  res.status(201).json({ avatar: media });
};

exports.deleteAvatar = async (req, res, next) => {
  let user;
  try {
    user = await User.findById(req.userId).select({ avatar: 1 });
  } catch (err) {
    const error = new HttpError("Could not delete avatar #a", 500);
    return next(error);
  }

  if (!user.avatar) {
    const error = new HttpError("Avatar Already Deleted", 422);
    return next(error);
  }

  const splitImg = user.avatar.split("/");
  const publicId = splitImg[splitImg.length - 1].split(".")[0];

  await cloudinary.uploader.destroy(publicId, (err) => {
    if (err) {
      const error = new HttpError(
        "Something went wrong while deleting avatar",
        500
      );
      return next(error);
    }
  });

  //https://support.cloudinary.com/hc/en-us/articles/202520352-I-have-deleted-an-image-and-though-it-has-been-removed-from-the-media-library-it-is-still-available-via-URL-

  user.avatar = null;

  try {
    await user.save();
  } catch (err) {
    const error = new HttpError("Could not delete avatar #b", 500);
    return next(error);
  }

  res.status(201).json({ avatar: null });
};

exports.follow = async (req, res, next) => {
  const { username } = req.body;

  let user;
  try {
    user = await User.findById(req.userId);
  } catch (err) {
    const error = new HttpError("Could not perform action #a", 500);
    return next(error);
  }

  let usernameDetails;
  try {
    usernameDetails = await User.findOne({ username });
  } catch (err) {
    const error = new HttpError("Could not perform action #b", 500);
    return next(error);
  }

  if (!usernameDetails) {
    const error = new HttpError(
      "No user found with the particular username",
      404
    );
    return next(error);
  }

  if (user.id === usernameDetails.id) {
    const error = new HttpError(
      "You can not perform this action on yourself",
      422
    );
    return next(error);
  }

  let isBlocked = user.blocked.find((b) => b == usernameDetails.id);

  if (isBlocked) {
    const error = new HttpError(
      "You can not perform this action on blocked user #a",
      422
    );
    return next(error);
  }

  isBlocked = user.blockedby.find((b) => b == usernameDetails.id);

  if (isBlocked) {
    const error = new HttpError(
      "You can not perform this action on blocked user #b",
      422
    );
    return next(error);
  }

  let isAlreadyFollowing = usernameDetails.follower.find((u) => u == user.id);

  if (isAlreadyFollowing) {
    usernameDetails.follower = usernameDetails.follower.filter(
      (u) => u != user.id
    );

    user.following = user.following.filter((u) => u != usernameDetails.id);

    try {
      await Promise.all([user.save(), usernameDetails.save()]);
    } catch (err) {
      const error = new HttpError("Could not perform action #c", 500);
      return next(error);
    }

    return res.status(201).json({ message: "success", relation: "Follow" });
  }

  isAlreadyFollowing = usernameDetails.pendingFollower.find(
    (u) => u == user.id
  );

  if (isAlreadyFollowing) {
    usernameDetails.pendingFollower = usernameDetails.pendingFollower.filter(
      (u) => u != user.id
    );

    user.pendingFollowing = user.pendingFollowing.filter(
      (u) => u != usernameDetails.id
    );

    try {
      await Promise.all([user.save(), usernameDetails.save()]);
    } catch (err) {
      const error = new HttpError("Could not perform action #d", 500);
      return next(error);
    }

    return res.status(201).json({ message: "success", relation: "Follow" });
  }

  isAlreadyFollowing = usernameDetails.pendingFollowing.find(
    (u) => u == user.id
  );

  if (isAlreadyFollowing) {
    usernameDetails.pendingFollowing = usernameDetails.pendingFollowing.filter(
      (u) => u != user.id
    );
    user.pendingFollower = user.pendingFollower.filter(
      (u) => u != usernameDetails.id
    );

    usernameDetails.following = [...usernameDetails.following, user];
    user.follower = [...user.follower, usernameDetails];

    try {
      await Promise.all([user.save(), usernameDetails.save()]);
    } catch (err) {
      const error = new HttpError("Could not perform action #d", 500);
      return next(error);
    }

    let relation = user.following.find((u) => u == usernameDetails.id);
    if (relation) {
      relation = "Following";
    } else {
      relation = user.pendingFollowing.find((u) => u == usernameDetails.id);

      if (relation) {
        relation = "Requested";
      } else {
        relation = "Follow";
      }
    }

    return res.status(201).json({ message: "success", relation });
  }

  const otherUserPrivate = usernameDetails.private;
  let relation;
  if (otherUserPrivate) {
    usernameDetails.pendingFollower = [
      ...usernameDetails.pendingFollower,
      user,
    ];

    user.pendingFollowing = [...user.pendingFollowing, usernameDetails];
    relation = "Requested";
  } else {
    usernameDetails.follower = [...usernameDetails.follower, user];

    user.following = [...user.following, usernameDetails];
    relation = "Following";
  }

  try {
    await Promise.all([user.save(), usernameDetails.save()]);
  } catch (err) {
    const error = new HttpError("Could not perform action #e", 500);
    return next(error);
  }

  return res.status(201).json({ message: "success", relation: relation });
};

exports.approveTag = async (req, res, next) => {
  const { postId } = req.body;

  let user;

  try {
    user = await User.findById(req.userId).select({
      pendingTaggedPost: 1,
      taggedPost: 1,
    });
  } catch (err) {
    const error = new HttpError("Could not perform action #a", 500);
    return next(error);
  }

  const isPending = user.pendingTaggedPost.find((pt) => pt == postId);

  if (!isPending) {
    const error = new HttpError("Already approved particular post", 422);
    return next(error);
  }

  user.pendingTaggedPost = user.pendingTaggedPost.filter((pt) => pt !== postId);

  user.taggedPost = [...user.taggedPost, postId];

  try {
    await user.save();
  } catch (err) {
    const error = new HttpError("Could not perform action #b", 500);
    return next(error);
  }

  res.status(201).json({ message: "success" });
};

exports.toggleBlock = async (req, res, next) => {
  const { username } = req.body;

  let usernameDetails;

  try {
    usernameDetails = await User.findOne({ username });
  } catch (err) {
    const error = new HttpError("Could not perform action #a", 500);
    return next(error);
  }

  if (!usernameDetails) {
    const error = new HttpError(
      "No user found with the provided username",
      404
    );
    return next(error);
  }

  let user;
  try {
    user = await User.findById(req.userId);
  } catch (err) {
    const error = new HttpError("Could not perform action #b", 500);
    return next(error);
  }

  if (user.id === usernameDetails.id) {
    const error = new HttpError(
      "You cannot perform this action on yourself",
      422
    );
    return next(error);
  }

  const isAlreadyBlocked = user.blocked.find((b) => b == usernameDetails.id);
  let relation;
  if (isAlreadyBlocked) {
    user.blocked = user.blocked.filter((b) => b != usernameDetails.id);
    usernameDetails.blockedby = usernameDetails.blockedby.filter(
      (b) => b != user.id
    );
    relation = "Follow";
  } else {
    user.blocked = [...user.blocked, usernameDetails];
    usernameDetails.blockedby = [...usernameDetails.blockedby, user];
    relation = "Unblock";

    const remove = [
      "follower",
      "following",
      "pendingFollower",
      "pendingFollowing",
    ];

    remove.forEach(
      (r) => (user[r] = user[r].filter((u) => u != usernameDetails.id))
    );

    remove.forEach(
      (r) =>
        (usernameDetails[r] = usernameDetails[r].filter((u) => u != user.id))
    );
  }

  try {
    await Promise.all([user.save(), usernameDetails.save()]);
  } catch (err) {
    const error = new HttpError("Could not perform action #c", 500);
    return next(error);
  }

  res.status(201).json({ message: "success", relation: relation });
};

exports.search = async (req, res, next) => {
  const { term } = req.params;

  let users;
  try {
    users = await User.find(
      {
        username: { $regex: new RegExp(term), $options: "i" },
      },
      "name username avatar tag mention"
    ).limit(20);
  } catch (err) {
    const error = new HttpError("Could not perform search #a", 500);
    return next(error);
  }

  if (req.userId) {
    let user;

    try {
      user = await User.findById(req.userId).select({
        blocked: 1,
        blockedby: 1,
        follower: 1,
      });
    } catch (err) {
      const error = new HttpError("Could not perform search #b", 500);
      return next(error);
    }

    const filter1 = users.filter((u) => !user.blocked.includes(u.id));
    const filter2 = filter1.filter((u) => !user.blockedby.includes(u.id));

    // filter2.forEach((e) => {
    //   delete e._id;
    // });

    const filter3 = filter2.map((f) => ({
      name: f.name,
      username: f.username,
      avatar: f.avatar,
      tag: f.tag,
      mention: f.mention,
      relation:
        user.id == f.id
          ? true
          : user.follower.find((u) => u == f.id)
          ? true
          : false,
    }));

    res.status(200).json({
      users: filter3,
    });
  } else {
    const filter1 = users.map((f) => ({
      name: f.name,
      username: f.username,
      avatar: f.avatar,
    }));
    res.status(200).json({ users: filter1 });
  }
};

exports.revertUsername = async (req, res, next) => {
  let user;

  try {
    user = await User.findById(req.userId).select({
      prevUsernameDetails: 1,
      username: 1,
    });
  } catch (err) {
    const error = new HttpError(
      "Could not revert to previous username #a",
      500
    );
    return next(error);
  }

  const isChangeAvailable = user.prevUsernameDetails;

  if (typeof isChangeAvailable === "object" && isChangeAvailable.length >= 2) {
    const prevUsername = isChangeAvailable[0];
    const lastChanged = isChangeAvailable[1].getTime();

    const today = new Date();
    const isGreaterInSec = today.getTime() - lastChanged;
    allowed = isGreaterInSec / 86400000 < 15;

    if (allowed) {
      let isUsernameTaken;
      try {
        isUsernameTaken = await User.findOne({ username: prevUsername })
          .select({ id: 1 })
          .lean();
      } catch (err) {
        const error = new HttpError(
          "Could not revert to previous username #a",
          500
        );
        return next(error);
      }
      if (isUsernameTaken) {
        res.status(200).json({
          message: "fail",
          error: `Could not update username as somebody is already using your previous username(${prevUsername})`,
        });
      } else {
        user.username = prevUsername;
        user.prevUsernameDetails = [];

        try {
          await user.save();
        } catch (err) {
          const error = new HttpError(
            "Could not revert to previous username #b",
            500
          );
          return next(error);
        }

        res.status(201).json({ message: "success" });
      }
    } else {
      res.status(200).json({ message: "fail #a" });
    }
  } else {
    res.status(200).json({ message: "fail #b" });
  }
};

exports.detail = async (req, res, next) => {
  const { username } = req.params;

  let user;

  if (req.userId) {
    try {
      user = await User.findById(req.userId).lean();
    } catch (err) {
      const error = new HttpError("Something went wrong #a", 500);
      return next(error);
    }
  }

  let usernameDetails;

  try {
    // usernameDetails = await User.findOne({ username })
    //   .populate({ path: "post", populate: { path: "comment" } })
    //   .populate({ path: "taggedPost", populate: { path: "comment" } });
    usernameDetails = await User.findOne({ username }).lean();
    // .populate("post")
    // .populate("taggedPost");
  } catch (err) {
    const error = new HttpError("Something went wrong #b", 500);
    return next(error);
  }

  if (!usernameDetails) {
    const error = new HttpError("No user found", 404);
    return next(error);
  }

  if (user && String(user._id) == String(usernameDetails._id)) {
    res
      .status(200)
      .json({ message: "fail", error: "redirect user to /profile" });
    return;
  }

  if (user) {
    let isBlocked = user.blocked.find(
      (u) => String(u) == String(usernameDetails._id)
    );

    if (isBlocked) {
      res.status(200).json({ message: "fail", error: "redirect user to /404" });
      return;
    }

    isBlocked = user.blockedby.find(
      (u) => String(u) == String(usernameDetails._id)
    );

    if (isBlocked) {
      res.status(200).json({ message: "fail", error: "redirect user to /404" });
      return;
    }
  }

  const isPrivate = usernameDetails.private;

  let isUserFollowing = "no",
    isFollower = "no";

  let mutuals = [],
    mutualsD = [];
  if (user) {
    const fgN = user.following.map((fg) => String(fg));
    const flN = usernameDetails.follower.map((fl) => String(fl));

    mutuals = fgN.filter((fg) => flN.includes(fg));

    if (mutuals.length > 0) {
      mutualsD = await User.find({ _id: { $in: mutuals } })
        .select({ username: 1, name: 1, avatar: 1 })
        .lean();
    }

    mutuals = mutualsD.map((u) => ({
      username: u.username,
      name: u.name,
      avatar: u.avatar,
    }));

    isUserFollowing = user.following.find(
      (u) => String(u) == String(usernameDetails._id)
    );

    if (isUserFollowing) {
      isUserFollowing = true;
    } else {
      isUserFollowing = user.pendingFollowing.find(
        (u) => String(u) == String(usernameDetails._id)
      );

      if (isUserFollowing) {
        isUserFollowing = false;
      }
    }

    isFollower = user.follower.find(
      (u) => String(u) == String(usernameDetails._id)
    );

    if (isFollower) {
      isFollower = true;
    } else {
      isFollower = user.pendingFollower.find(
        (u) => String(u) == String(usernameDetails._id)
      );
      if (isFollower) {
        isFollower = false;
      }
    }
  }

  // no, undefined, true, false

  const dataToSend = {
    name: usernameDetails.name,
    username: usernameDetails.username,
    avatar: usernameDetails.avatar,
    website: usernameDetails.website,
    bio: usernameDetails.bio,
    postCount: usernameDetails.post.length,
    followerCount: usernameDetails.follower.length,
    followingCount: usernameDetails.following.length,
    taggedPostCount: usernameDetails.taggedPost.length,
    private: isPrivate,
  };

  let relation = [];

  if (user) {
    if (isUserFollowing) {
      relation.push("Following");
    } else if (isUserFollowing === false) {
      relation.push("Requested");
    }

    if (isFollower) {
      relation.push("Follow");
    } else if (isFollower === false) {
      relation.push("Approve");
    }
  }

  if (isPrivate && !user) {
    return res.status(200).json({ user: dataToSend });
  }

  let dataToSend2 = {};

  // if (!isPrivate || (user && relation.includes("Following"))) {
  //   const unarchivedPost = usernameDetails.post.filter(
  //     (p) => p.isArchived !== true
  //   );

  //   const post = unarchivedPost.map((p) => ({
  //     media: p.media,
  //     styles: p.styles,
  //     likeCount: p.like.length,
  //     commentCount:
  //       p.comment.length +
  //       p.comment.reduce((sum, i) => sum + i.reply.length, 0),
  //     id: p._id,
  //   }));

  //   const unarchivedTaggedPost = usernameDetails.taggedPost.filter(
  //     (p) => p.isArchived !== true
  //   );

  //   const taggedPost = unarchivedTaggedPost.map((p) => ({
  //     media: p.media,
  //     styles: p.styles,
  //     likeCount: p.like.length,
  //     commentCount:
  //       p.comment.length +
  //       p.comment.reduce((sum, i) => sum + i.reply.length, 0),
  //     id: p._id,
  //   }));

  //   dataToSend2 = { post, taggedPost };
  // }

  if (!isPrivate && !user) {
    return res.status(200).json({ user: { ...dataToSend, ...dataToSend2 } });
  }

  if (user) {
    if (isPrivate && relation.includes("Following")) {
      return res.status(200).json({
        user: { ...dataToSend, ...dataToSend2 },
        mutuals,
        relation: "Following",
      });
    } else if (isPrivate) {
      return res
        .status(200)
        .json({ user: dataToSend, mutuals, relation: relation[0] });
    } else {
      return res.status(200).json({
        user: { ...dataToSend, ...dataToSend2 },
        mutuals,
        relation: relation[0],
      });
    }
  }
};

exports.myData = async (req, res, next) => {
  let user;

  try {
    // user = await User.findById(req.userId, "-password -_id").populate({
    //   path: "post",
    //   options: { sort: { date: -1 } },
    //   populate: { path: "comment" },
    // });
    user = await User.findById(req.userId, "-password -_id").lean();
  } catch (err) {
    console.log(err);
    const error = new HttpError("Could not get profile data #a", 500);
    return next(error);
  }

  // const unarchivedPost = user.post.filter((p) => p.isArchived !== true);

  // const post = unarchivedPost.map((p) => ({
  //   media: p.media,
  //   styles: p.styles,
  //   likeCount: p.like.length,
  //   commentCount:
  //     p.comment.length + p.comment.reduce((sum, i) => sum + i.reply.length, 0),
  //   id: p._id,
  // }));

  let isUsernameChangeAllowed = user.lastUsernameChanged === undefined;
  let lastUsername;

  if (!isUsernameChangeAllowed) {
    const date = new Date();
    isUsernameChangeAllowed =
      user.lastUsernameChanged.getTime() - date.getTime();

    isUsernameChangeAllowed = isUsernameChangeAllowed / 86400000 > 25;

    if (!isUsernameChangeAllowed) {
      const isChangeAvailable = user.prevUsernameDetails;
      let isRevertPossible =
        typeof isChangeAvailable === "object" && isChangeAvailable.length >= 2;

      if (isRevertPossible) {
        const lastChanged = isChangeAvailable[1].getTime();

        const isGreaterInSec = date.getTime() - lastChanged;
        isRevertPossible = isGreaterInSec / 86400000 < 15;

        if (isRevertPossible) {
          lastUsername = isChangeAvailable[0];
        }
      }
    }
  }

  const dataToSend = {
    name: user.name,
    email: user.email,
    username: user.username,
    avatar: user.avatar,
    website: user.website,
    bio: user.bio,
    private: user.private,
    manuallyApproveTag: user.manuallyApproveTag,
    tag: user.tag,
    mention: user.mention,
    // post: post,
    follower: user.follower.length,
    following: user.following.length,
    isUsernameChangeAllowed,
    lastUsername,
    likeCount: user.like.length,
    savedCount: user.saved.length,
    blockedCount: user.blocked.length,
    pendingFollowerCount: user.pendingFollower.length,
    archivePostCount: user.archivePost.length,
    taggedPostCount: user.taggedPost.length,
    pendingTaggedPostCount: user.pendingTaggedPost.length,
    postCount: user.post.length,
  };

  res.status(200).json({ user: dataToSend });
};

exports.suggestions = async (req, res, next) => {
  const { id } = req.params;
  let user;

  try {
    user = await User.findById(req.userId)
      .select({
        following: 1,
        blocked: 1,
        blockedby: 1,
        pendingFollowing: 1,
        pendingFollower: 1,
      })
      .lean();
  } catch (err) {
    const error = new HttpError("Could not find user suggestions #a", 500);
    return next(error);
  }

  const notInclude = [
    user._id,
    ...user.following,
    ...user.blocked,
    ...user.blockedby,
    ...user.pendingFollowing,
    ...user.pendingFollower,
  ];

  let users;
  try {
    users = await User.find({ _id: { $nin: notInclude } }).limit(+id);
  } catch (err) {
    const error = new HttpError("Could not find user suggestions #b", 500);
    console.log(err);
    return next(error);
  }

  users = users.map((u) => ({
    name: u.name,
    username: u.username,
    avatar: u.avatar,
  }));

  res.status(200).json({ users });
};

const USER_DETAILS = ["follower", "following", "taggedPost", "post"];

//r
exports.userData = async (req, res, next) => {
  const { username, id, skip } = req.params;

  const isValid = USER_DETAILS.includes(id);

  if (!isValid) {
    const error = new HttpError("Invalid Parameter", 500);
    return next(error);
  }

  let usernameDetails, user, totalDoc;

  try {
    if (+skip == 0) {
      totalDoc = await User.findOne({ username });
    }

    if (id === "taggedPost" || id === "post") {
      usernameDetails = await User.findOne({ username }).populate({
        path: id,
        options: { sort: { date: -1 }, limit: 18, skip: +skip * 18 },
        populate: { path: "comment" },
      });
    } else {
      usernameDetails = await User.findOne({ username }).populate({
        path: id,
        options: { sort: { date: -1 }, limit: 18, skip: +skip * 18 },
      });
    }
  } catch (err) {
    const error = new HttpError("Could not get user data #a", 500);
    return next(error);
  }

  if (req.userId) {
    try {
      user = await User.findById(req.userId);
    } catch (err) {
      const error = new HttpError("Could not get user data #b", 500);
      return next(error);
    }
  }

  let dataToSend;

  if (id === "taggedPost" || id === "post") {
    const unarchivedPost = usernameDetails[id].filter(
      (p) => p.isArchived !== true
    );
    dataToSend = unarchivedPost.map((p) => ({
      media: p.media,
      styles: p.styles,
      id: p._id,
      likeCount: p.like.length,
      commentCount:
        p.comment.length +
        p.comment.reduce((sum, i) => sum + i.reply.length, 0),
    }));
  } else {
    dataToSend = usernameDetails[id].map((u) => ({
      name: u.name,
      username: u.username,
      avatar: u.avatar,
      relation: "Follow",
    }));
  }

  if (user && (id === "following" || id === "follower")) {
    dataToSend = usernameDetails[id].map((u) => {
      const relations = [];
      let relation;

      if (u.id == user.id) {
        relations.push("Self");
      }

      relation = user.following.find((a) => a == u.id);
      relation ? relations.push("Following") : "";

      relation = user.pendingFollowing.find((a) => a == u.id);
      relation ? relations.push("Requested") : "";

      relation = user.follower.find((a) => a == u.id);
      relation ? relations.push("Follow") : "";

      relation = user.pendingFollower.find((a) => a == u.id);
      relation ? relations.push("Approve") : "";

      relation = user.blocked.find((a) => a == u.id);
      relation ? relations.push("Unblock") : "";

      relation = user.blockedby.find((a) => a == u.id);
      relation ? relations.push("Return") : "";

      if (relations.includes("Return")) {
        return;
      }

      return {
        name: u.name,
        username: u.username,
        avatar: u.avatar,
        relation: relations[0],
      };
    });
  }

  if (usernameDetails.private) {
    if (!user) {
      res.status(200).json({ detail: [], total: 0 });
      return;
    }

    const isUserFollowing = user.following.find((u) => u == usernameDetails.id);

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
