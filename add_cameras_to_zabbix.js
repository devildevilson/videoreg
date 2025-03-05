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

(async () => {
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

  await egsv_rtms.auth();
  //await egsv_sko.auth();

  let ret = await egsv_rtms.method("camera.list", {
    "can": [
      "view",
      "update",
      "delete",
    ],
    "include": [
      "computed",
      "account",
      "server"
    ],
    "limit": 100000,
    "sort": {
      "name": "asc"
    },
    "filter": {
      "_taxonomies": {
        "$in": [ "66ebf363ac02e80330a6340a", "672b0ca9177a0766a6bc8ebd", "673af1673bd57a9f74abd5b9" ]
      }
    }
  });

  //console.log(ret.cameras[0]);
  //console.log(ret.cameras.length);

  ret.cameras = ret.cameras.sort((a,b) => strcmp(a.name,b.name));
  // let cam_xlsx = [ [ "Группа", "Название", "Тип", "Адрес", "Ссылка", "Дата создания" ] ];
  // for (const cam of ret.cameras) {
  //   const g_name = cam.name.split(".")[0].trim();
  //   const c_type = cam.name.split(".")[1].trim().slice(0,-1);
  //   const date = "'"+cam.created_at.trim().split(".")[0].split("T").join(" ");

  //   cam_xlsx.push([g_name, cam.name.trim(), c_type, cam.data.description.trim(), cam.url, date]);
  // }
  // const xlsx_cont = xlsx.build([{ name: "Камеры", data: cam_xlsx }]);
  // fs.writeFileSync("cam_list.xlsx", xlsx_cont);
  //return;

  // придется получить камеры из заббикса, сравнить их и уже потом добавлять
  const zabbix_groups = await zabbix_aqt.method("hostgroup.get", {
    output: "extend",
    search: { name: "ОВН" }
  });
  const zabbix_groups_arr = zabbix_groups.map(val => val.groupid);

  const zabbix_cameras = await zabbix_aqt.method("host.get", {
    selectInterfaces: "extend",
    groupids: zabbix_groups_arr // [ 44 ] // 121
  });

  //console.log(zabbix_groups.length);
  //console.log(zabbix_cameras.length);
  let cam_exists = {};
  for (const cam of zabbix_cameras) {
    const address = cam.interfaces[0].ip;
    cam_exists[address] = cam.hostid;
  }
  //return;

  let unique_ip = {};
  let unique_group = {};
  let unique_group_name = {};

  let arr = [];
  for (const cam of ret.cameras) {
    const host = new URL(cam.url).hostname.trim();
    if (cam_exists[host]) continue;

    const group = cam.name.trim().split(".")[0].trim();
    const type = cam.name.trim().split(".")[1].trim();
    const group_name = cam.data.description.trim();
    const egsv_id = cam.id;
    const latlng_str = (cam.latlng[0] ? cam.latlng[0] + "," + cam.latlng[1] : "").trim();
    const local_str = `${group} ${type} ${host} ${group_name} ${latlng_str}`;
    //console.log(latlng_str);
    //console.log(local_str);

    arr.push({
      group,
      type,
      host,
      group_name,
      latlng_str,
      egsv_id
    });

    if (unique_ip[host]) {
      console.log(`IP collision ${host}`);
    }

    if (unique_group[group] && unique_group[group] !== group_name) {
      console.log(`Name mismatch ${group} ${group_name}`);
    }

    if (unique_group_name[group_name] && unique_group_name[group_name] !== group) {
      console.log(`Group mismatch ${group_name} ${group}`);
    }

    if (!unique_ip[host]) unique_ip[host] = true;
    if (!unique_group[group]) unique_group[group] = group_name;
    if (!unique_group_name[group_name]) unique_group_name[group_name] = group;
  }

  //const d = await zabbix_aqt.method("host.get", { groupids: [ 479 ], selectParentTemplates: "extend" });
  //console.log(d);
  //console.log(d[0].parentTemplates);

  //return;

  const ignore_groups = {
    "OVN0611 Остановка «Болашак» ул. Бокенбай-батыра": true,
    "OVN0261 11 мкр. ул. Аз наурыз д. 49, 57 магазин Магнит": true,
  };
  let created_group = {};
  const start = 0;
  for (let i = start; i < arr.length; ++i) {
    const data = arr[i];
    const z_group_name = `${data.group} ${data.group_name}`;
    if (z_group_name.includes("OVN0000 ул.Бр.Жубановых д. 278")) continue;
    if (z_group_name.includes("OVN0000 ул.Макаренко двор д. 1 и д. 272 Бр.Жубановых")) continue;
    if (ignore_groups[z_group_name]) continue;
    //console.log(z_group_name);

    if (!created_group[z_group_name]) {
      const group_name = `ОВН/${z_group_name}`;
      try {
        const ret = await zabbix_aqt.method("hostgroup.create", { name: group_name });
        created_group[z_group_name] = ret.groupids[0];
      } catch (e) {
        // найдем группу?
        const ret = await zabbix_aqt.method("hostgroup.get", { filter: { name: [ group_name ] } });
        if (ret.length > 1) { console.log(ret); throw `fd;lfqlfmwlfqlf`; }
        created_group[z_group_name] = ret[0].groupid;
      }
    }

    if (!created_group[z_group_name]) {
      throw `Could not find group ${z_group_name}`;
    }

    const short_group_name = data.group_name.substring(0, 80);

    // сразу в шаблоны нужно добавить было
    const ret = await zabbix_aqt.method("host.create", {
      "host": `${data.group} ${data.type} ${data.host}`,
      "name": `${data.group} ${data.type} ${short_group_name}`, // ${data.group_name} 
      "interfaces": [
        {
          "type": 2,
          "main": 1,
          "useip": 1,
          "ip": data.host,
          "dns": "",
          "port": "161",
          "details": {
            version: 2,
            community: "public"
          }
        }
      ],
      // имеет смысл добавить в две группы
      "groups": [
        {
          "groupid": created_group[z_group_name]
        },
        {
          "groupid": 121
        }
      ],
      "tags": [
        {
          "tag": "type",
          "value": data.type
        },
        {
          "tag": "group",
          "value": data.group
        }
      ],
      "macros": [
        {
          "macro": "{$EGSVID}",
          "value": data.egsv_id
        },
        {
          "macro": "{$LATLNGSTR}",
          "value": data.latlng_str
        }
      ],
      "templates": [
        {
          "templateid": 10564
        }
      ]
    });

    console.log(i, `${data.group} ${data.type} ${data.group_name}`);

    //break;
  }
})();