"use strict"
require("dotenv").config();
const axios = require("axios");
const dahua = require("./apis/dahua");
const hikvision = require("./apis/hikvision");
const trassir = require("./apis/trassir");
const prtg_api = require("./apis/prtg");
const egsv_api = require("./apis/egsv");
const subnet = require("./apis/subnet");
const xlsx = require("node-xlsx");
const fs = require("fs");
const zabbix_api = require("./apis/zabbix");

const egsv_akm1 = new egsv_api({
  host: process.env.EGSV_HOST,
  port: process.env.EGSV_PORT,
  user: process.env.EGSV_USER,
  pass: process.env.EGSV_PASS
});

const egsv_akm2 = new egsv_api({
  host: process.env.EGSV_HOST4,
  port: process.env.EGSV_PORT4,
  user: process.env.EGSV_USER4,
  pass: process.env.EGSV_PASS4
});

const egsv_aqt = new egsv_api({
  host: process.env.EGSV_HOST2,
  port: process.env.EGSV_PORT2,
  user: process.env.EGSV_USER2,
  pass: process.env.EGSV_PASS2
});

const get_provider = {
  "old_hikvision": function(str) {
    return str.indexOf("/av_stream") !== -1;
  },
  "dahua": function(str) {
    return str.indexOf("/cam/realmonitor?channel=") !== -1;
  },
  "uniview": function(str) {
    return str.indexOf("/unicast/c") !== -1;
  },
  "hikvision": function(str) {
    return str.indexOf("/ISAPI/Streaming/Channels/") !== -1;
  },
  "huawei": function(str) {
    return str.indexOf("/LiveMedia/ch") !== -1;
  },
  "axis": function(str) {
    return str.indexOf("/axis-media/media.amp?camera=") !== -1;
  },
  "polyvision": function(str) {
    return str.indexOf("&stream=1.sdp") !== -1 || str.indexOf("&stream=0.sdp") !== -1 || str.indexOf("&stream=00.sdp") !== -1;
  }
};

function find_provider(str) {
  //console.log(str);
  for (const [ provider, func ] of Object.entries(get_provider)) {
    //console.log(func);
    if (func(str.trim())) return provider;
  }
  return "unknown";
}

let all_cameras = [];
let obj_data = [];
let str_data = "";

//const test = "rtsp://aqmol:aqmol12345@10.29.9.130:554/mpeg4/ch1/sub/av_stream";
//console.log(test.indexOf("/av_stream"));

(async () => {
  const api = egsv_aqt;

  let ip_unique = {};
  let taxes = {};
  const { taxonomies } = await api.method("taxonomy.list", { limit: 1000000 });
  for (const t of taxonomies) {
    taxes[t.id] = t.name;
  }

  const { cameras } = await api.method("camera.list", { can: [ 'view' ], include: ['account', 'server'], limit: 1000000 });
  //console.log(cameras);
  for (const camera of cameras) {
    const final_url = camera.url ? camera.url : camera.url;
    const desc = camera.data ? camera.data.description : "";
    const tax = camera.taxonomies ? taxes[camera.taxonomies[0]] : "";
    const provider = find_provider(camera.url);

    // const url = new URL(camera.url);
    // if (!ip_unique[url.hostname]) ip_unique[url.hostname] = { count: 0, desc: "", provider: "" };
    // ip_unique[url.hostname].count += 1;
    // if (ip_unique[url.hostname].provider === "") ip_unique[url.hostname].provider = find_provider(camera.url);
    // if (camera.data) { ip_unique[url.hostname].desc = camera.data.description; }
    // // нужно из таксономии брать названия
    // if (camera.taxonomies && ip_unique[url.hostname].desc === "") {
    //   ip_unique[url.hostname].desc = taxes[camera.taxonomies[0]];
    // }

    const local_data = `${final_url}|${tax ? tax : "no desc"}|${provider}\n`;
    str_data += local_data;
  }

  // obj_data.push([ "address", "description", "provider", "count" ]);
  // for (const [ ip_address, data ] of Object.entries(ip_unique)) {
  //   obj_data.push([ ip_address, data.desc, data.provider, data.count ]);
  // }

  // const buffer = xlsx.build([{ name: 'Лист1', data: obj_data }]);
  // fs.writeFileSync("akm_objects.xlsx", buffer);

  fs.writeFileSync("akm_objects.txt", str_data);
})();

