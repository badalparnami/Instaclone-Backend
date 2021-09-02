const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");

const User = require("../models/user");
const HttpError = require("../models/http-error");
const TokenBl = require("../models/tokenbl");

const notAllowedUsernames = [
  "signup",
  "profile",
  "explore",
  "post",
  "newpost",
  "404",
];

exports.signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new HttpError(
      "Validation failed, entered data is incorrect",
      422
    );
    return next(error);
  }
  const { name, email, password, username } = req.body;

  let existingUser;

  try {
    existingUser = await User.findOne({ email }).select({ email: 1 }).lean();
  } catch (err) {
    const error = new HttpError("Signing up failed #a", 500);
    return next(error);
  }

  if (existingUser) {
    const error = new HttpError("Email exists already", 422);
    return next(error);
  }

  try {
    existingUserName = await User.findOne({ username })
      .select({ username: 1 })
      .lean();
  } catch (err) {
    const error = new HttpError("Signing up failed #aa", 500);
    return next(error);
  }

  if (existingUserName) {
    const error = new HttpError("Username exists already", 422);
    return next(error);
  }

  if (notAllowedUsernames.includes(username.toString().toLowerCase())) {
    const error = new HttpError("This username is not allowed", 422);
    return next(error);
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    const error = new HttpError("Could not create user. Please try again", 500);
    return next(error);
  }

  const newUser = new User({
    name,
    email,
    password: hashedPassword,
    username,
    prevUsernameDetails: [username, new Date()],
  });

  try {
    await newUser.save();
  } catch (err) {
    const error = new HttpError("Signing up failed #b", 500);
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      process.env.JWT
    );
  } catch (err) {
    const error = new HttpError("Signing up failed #c", 500);
    return next(error);
  }

  res.status(201).json({
    // email: newUser.email,
    token,
    // name: newUser.name,
    // username: newUser.username,
  });
};

exports.login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new HttpError(
      "Validation failed, entered data is incorrect",
      422
    );
    return next(error);
  }
  const { email, password } = req.body;

  let existingUser;

  try {
    existingUser = await User.findOne({ email });
  } catch (err) {
    const error = new HttpError("Logging in failed #a", 500);
    return next(error);
  }

  if (!existingUser) {
    const error = new HttpError(
      "Could not find any user with the particular email id",
      400
    );
    return next(error);
  }

  let isValidPassword = false;

  try {
    isValidPassword = await bcrypt.compare(password, existingUser.password);
  } catch (err) {
    const error = new HttpError("Something went wrong please try again", 500);
    return next(error);
  }

  if (!isValidPassword) {
    const error = new HttpError("Password Incorrect", 403);
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: existingUser.id, email: existingUser.email },
      process.env.JWT
    );
  } catch (err) {
    const error = new HttpError("Logging in failed #b", 500);
    return next(error);
  }

  res.json({
    // email: existingUser.email,
    token,
    // name: existingUser.name,
    // username: existingUser.username,
  });
};

exports.logout = async (req, res, next) => {
  const token = req.token;
  let existingToken;

  try {
    existingToken = await TokenBl.findOne({ token }).select({ id: 1 }).lean();
  } catch (err) {
    const error = new HttpError("Logout failed #a", 500);
    return next(error);
  }

  if (existingToken) {
    const error = new HttpError("Logout already executed for this User", 401); //aka TOKEN
    return next(error);
  }

  const newToken = new TokenBl({
    token,
  });

  try {
    await newToken.save();
  } catch (err) {
    const error = new HttpError("Logout failed #b", 500);
    return next(error);
  }

  res.status(200).json({ message: "Logout Successful" });
};
