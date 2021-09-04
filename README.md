# Instagram Web App Clone Backend

Clone of Instagram Web using MERN stack.

View Demo [here](https://gramclone.netlify.app/).

**To view the frontend code. Visit [here](https://github.com/badalparnami/Instaclone-Frontend).**

## Usage

Create a [MongoDB](https://www.mongodb.com/cloud/atlas) atlas and [Cloudinary](https://cloudinary.com/) account.

1. Fork the repo and then Clone/Download it.
2. `cd Instaclone-Backend`
3. Create `nodemon.json` file in the root directory.
4. Setup required environment variables.

```js
{
  "env": {
    "DB_USER": //Database username,
    "DB_PASS": //Database password,
    "DB_NAME": //Database name,
    "ACCESS": "*",
    "JWT": //Random string,
    "CLOUDINARY_CLOUD_NAME": //Cloudinary cloud name,
    "CLOUDINARY_API_KEY": //Cloudinary API key,
    "CLOUDINARY_API_SECRET": //Cloudinary API secret
  }
}

```

5. Change ACCESS property (if require)
6. Run `npm install`
7. Run `npm run server` to start the local server at port 8080.

## Structure

```bash
.
├── app.js
├── controllers
│   ├── auth.js
│   ├── comment.js
│   ├── commentReply.js
│   ├── hashTag.js
│   ├── post.js
│   ├── postNew.js
│   ├── user.js
│   ├── userNew.js
├── middlewares
│   ├── file-upload.js
│   ├── is-auth.js
│   ├── optional-auth.js
├── models
│   ├── comment.js
│   ├── commentReply.js
│   ├── hashTag.js
│   ├── http-error.js
│   ├── post.js
│   ├── tokenbl.js
│   ├── user.js
├── routes
│   ├── auth.js
│   ├── comment.js
│   ├── commentReply.js
│   ├── hashTag.js
│   ├── post.js
│   ├── user.js
├── uploads             #Mandatory Folder and sub-folder
│   ├── images
```

## API ENDPOINTS

> /api/auth

| Endpoint | Method | Payload                                                                         | Description     |
| -------- | ------ | ------------------------------------------------------------------------------- | --------------- |
| /login   | POST   | { email: 'test@test.com', password: 'iAmStrong'}                                | Login User      |
| /signup  | POST   | { name: 'Test, email: 'test@test.com', username: 'test', password: 'iAmStrong'} | Signup User     |
| /logout  | POST   | None                                                                            | Blocklist token |

> /api/user

| Endpoint                     | Method | Payload                                                                             | Description                                                               |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| /profile                     | POST   |                                                                                     | Update profile = name, username, website, bio and email                   |
| /security                    | POST   |                                                                                     | Update profile's privacy = private, tag, mention and manually approve tag |
| /password                    | POST   | { pass: 'iAmWeak' , newPass: 'somethingStrong', confirmNewPass: 'somethingStrong' } | Update password                                                           |
| /details/{detail}/{skip}     | GET    | None                                                                                | Get particular data e.g. liked posts, followers etc                       |
| /avatar                      | POST   |                                                                                     | Add avatar                                                                |
| /avatar                      | DELETE | None                                                                                | Remove avatar                                                             |
| /follow                      | POST   | { username: 'testUser'}                                                             | Follow or Unfollow a specific user                                        |
| /approveTag                  | POST   | { postId: 'as8d9js'}                                                                | Approve tag                                                               |
| /toggleblock                 | POST   | { username: 'testUser'}                                                             | Block or Unblock a particular user                                        |
| /suggestions/{id}            | GET    | None                                                                                | Get Suggestions of User                                                   |
| /search/{term}               | GET    | None                                                                                | Search users based on term                                                |
| /detail/{username}           | GET    | None                                                                                | Get detail of a specific username                                         |
| /me                          | GET    | None                                                                                | Get logged in user details                                                |
| /revert                      | POST   | None                                                                                | Revert username                                                           |
| /data/{username}/{id}/{skip} | GET    | None                                                                                | Get Specific detail of a particular username like Followers.              |

> /api/post

| Endpoint        | Method | Payload                                         | Description                     |
| --------------- | ------ | ----------------------------------------------- | ------------------------------- |
| /create         | POST   | { caption, allowComment, styles, tag, hashTag } | Create a post                   |
| /togglelike     | POST   | { postId: 'as8d9js' }                           | Toggle Like on Post             |
| /togglesaved    | POST   | { postId: 'as8d9js' }                           | Toggle Save on Post             |
| /togglearchive  | POST   | { postId: 'as8d9js' }                           | Toggle Archive on Post          |
| /removetag      | POST   | { postId: 'as8d9js' }                           | Remove tag from post            |
| /allowcomment   | POST   | { postId: 'as8d9js' }                           | Toggle Allow Comment on post    |
| /feed/{skip}    | GET    | None                                            | Get Feed Posts                  |
| /explore/{skip} | GET    | None                                            | Get Explore Page Posts          |
| /detail/{id}    | GET    | None                                            | Get Detail of a particular post |
| /delete         | DELETE | { id: 'as8d9js' }                               | Delete the post                 |

> /api/comment

| Endpoint              | Method | Payload          | Description              |
| --------------------- | ------ | ---------------- | ------------------------ |
| /create               | POST   | { postid, text } | Create a comment         |
| /togglelike           | POST   | { commentId }    | Toggle like on a comment |
| /delete               | DELETE | { commentId }    | Delete a comment         |
| /get/{id}/{skip}      | GET    | None             | Get comments             |
| /comments/{id}/{skip} | GET    | None             | Get comments replies     |

> /api/commentreply

| Endpoint    | Method | Payload           | Description                    |
| ----------- | ------ | ----------------- | ------------------------------ |
| /create     | POST   | { comment, text } | Create a comment reply         |
| /togglelike | POST   | { commentId }     | Toggle like on a comment reply |
| /delete     | DELETE | { commentId }     | Delete a comment               |

> /api/hashtag

| Endpoint      | Method | Payload | Description                    |
| ------------- | ------ | ------- | ------------------------------ |
| /{tag}/{skip} | GET    | None    | Get Posts depending on HashTag |

## Build with

- Express
- Bcryptjs
- Cloudinary
- Express-Validator
- Jsonwebtoken
- Mongoose
- Multer
- Nodemon (dev dependency)
