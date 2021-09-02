const express = require("express");
const { check } = require("express-validator");
const router = express.Router();

const authControllers = require("../controllers/auth");
const isAuth = require("../middleware/is-auth");

router.post(
  "/login",
  [
    check("email")
      .normalizeEmail()
      .isEmail()
      .matches(
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/
      ),
    check("password")
      .isLength({ min: 6 })
      .matches(/(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/),
  ],
  authControllers.login
);

router.post(
  "/signup",
  [
    check("name")
      .isLength({ min: 3 })
      .matches(/^[a-zA-Z]([a-zA-Z]+){2,}(\s[a-zA-Z]([a-zA-Z]+)*)?$/),
    check("email")
      .normalizeEmail()
      .isEmail()
      .matches(
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/
      ),
    check("username")
      .isLength({ min: 3 })
      .matches(/^[a-zA-Z0-9\\_.]+$/),
    check("password")
      .isLength({ min: 6 })
      .matches(/(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/),
  ],
  authControllers.signup
);

router.post("/logout", isAuth, authControllers.logout);

module.exports = router;
