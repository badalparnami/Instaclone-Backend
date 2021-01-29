const express = require("express");
const router = express.Router();

const commentReplyControllers = require("../controllers/commentReply");
const isAuth = require("../middleware/is-auth");
const optionalAuth = require("../middleware/optional-auth");

router.post("/create", isAuth, commentReplyControllers.create);

router.post("/togglelike", isAuth, commentReplyControllers.toggleLike);

router.delete("/delete", isAuth, commentReplyControllers.delete);

// router.get("/comments", optionalAuth, commentControllers.get);

module.exports = router;
