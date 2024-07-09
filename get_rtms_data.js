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

const egsv = new egsv_api({
  host: process.env.EGSV_HOST3,
  port: process.env.EGSV_PORT3,
  user: process.env.EGSV_USER3,
  pass: process.env.EGSV_PASS3
});

const good_num = num => num < 10 ? "0"+num : ""+num;

function to_egsv_string(in_date) {
  const date = new Date(in_date);
  const year = date.getFullYear();
  const month = good_num(date.getMonth()+1);
  const day = good_num(date.getDate());
  const hour = good_num(date.getHours());
  const minute = good_num(date.getMinutes());
  const second = good_num(date.getSeconds());
  const timezone_offset = Math.floor(date.getTimezoneOffset() / 60);
  const sign = timezone_offset < 0 ? "+" : "-"; // берем обратный знак тому что возвращает getTimezoneOffset
  const offset = good_num(Math.abs(timezone_offset));
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${offset}:00`;
}

(async () => {
  const current_date = new Date();
  let start_date = new Date();
  start_date.setHours(start_date.getHours() - 4);
  const cur_egsv = to_egsv_string(current_date);
  const start_egsv = to_egsv_string(start_date);
  //console.log(cur_egsv);
  //console.log(start_egsv);

  // 3 вещи: логин пароль ЕГСВ, id камеры, время 
  // время текущее, а вот остальное нужно указать в настройках
  const datas = await egsv.rtms_number_list({
    filter: {
      camera: {
        "$in": [ 
          //'635d606d5334b0478e864c9f',
          "635d49b65334b0478e86030e"
        ]
      },
      datetime: {
        "$gte": start_egsv,
        "$lte": cur_egsv
      }
    },
    sort: { datetime: 'desc' }
  });

  console.log(datas.count);
  console.log(datas.numbers.length);
})();
