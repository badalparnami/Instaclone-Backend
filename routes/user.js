const express = require("express");
const router = express.Router();

const userControllers = require("../controllers/user");
const userControllers2 = require("../controllers/userNew");
const isAuth = require("../middleware/is-auth");
const optionalAuth = require("../middleware/optional-auth");
const fileUpload = require("../middleware/file-upload");

router.post("/profile", isAuth, userControllers.profile);

router.post("/security", isAuth, userControllers.security);

router.post("/password", isAuth, userControllers.updatePassword);

router.get("/details/:detail/:skip", isAuth, userControllers2.getDetails);

router.post(
  "/avatar",
  isAuth,
  fileUpload.single("image"),
  userControllers2.avatar
);

router.delete("/avatar", isAuth, userControllers.deleteAvatar);
router.post("/follow", isAuth, userControllers.follow);
router.post("/approveTag", isAuth, userControllers.approveTag);

router.post("/toggleblock", isAuth, userControllers.toggleBlock);

router.get("/suggestions/:id", isAuth, userControllers.suggestions);

router.get("/search/:term", optionalAuth, userControllers.search);

router.get("/detail/:username", optionalAuth, userControllers.detail);

router.get("/me", isAuth, userControllers.myData);

router.post("/revert", isAuth, userControllers.revertUsername);

router.get(
  "/data/:username/:id/:skip",
  optionalAuth,
  userControllers2.userData
);

module.exports = router;
