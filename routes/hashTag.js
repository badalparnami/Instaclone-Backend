const express = require("express");
const router = express.Router();

const hashTagControllers = require("../controllers/hashTag");
const optionalAuth = require("../middleware/optional-auth");

router.get("/:tag/:skip", optionalAuth, hashTagControllers.getPost);

module.exports = router;
