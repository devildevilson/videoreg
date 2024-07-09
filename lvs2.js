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
  const egsv = new egsv_api({
    host: process.env.EGSV_HOST3,
    port: process.env.EGSV_PORT3,
    user: process.env.EGSV_USER3,
    pass: process.env.EGSV_PASS3
  });

  const list = await egsv.method("lvs2.record.list", {
    filter: {
      datetime: {
        $gte: '2024-02-22T00:00:00+06:00', 
        $lte: '2024-02-27T23:59:59+06:00'
      }
    },
    include: ['files', 'cameras', 'alarms', 'metadata'],
    limit: 100000
  });

  //console.log(list);
  console.log(list.records.length);
  console.log(list.records[0]);
  console.log(list.records[1]);
  console.log(list.records[3]);

  let xlsx_data = [
    [ "event_id", "camera", "event", "type", "date", "time" ]
  ];

  for (const record of list.records) {
    const cam_name = record.origin_name === "Manual device" ? "ostanovka1" : record.origin_name;
    //const final_datetime = record.datetime.replaceAll("+06:00","").split("T").join(" ");
    const final_datetime = record.datetime.replaceAll("+06:00","").split("T");

    xlsx_data.push([
      record.origin_event_id, cam_name, record.description, record.comment, final_datetime[0], final_datetime[1]
    ]);
  }

  const buffer = xlsx.build([{name: 'Лист1', data: xlsx_data}]);
  fs.writeFileSync("lvs_events.xlsx", buffer);
})();

