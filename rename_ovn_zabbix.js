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

async function rename_all_within_group(groupid) {
  const zabbix_cameras = await zabbix_aqt.method("host.get", {
    selectInterfaces: "extend",
    selectHostGroups: "extend",
    selectTags: "extend",
    groupids: [ groupid ]
  });

  //console.log(zabbix_cameras[0]);
  for (const cam of zabbix_cameras) {
    let good_name = undefined;
    for (const group of cam.hostgroups) {
      if (group.name.indexOf("ОВН/") !== -1) {
        if (good_name !== undefined) {
          console.log("Group name mismatch");
          console.log(good_name);
          console.log(group.name);
          throw "fqsaasgasgafa";
        }

        good_name = group.name;
      }
    }

    const group = good_name.split("/").slice(1).join("/").split(" ")[0];
    const human_name = good_name.split("/").slice(1).join("/").split(" ").slice(1).join(" ");
    const type = cam.host.split(" ").slice(1).slice(0, -1).join(" ");
    const address = cam.host.split(" ").slice(-1).join(" ");
    //console.log(group, "|", human_name);

    let tags = cam.tags.filter((t) => t.tag !== "queue").map((t) => { return { tag: t.tag, value: t.value } });
    tags.push({ tag: "queue", value: "240-окт" });

    const final_host = `${group} ${type} ${address}`;
    const final_name = `${group} ${type} ${human_name}`;
    console.log(final_name);

    const ret = await zabbix_aqt.method("host.update", {
      hostid: cam.hostid,
      name: final_name,
      host: final_host,
      tags
    });
  }
}

(async () => {
  await rename_all_within_group(615);

  // let ips = [];
  // const excel = xlsx.parse("rename_zabbix_data.xlsx");
  // for (const row of excel[2].data) {
  //   const name = row[2];
  //   const address = name.split(" ").slice(-1)[0];
  //   if (!is_ip_address(address)) continue;
  //   ips.push(address);
  // }

  // const interfaces = await zabbix_aqt.method("hostinterface.get", {
  //   filter: {
  //     ip: ips
  //   }
  // });
  
  // const hostids = interfaces.map((itf) => itf.hostid);
  // const zabbix_cameras = await zabbix_aqt.method("host.get", {
  //   selectInterfaces: "extend",
  //   selectHostGroups: "extend",
  //   selectTags: "extend",
  //   hostids: hostids
  // });

  // //console.log(zabbix_cameras[0]);

  // for (const cam of zabbix_cameras) {
  //   let good_name = undefined;
  //   for (const group of cam.hostgroups) {
  //     if (group.name.indexOf("ОВН/") !== -1) {
  //       if (good_name !== undefined) {
  //         console.log("Group name mismatch");
  //         console.log(good_name);
  //         console.log(group.name);
  //         throw "fqsaasgasgafa";
  //       }

  //       good_name = group.name;
  //     }
  //   }

  //   const group = good_name.split("/").slice(1).join("/").split(" ")[0];
  //   const human_name = good_name.split("/").slice(1).join("/").split(" ").slice(1).join(" ");
  //   const type = cam.host.split(" ").slice(1).slice(0, -1).join(" ");
  //   const address = cam.host.split(" ").slice(-1).join(" ");
  //   let groups = cam.hostgroups.filter((g) => g.groupid !== "616").map((g) => { return { groupid: g.groupid } });
  //   groups.push({ groupid: "616" });
  //   let tags = cam.tags.filter((t) => t.tag !== "queue").map((t) => { return { tag: t.tag, value: t.value } });
  //   tags.push({ tag: "queue", value: "513-ноя" });

  //   //console.log(groups);
  //   const final_host = `${group} ${type} ${address}`;
  //   const final_name = `${group} ${type} ${human_name}`;
  //   //console.log(final_host);
  //   console.log(final_name);

  //   const ret = await zabbix_aqt.method("host.update", {
  //     hostid: cam.hostid,
  //     name: final_name,
  //     host: final_host,
  //     groups,
  //     tags,
  //   });
  // }
})();