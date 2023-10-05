require("dotenv").config();
const google = require("./apis/google").config("jwt.keys.json");

(async () => {
  const res = await google.find_sheets();
  console.log(res);
})();