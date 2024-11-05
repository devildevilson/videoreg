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

  const taxes = await egsv_rtms.method("taxonomy.list", {
    limit: 100000,
    filter: {
      $or: [ { name: { $regex: "OVN", $options: "i" } } ]
    }
  });

  for (const t of taxes.taxonomies) {
    const id = t.name.trim().split(" ")[0];
    const ret = await egsv_rtms.method("camera.list", {
      limit: 100000,
      filter: {
        $or: [ { name: { $regex: id, $options: "i" } } ]
      }
    });

    console.log(t.name.trim(), "cameras", ret.cameras.length);
    //console.log(ret.cameras.length);
    //if (ret.cameras.length > 1) return;
    for (const c of ret.cameras) {
      //if (c.taxonomies.length !== 0) continue;

      const upd = await egsv_rtms.method("camera.update", { camera: {
        id: c.id,
        taxonomies: [ t.id ],
        name: c.name,
        url: c.url,
        server: c.server,
        account: c.account
      }});
      //console.log(upd);
    }

    //break;
  }

  // надо добавить все камеры в таксономию
})();