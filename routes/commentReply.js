const express = require("express");
const router = express.Router();

const commentReplyControllers = require("../controllers/commentReply");
const isAuth = require("../middleware/is-auth");

router.post("/create", isAuth, commentReplyControllers.create);

router.post("/togglelike", isAuth, commentReplyControllers.toggleLike);

router.delete("/delete", isAuth, commentReplyControllers.delete);

module.exports = router;
