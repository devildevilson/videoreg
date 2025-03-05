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
const zabbix_api = require("./apis/zabbix");
const axios_digest = require("@mhoc/axios-digest-auth");
const http = require('http');
const mjpeg = require("./apis/mjpeg");

const zabbix_aqt = new zabbix_api({ host: "10.4.1.49", token: process.env.ZABBIX_AQT_API_TOKEN });
const zabbix_akm = new zabbix_api({ host: "10.0.67.142", token: process.env.ZABBIX_API_TOKEN });
const zabbix_sko = new zabbix_api({ host: "10.0.67.142", token: process.env.ZABBIX_API_TOKEN });

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest('hex');
}

function is_numeric_char(c) { return /^\d$/.test(c); }
function is_numeric(str) { return /^\d+$/.test(str); }
function is_hex(str) { return /^[0-9A-F]+$/i.test(str); }
function is_coords(str) { return /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/g.test(str); }
function is_ip_address(str) { return /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/g.test(str); }

function mysql_real_escape_string(str) {
  return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
    switch (char) {
      case "\0": return "\\0";
      case "\x08": return "\\b";
      case "\x09": return "\\t";
      case "\x1a": return "\\z";
      case "\n": return "\\n";
      case "\r": return "\\r";
      case "\"":
      case "'":
      case "\\":
      case "%":
        return "\\"+char; // prepends a backslash to backslash, percent,
                          // and double/single quotes
      default: return char;
    }
  });
}

const strcmp = (a,b) => (a < b ? -1 : +(a > b));

const make_date = (d) => `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;

(async () => {
  // актобе
  const egsv_rtms = new egsv_api({
    host: process.env.EGSV_HOST5,
    port: process.env.EGSV_PORT5,
    user: process.env.EGSV_USER5,
    pass: process.env.EGSV_PASS5
  });

  // СКО
  // const egsv_rtms = new egsv_api({
  //   host: process.env.EGSV_HOST3,
  //   port: process.env.EGSV_PORT3,
  //   user: process.env.EGSV_USER3,
  //   pass: process.env.EGSV_PASS3
  // });

  await egsv_rtms.auth();

  const { cameras } = await egsv_rtms.method("camera.list", {
    "limit": 100000,
    "sort": {
      "name": "asc"
    },
    "filter": {
      "_taxonomies": {
        "$in": [ "66d7dd8cac02e80330b60c3b" ]
        //"$in": [ "63527c2df731249831320261" ]
      }
    }
  });

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const mongodate = make_date(yesterday);

  const limit = 10000;
  let num_arr = [];
  let num_count = 0;
  let counter = 0;
  do {
    const offset = counter;
    const ret = await egsv_rtms.method("rtms.number.list", {
      limit,
      offset,
      sort: { datetime: 'desc' },
      filter: {
        //camera: { $in: [ cam.id ] },
        datetime: {
          $gte: `${mongodate}T00:00:00+05:00`,
          $lte: `${mongodate}T23:59:59+05:00`
        }
      }
    });

    num_count = ret.count;
    counter += limit;
    num_arr = num_arr.concat(ret.numbers);
    console.log(num_arr.length);
  } while (counter < num_count);

  console.log(`Yesterday event count ${num_arr.length}`);

  let xlsx_data = [ [ "Имя", "Количество событий всего", "Количество событий со скоростью", "Количество событий без скорости", "Процент" ] ];
  for (const cam of cameras) {
    console.log(cam.name);

    const arr = num_arr.filter(el => el.camera === cam.id);
    const counter = arr.reduce((acc, num) => acc + (typeof num.speed === "number" && num.speed !== 0), 0);
    const percent = arr.length === 0 ? 0 : (counter / arr.length);

    //console.log(cam.name, numbers.length, counter, (numbers.length - counter), (counter / numbers.length) * 100);
    xlsx_data.push([ cam.name, arr.length, counter, (arr.length - counter), percent * 100 ]);
  }

  const xlsx_file_data = xlsx.build([{ name: "Лист1", data: xlsx_data }]);
  fs.writeFileSync("speed_measure_percent.xlsx", xlsx_file_data);
})();