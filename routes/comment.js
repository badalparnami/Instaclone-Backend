const express = require("express");
const router = express.Router();

const commentControllers = require("../controllers/comment");
const isAuth = require("../middleware/is-auth");
const optionalAuth = require("../middleware/optional-auth");

router.post("/create", isAuth, commentControllers.create);

router.post("/togglelike", isAuth, commentControllers.toggleLike);

router.delete("/delete", isAuth, commentControllers.delete);

router.get("/get/:id/:skip", optionalAuth, commentControllers.getComments);

router.get(
  "/comments/:id/:skip",
  optionalAuth,
  commentControllers.getCommentReplies
);

module.exports = router;
