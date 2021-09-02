const express = require("express");
const router = express.Router();

const postControllers = require("../controllers/post");
const postControllers2 = require("../controllers/postNew");
const isAuth = require("../middleware/is-auth");
const optionalAuth = require("../middleware/optional-auth");
const fileUpload = require("../middleware/file-upload");

router.post(
  "/create",
  isAuth,
  fileUpload.single("image"),
  postControllers.create
);

router.post("/togglelike", isAuth, postControllers2.toggleLike);

router.post("/togglesaved", isAuth, postControllers2.toggleSaved);

router.post("/togglearchive", isAuth, postControllers2.toggleArchive);

router.post("/removetag", isAuth, postControllers2.removeTag);

router.post("/allowcomment", isAuth, postControllers2.allowComment);

router.get("/feed/:skip", isAuth, postControllers2.feed);

router.get("/explore/:skip", isAuth, postControllers2.explore);

router.get("/detail/:id", optionalAuth, postControllers2.detail);

router.delete("/delete", isAuth, postControllers.delete);

module.exports = router;
