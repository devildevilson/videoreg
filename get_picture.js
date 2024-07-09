require("dotenv").config();
const axios = require("axios");
const dahua = require("./apis/dahua");
const hikvision = require("./apis/hikvision");
const trassir = require("./apis/trassir");
const egsv_api = require("./apis/egsv");
const prtg_api = require("./apis/prtg");
const subnet = require("./apis/subnet");
const db = require("./apis/db");
const xlsx = require("node-xlsx");
const fs = require("fs");
//const google = require("./apis/google").config("jwt.keys.json");
const crypto = require("crypto");

(async () => {
  const dev = new dahua({
    host: "10.4.51.34",
    port: 80,
    user: "admin",
    pass: "adm12345"
  });

  const data = await dev.picture("101");
  fs.writeFileSync("pic1.jpg", data);
})();
