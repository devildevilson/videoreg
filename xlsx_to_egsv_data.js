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
  const filename = "smartcity89.xlsx";
  const devices_file = xlsx.parse(filename);
  let xlsx_data = [ [ "name", "desc", "url", "ignore", "archive", "days", "ignore", "ignore", "ignore", "ignore", "ignore", "ignore", "ptz", "user", "pass" ] ];
  let unique_name = {};
  //console.log(devices_file[0].data.length);
  for (const row of devices_file[0].data) {
    if (!row[0] || typeof row[0] !== "number") continue;
    const [ num, phys_address, address, type ] = row;
    const phys_address_final = phys_address.trim();
    if (!unique_name[phys_address_final]) unique_name[phys_address_final] = 0;
    unique_name[phys_address_final] += 1;

    const name = phys_address_final + " " + unique_name[phys_address_final];
    const huawei_link = `rtsp://admin:Frustratus%2319@${address}:554/LiveMedia/ch1/Media1/trackID=1`;
    const is_ptz = type.trim() === "PTZ";
    xlsx_data.push([
      name, phys_address, huawei_link, "", "true", 3, "", "", "", "", "", "", is_ptz ? "true" : "false", "admin", "Frustratus#19"
    ]);
  }

  const out_filename = "smartcity89_egsv.xlsx";
  const buffer = xlsx.build([{name: 'Лист1', data: xlsx_data}]);
  fs.writeFileSync(out_filename, buffer);
  console.log(`Written ${xlsx_data.length} lines to '${out_filename}'`);
})();