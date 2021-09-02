const jwt = require("jsonwebtoken");
const HttpError = require("../models/http-error");
const TokenBl = require("../models/tokenbl");
const User = require("../models/user");

module.exports = async (req, res, next) => {
  const authHeader = req.get("Authorization");

  if (authHeader) {
    const token = authHeader.split(" ")[1];

    if (token || token !== "null" || token !== null) {
      let decodedToken;
      try {
        decodedToken = jwt.verify(token, process.env.JWT);
      } catch (err) {
        if (err.message === "invalid token") {
          const error = new HttpError(
            "Not authenticated, Login again to perform actions.",
            401
          );
          return next(error);
        } else if (err.message === "jwt malformed") {
          const error = new HttpError(
            "Something went wrong #a. Please Login Again",
            401
          );
          return next(error);
        }
        const error = new HttpError(
          "Something went wrong #b. Please Login Again",
          500
        );
        return next(error);
      }
      if (!decodedToken) {
        const error = new HttpError(
          "Not authenticated, Login again to perform actions.",
          401
        );
        return next(error);
      }

      let tokenAlreadyBl;

      try {
        tokenAlreadyBl = await TokenBl.findOne({ token });
      } catch (err) {
        console.log(err);
        const error = new HttpError("Something went wrong #b", 500);
        return next(error);
      }

      if (tokenAlreadyBl) {
        const error = new HttpError(
          "Not authenticated, Login again to perform action.",
          401
        );
        return next(error);
      }

      req.userId = decodedToken.userId;
      req.token = token;

      let isUserExists;
      try {
        isUserExists = await User.findById(decodedToken.userId);
      } catch (err) {
        const error = new HttpError("Something went wrong #c", 500);
        return next(error);
      }

      if (!isUserExists) {
        const error = new HttpError("User Not Found", 401);
        return next(error);
      }
    }
  }

  next();
};
