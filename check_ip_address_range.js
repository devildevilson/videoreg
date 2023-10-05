require("dotenv").config();
const db = require("./apis/db");
const axios = require("axios");
const dahua = require("./apis/dahua");
const hikvision = require("./apis/hikvision");
const trassir = require("./apis/trassir");
const egsv_api = require("./apis/egsv");
const prtg_api = require("./apis/prtg");
const subnet = require("./apis/subnet");

(async () => {
  const object_subnet = new subnet(`10.0.68.1/25`);
  for (const address of object_subnet.range(9, 9+20)) {
    // const dev = new dahua({
    //   host: address,
    //   port: 80,
    //   user: "aqmol",
    //   pass: "aqmol12345"
    // });
    // const resp = await dev.device_info();
    // console.log(address, resp);
    console.log(address);
  }
})();


