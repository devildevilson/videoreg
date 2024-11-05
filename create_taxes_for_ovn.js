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
const crypto = require("crypto");
const zabbix_api = require("./apis/zabbix");

const zabbix_aqt = new zabbix_api({ host: "10.4.1.49", token: process.env.ZABBIX_AQT_API_TOKEN });
const zabbix_akm = new zabbix_api({ host: "10.0.67.142", token: process.env.ZABBIX_API_TOKEN });
const zabbix_sko = new zabbix_api({ host: "10.0.67.142", token: process.env.ZABBIX_API_TOKEN });

const egsv_rtms = new egsv_api({
  host: process.env.EGSV_HOST5,
  port: process.env.EGSV_PORT5,
  user: process.env.EGSV_USER5,
  pass: process.env.EGSV_PASS5
});

const egsv_sko = new egsv_api({
  host: process.env.EGSV_HOST3,
  port: process.env.EGSV_PORT3,
  user: process.env.EGSV_USER3,
  pass: process.env.EGSV_PASS3
});

const strcmp = (a,b) => (a < b ? -1 : +(a > b));
const goodnum = (num, size = 4) => {
  let numstr = ""+num;
  while (numstr.length < size) { numstr = "0"+numstr; }
  return numstr;
};

(async () => {
  const id_index = 7;
  const name_index = 9;

  const devices_data = xlsx.parse("devices.xlsx");
  for (let i = 0; i < devices_data[4].data.length; ++i) {
    const row = devices_data[4].data[i];
    const id = row[id_index];
    const name = row[name_index];
    if (typeof id !== "number") continue;
    if (typeof name !== "string") continue;
    if (i < 69) continue;

    const tax_name = `OVN${goodnum(id)} ${name}`;
    //console.log(tax_name);
    try {
      const ret = await egsv_rtms.method("taxonomy.create", { taxonomy: {
        name: tax_name,
        parent: "66ebf363ac02e80330a6340a"
      }});
      console.log(`Created  '${tax_name}'`);
    } catch (e) {
      //console.log(e);
      console.log(`Taxonomy '${tax_name}' is already exists`);
    }

    //break;
  }

  // надо добавить все камеры в таксономию
})();