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

async function device_is_dahua(url) {
  const ipreg = new dahua({
    host: url.hostname,
    port: 80,
    user: url.username,
    pass: url.password
  });

  return await ipreg.device_info();
}

async function device_is_hikvision(url) {
  const ipreg = new hikvision({
    host: url.hostname,
    port: 80,
    user: url.username,
    pass: url.password
  });

  return await ipreg.device_info();
}

function make_good_day_num(num) {
  return num < 10 ? "0"+num : ""+num;
}

function make_current_day_str() {
  const current_date = new Date();
  const month_str = make_good_day_num(current_date.getMonth()+1);
  const day_str = make_good_day_num(current_date.getDate());
  return `${current_date.getFullYear()}.${month_str}.${day_str}`;
}

const eng_abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function num_to_abc(num) {
  const count = Math.floor(num / eng_abc.length);
  const index = num % eng_abc.length;
  if (count < 1) return eng_abc[index];
  return num_to_abc(count-1) + eng_abc[index];
}

function make_spreadsheet_coord(x, y) {
  return `${num_to_abc(x)}${y}`;
}

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest('hex');
}

function unite_objs(parent, obj) {
  let ret = parent;
  for (const [ key, value ] of Object.entries(obj)) {
    ret[key] = value;
  }

  return ret;
}

function is_numeric_char(c) { return /^\d$/.test(c); }
function is_numeric(str) { return /^\d+$/.test(str); }
function is_hex(str) { return /^[0-9A-F]+$/i.test(str); }
function is_coords(str) { return /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/g.test(str); }
function is_ip_address(str) { return /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/g.test(str); }
const object_tags_to_human = {
  "router": "роутер",
  "cam": "камера",
  "button": "кнопка",
  "nvr": "рег",
};
const human_tags_to_object = {
  "роутер": "router",
  "камера": "cam",
  "кнопка": "button",
  "рег": "nvr",
};
function check_type_group(type) { return human_tags_to_object[type] ? true : false }
function check_type_device(type) { return human_tags_to_object[type] ? true : false }
function get_true() { return true; }
const protocols_set = new Set([ "http", "https" ]);
function check_protocol(prot) { return protocols_set.has(prot); }
const boolean_set = new Set([ "+", "-", "✓", "×" ]);
function check_boolean(boolean) { return boolean_set.has(boolean); }
async function get_db_parent(field_name, value) { return { "parent_id": (await db.find_group_by_name(value)).id }; }
async function get_db_group(field_name, value) { return { "group_id": (await db.find_group_by_object_id(value)).id }; }
async function get_int(field_name, value) { 
  const parsed = typeof value === "number" ? value : parseInt(value);
  return { 
    [field_name]: isNaN(parsed) ? undefined : parsed 
  }; 
}

function arr_find(arr, value) {
  let i = 0;
  for (; i < arr.length && arr[i] !== value; ++i) {}
  return i;
}

function get_rid_of_first_el(arr) {
  arr.shift();
  return arr;
}

const GOOGLESHEETS_DEFAULT_NAME = "Sheet1";

const ignore_update_set = new Set([ "id", "data_hash", "egsv_id", "prtg_id", "time_updated" ]);
const groups_data_fields = [ 
  "parent", "object_id", "name", "description", "type", "coords", "gateway", "netmask", "host_min", "host_max", "comment", 
  "id", "data_hash", "egsv_id", "prtg_id", "time_updated" 
];

// const groups_hash_placement = arr_find(groups_data_fields, "data_hash");
// const devices_hash_placement = arr_find(devices_data_fields, "data_hash");
// const groups_id_placement = arr_find(groups_data_fields, "id");
// const devices_id_placement = arr_find(devices_data_fields, "id");
// const devices_type_placement = arr_find(devices_data_fields, "type");
// const devices_object_id_placement = arr_find(devices_data_fields, "object_id");
// const devices_ip_address_placement = arr_find(devices_data_fields, "ip_address");

const groups_data_placement = { 
  "parent": { column: "A", check: is_numeric, get_db_data: get_db_parent }, 
  "object_id": { column: "B", check: is_numeric, get_db_data: undefined }, 
  "name": { column: "C", check: get_true, get_db_data: undefined }, 
  "description": { column: "D", check: get_true, get_db_data: undefined }, 
  "type": { column: "E", check: check_type_group, get_db_data: undefined }, 
  "coords": { column: "F", check: is_coords, get_db_data: undefined }, 
  "gateway": { column: "G", check: is_ip_address, get_db_data: undefined }, 
  "netmask": { column: "H", check: is_ip_address, get_db_data: undefined }, 
  "host_min": { column: "I", check: is_ip_address, get_db_data: undefined }, 
  "host_max": { column: "J", check: is_ip_address, get_db_data: undefined }, 
  "comment": { column: "K", check: get_true, get_db_data: undefined }, 
  // вот эти данные не изменяются в бд
  "id": { column: "M", check: is_numeric, get_db_data: undefined }, 
  "data_hash": { column: "N", check: is_hex, get_db_data: undefined }, 
  "egsv_id": { column: "O", check: is_numeric, get_db_data: undefined }, 
  "prtg_id": { column: "P", check: is_numeric, get_db_data: undefined }, 
  "time_updated": { column: "Q", check: get_true, get_db_data: undefined }, 
};

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

let xlsx_data = [
  [ "№ объекта", "Описание", "IP", "Тип устройства", "Модель устройства", "Производитель" ]
];

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

  const prtg = new prtg_api({
    host: process.env.PRTG_HOST,
    port: process.env.PRTG_PORT,
    user: process.env.PRTG_USER,
    hash: process.env.PRTG_HASH,
  });

  await egsv_rtms.auth();
  await egsv_sko.auth();

  // const res1 = await egsv.method("taxonomy.list", { limit: 250 });
  // let taxonomies = {};
  // res1.taxonomies.forEach(el => taxonomies[el.id] = el.name);

  // const res2 = await egsv.method("camera.list", { limit: 250 });
  // const arr = res2.cameras.map(el => { 
  //   const new_name = taxonomies[el.taxonomies[0]];
  //   return { id: el.id, name: new_name, url: el.url, server: el.server, account: el.account };
  // });

  // for (const data of arr) {
  //   const res = await egsv.method("camera.update", { camera: data });
  //   //console.log(res);
  //   //break;
  // }
  // console.log("done");

  // const ret = await zabbix_aqt.method("host.get", { groupids: [36] });
  // const hostids = ret.map(el => el.hostid);
  // const oldnames = ret.map(el => { return { id: el.hostid, name: el.name } } );
  // const ret1 = await zabbix_aqt.method("hostinterface.get", { hostids: hostids });
  // let host_ip_obj = {};
  // ret1.forEach(el => { host_ip_obj[el.ip] = el.hostid; });
  // //console.log(ret1);
  // // for (const n of oldnames) {
  // //   const r = await zabbix_aqt.method("usermacro.create", {
  // //     hostid: n.id,
  // //     macro: "{$OLDNAME}",
  // //     value: n.name
  // //   });
  // // }

  // const ret2 = await egsv.method("rtms.report.list", {
  //   filter: {
  //     datetime: {
  //       $gte: "2024-08-12T00:00:00+05:00",
  //       $lte: "2024-08-15T23:59:59+05:00"
  //     }
  //   },
  //   group: { hour: false },
  //   include: ['cameras', 'last_datetimes'],
  //   //violations: ['speed']
  // });

  // let camera_ip_obj = {};
  // ret2.cameras.forEach(el => {
  //   const u = new URL(el.url);
  //   camera_ip_obj[u.hostname] = el;
  // });

  // //console.log(host_ip_obj);
  // //console.log(camera_ip_obj);

  // let final_arr = [];
  // for (const [ ip, hostid ] of Object.entries(host_ip_obj)) {
  //   const c = camera_ip_obj[ip];
    
  //   final_arr.push({ hostid, name: c.name });
  // }

  // //console.log(final_arr);
  // for (const n of final_arr) {
  //   const ret = await zabbix_aqt.method("host.update", {
  //     hostid: n.hostid,
  //     name: n.name
  //   });
  // }

  // //console.log(ret);

  // let arr_p = [];
  // for (let camera of ret.cameras) {
  //   camera.nump = egsv.method("rtms.number.list", {
  //     filter: {
  //       datetime: {
  //         $gte: "2024-08-12T00:00:00+05:00",
  //         $lte: "2024-08-15T23:59:59+05:00"
  //       },
  //       camera: { $in: [ camera.id ] },
  //       violation: { $in: [ "speed" ] }
  //     },
  //     include: ['files', 'cameras', 'certificate', 'metadata'],
  //     limit: 1
  //   });

  //   arr_p.push(camera.nump);
  // }

  // const arr_ans = await Promise.all(arr_p);
  // let proxy_data_arr = [];
  // for (const camera of ret.cameras) {
  //   const ans = await camera.nump;
  //   if (ans.numbers.length === 0) {
  //     console.log(camera.data.description, camera.name);
  //     continue;
  //   }

  //   const proxy_data = {
  //     camera_id: camera.id,
  //     camera_name: camera.name,
  //     camera_address: camera.name.split(" ").slice(1).join(" "),
  //     origin_name: ans.numbers[0].origin_name,
  //     origin_serial_number: ans.numbers[0].origin_serial_number,
  //     origin_address: ans.numbers[0].origin_address,
  //     certificate_number: ans.numbers[0].certificate_number,
  //     certificate_issue_date: ans.numbers[0].certificate_issue_date,
  //     certificate_expire_date: ans.numbers[0].certificate_expire_date,
  //     certificate_issuer: ans.numbers[0].certificate_issuer,
  //   };
  //   proxy_data_arr.push(proxy_data);
  // }

  // proxy_data_arr.sort((a,b) => strcmp(a.camera_name, b.camera_name));

  // //console.log(proxy_data_arr);

  // //let insert_str = "INSERT INTO device (cameraName, deviceNumber, districtCode, sourceId, autoApprove, address, lane, certificateNumber, certificateIssueDate, certificateExpireDate) VALUES\n";
  // let insert_str = "";
  // let values_strs = [];
  // for (const data of proxy_data_arr) {
  //   //const local = `\n('${data.origin_name}', '${data.origin_serial_number}', 191510, 152, 0, '${mysql_real_escape_string(data.camera_name)}', 0, '${data.certificate_number}', '${data.certificate_issue_date}', '${data.certificate_expire_date}')`;
  //   let local = `ALTER TABLE violation UPDATE locationTitle = '${mysql_real_escape_string(data.camera_name)}' WHERE (eventDateTime > toDateTime('2024-08-16 00:00:00', 'Asia/Aqtau')) AND (lvsSource = '${data.origin_serial_number}');`;

  //   values_strs.push(local);
  // }

  // const final_str = `${insert_str} ${values_strs.join("\n")};`;
  // console.log(final_str);
  // fs.writeFileSync("ins.sql", final_str);

  // const f_err = async function (severity) {
  //   const problems = await zabbix_akm.method("problem.get", {
  //     groupids: [ 148 ], //147
  //     severities: [ severity ]
  //   });

  //   //console.log("problems.length", problems.length);
  //   const event_ids = problems.map(el => el.eventid);
  //   const events = await zabbix_akm.method("event.get", { 
  //     eventids: event_ids,
  //     severities: [ severity ],
  //     selectHosts: "extend",
  //   });

  //   const host_ids_arr = events.map(el => el.hosts.map(el1 => el1.hostid));
  //   const host_ids = [].concat.apply([], host_ids_arr);
  //   const hosts = await zabbix_akm.method("host.get", { hostids: host_ids, selectInterfaces: "extend", selectTags: "extend" });

  //   //console.log(hosts);
  //   const arr_not_working = hosts.map(el => {
  //     return {
  //       name: el.name,
  //       ip: el.interfaces[0].ip,
  //       hostid: el.hostid,
  //       tags: el.tags
  //     };
  //   });
  //   arr_not_working.sort((a,b) => strcmp(a.name, b.name));
  //   return arr_not_working;
  // }

  // // //console.log(arr_not_working);

  // const errs = await f_err(4);
  // let arr_not_working_xlsx = [ [ "Номер", "Имя", "IP адрес", "Тип" ] ];
  // //console.log(errs[0].tags);
  // errs.forEach(el => arr_not_working_xlsx.push([ el.name.split(" ")[0], el.name.split(" ").slice(1).join(" "), el.ip, el.tags.filter(t => t.tag === "type")[0]?.value ]));

  // const oks = await f_err(0);
  // let arr_working_xlsx = [ [ "Номер", "Имя", "IP адрес", "Тип" ] ];
  // oks.forEach(el => arr_working_xlsx.push([ el.name.split(" ")[0], el.name.split(" ").slice(1).join(" "), el.ip, el.tags.filter(t => t.tag === "type")[0]?.value ]));

  // let all_devices = [];
  // oks.forEach(el => all_devices.push([ el.name.split(" ")[0], el.name.split(" ").slice(1).join(" "), el.ip, el.tags.filter(t => t.tag === "type")[0]?.value, "Работает" ]));
  // errs.forEach(el => all_devices.push([ el.name.split(" ")[0], el.name.split(" ").slice(1).join(" "), el.ip, el.tags.filter(t => t.tag === "type")[0]?.value, "Не работает" ]));
  // let schools_info = {};
  // all_devices.forEach(el => {
  //   let name = el[1].trim();
  //   if (name.includes("BUTTON STRAZH")) name = name.split(" ").slice(0, -3).join(" ");
  //   else name = name.split(" ").slice(0, -2).join(" ");
  //   if (!schools_info[el[0]]) schools_info[el[0]] = { name: "", working: 0, not_working: 0 };
  //   schools_info[el[0]].name = name;
  //   schools_info[el[0]].working += el[4] === "Работает";
  //   schools_info[el[0]].not_working += el[4] === "Не работает";
  // });
  // all_devices.sort((a,b) => strcmp(a[0], b[0]));
  // all_devices.unshift([ "Номер", "Имя", "IP адрес", "Тип", "Статус" ]);

  // let schools_list = Object.entries(schools_info).map((el) => [ el[0], el[1].name, el[1].working, el[1].not_working, el[1].working + el[1].not_working ]);
  // schools_list.sort((a,b) => strcmp(a[0], b[0]));
  // schools_list.unshift([ "Номер", "Имя", "Работает", "Не работает", "Всего" ]);

  // //console.log("errs.length", errs.length, "oks.length", oks.length);
  // const buffer = xlsx.build([{ name: 'Общая', data: all_devices }, { name: 'Работает', data: arr_working_xlsx }, { name: 'Не работает', data: arr_not_working_xlsx }, { name: "По школам", data: schools_list }]);
  // fs.writeFileSync("80_obj.xlsx", buffer);

  // кукис нужно получить сначала
  // const folder_path = "./aqtobe_icmp_images";
  // const last_amount_time = "2d";
  // const ret = await zabbix_aqt.method("graph.get", { groupids: [ 36 ], selectHosts: "extend" });
  // const ping_arr = ret.filter(el => el.name.indexOf("g1") >= 0);
  // //console.log(ping_arr);
  // //console.log(ping_arr.length);
  // for (const graph of ping_arr) {
  //   const name = graph.hosts[0].name.replaceAll(/[:\/\\]/g, "_");
  //   const image_graph_url = `http://10.4.1.49/chart2.php?graphid=${graph.graphid}&from=now-${last_amount_time}&to=now&height=201&width=1335&profileIdx=web.charts.filter&_=wsesoro0`;
  //   const img_ret = await axios.get(image_graph_url, { headers: { 'Cookie': 'zbx_session=eyJzZXNzaW9uaWQiOiJiNTMwYTI5ZDA2N2QzYTM0NjE4ZmY0ZmNjMmU3OWI2OSIsInNlcnZlckNoZWNrUmVzdWx0Ijp0cnVlLCJzZXJ2ZXJDaGVja1RpbWUiOjE3MjQ2Nzg1MjksInNpZ24iOiI4N2NhYWE3ODVhMzIxZWNkMjU0Yjc5MjkzMjI1YmM2MTdhYTFjMDY1ZjE4YzJiMDFkMzZmOTkxZWNiMmIwYzRkIn0%3D' }, 'withCredentials': 'true', responseType: "arraybuffer" });
  //   if (!fs.existsSync(folder_path)) fs.mkdirSync(folder_path);
  //   const file_path = `${folder_path}/${name}.png`;
  //   fs.writeFileSync(file_path, img_ret.data);
  // }

  // const make_good_num = num => num < 10 ? "0"+num : ""+num;
  // function make_sane_time_string(date) {
  //   const final_date = new Date(date);
  //   const y = final_date.getFullYear();
  //   const m = make_good_num(final_date.getMonth()+1);
  //   const d = make_good_num(final_date.getDate());
  //   const H = make_good_num(final_date.getHours());
  //   const M = make_good_num(final_date.getMinutes());
  //   const S = make_good_num(final_date.getSeconds());
  //   return `${y}-${m}-${d} ${H}:${M}:${S}`;
  // }

  // const time_arr = [ 
  //   [ "14:00", "14:15" ], [ "14:15", "14:30" ], [ "14:30", "14:45" ], [ "14:45", "15:00" ],
  //   [ "00:00", "00:15" ], [ "00:15", "00:30" ], [ "00:30", "00:45" ], [ "00:45", "01:00" ],
  //   [ "06:30", "06:45" ], [ "06:45", "07:00" ], [ "07:00", "07:15" ], [ "07:15", "07:30" ],
  // ];
  // let xlsx_data = [ [ "Скоростемер", "Время", "Рапознанный номер", "Фактический номер", "Чем отличается" ] ];
  // let counter = 0;
  // for (const [ start, end ] of time_arr) {
  //   let date = "2024-09-16";
  //   if (counter >= 4) date = "2024-09-17";

  //   //console.log(`${date} ${start}:00`);
  //   //console.log(`${date} ${end}:00`);

  //   const p = await egsv_sko.method("rtms.number.list", {
  //     filter: {
  //       datetime: {
  //         $gte: `${date} ${start}:00`,
  //         $lte: `${date} ${end}:00`
  //       },
  //       camera: { $in: [ "635a8654fb8d0eee3d73b8f3" ] }
  //     },
  //     limit: 1000000,
  //     sort: { datetime: 'asc' }
  //     //include: [ 'cameras', 'last_datetimes' ]
  //   });

  //   //console.log(p);
  //   for (const n of p.numbers) {
  //     xlsx_data.push([ "MLS07120827", make_sane_time_string(n.datetime), n.plate_number, "", "" ]);
  //   }

  //   counter+=1;
  // }

  // const buffer = xlsx.build([{ name: 'лист', data: xlsx_data }]);
  // fs.writeFileSync("speed_numbers.xlsx", buffer);

  // const cont = fs.readFileSync("zabbix_groups.json");
  // //const taxes = JSON.parse(cont);
  // //let xlsx_arr = [];
  // const groups = JSON.parse(cont);
  // const excel = xlsx.parse("cameras.xlsx");
  // for (const row of excel[3].data) {
  //   let [ name, router_address ] = [ row[7], row[8] ];
  //   if (!(subnet.is_ip_address(router_address) || subnet.is_subnet_address(router_address))) continue;
  //   if (!name || typeof name !== "string" || name === "") continue;
  //   if (router_address.indexOf("/24") !== -1) continue;
  //   if (router_address.indexOf("/28") === -1) router_address = router_address+"/28";
  //   const net = new subnet(router_address);
  //   let router = net.ip_num + 1;
  //   let ptz = router + 1;
  //   let cam01 = router + 2;
  //   let cam02 = router + 3;

  //   const router_addr = subnet.num_to_ip(router);
  //   const ptz_address = subnet.num_to_ip(ptz);
  //   const cam01_address = subnet.num_to_ip(cam01);
  //   const cam02_address = subnet.num_to_ip(cam02);

  //   console.log(name, ptz_address, cam01_address, cam02_address);
  //   // над короч в базовом виде виимо добавить, а потом исправить и взять уже нормальные адреса

  //   // тут нужно создать группы камер + сами камеры к этим группам
  //   //const ret = await egsv.method("taxonomy.create", {
  //   //  taxonomy: {
  //   //    name: name,
  //   //    parent: "66ebf363ac02e80330a6340a"
  //   //  }
  //   //});

  //   //taxes[ret.taxonomy.name] = ret.taxonomy.id;

  //   //const tax_id = taxes[name];
  //   //if (!tax_id) throw `Could not find tax '${name}'`;

  //   //const cam01_link01 = `rtsp://admin:adm12345@${ptz_address}:554/ISAPI/Streaming/Channels/101`;
  //   //const cam01_link02 = `rtsp://admin:adm12345@${ptz_address}:554/ISAPI/Streaming/Channels/102`;
  //   //const cam02_link01 = `rtsp://admin:adm12345@${cam01_address}:554/ISAPI/Streaming/Channels/101`;
  //   //const cam02_link02 = `rtsp://admin:adm12345@${cam01_address}:554/ISAPI/Streaming/Channels/102`;
  //   //const cam03_link01 = `rtsp://admin:adm12345@${cam02_address}:554/ISAPI/Streaming/Channels/101`;
  //   //const cam03_link02 = `rtsp://admin:adm12345@${cam02_address}:554/ISAPI/Streaming/Channels/102`;

  //   //xlsx_arr.push([ `${router_address}_cam01`, name, cam01_link01, cam01_link02, tax_id ]);
  //   //xlsx_arr.push([ `${router_address}_cam02`, name, cam02_link01, cam02_link02, tax_id ]);
  //   //xlsx_arr.push([ `${router_address}_cam03`, name, cam03_link01, cam03_link02, tax_id ]);

  //   //const ret = await zabbix_aqt.method("hostgroup.create", { name: `ОВН/${name}` });
  //   //groups[name] = ret.groupids[0];

  //   const gid = groups[name];

  //   try {
  //     const ret1 = await zabbix_aqt.method("host.create", {
  //       "host": `${router_addr} router`,
  //       "name": `ОВН / ${name} | router`,
  //       "interfaces": [
  //         {
  //           "type": 2,
  //           "main": 1,
  //           "useip": 1,
  //           "ip": router_addr,
  //           "dns": "",
  //           "port": "161"
  //         }
  //       ],
  //       "groups": [
  //         {
  //           "groupid": gid
  //         }
  //       ],
  //       "tags": [
  //         {
  //           "tag": "subnet",
  //           "value": router_address
  //         }
  //       ],
  //     });
  //   } catch (e) {
  //     console.log(`'${router_addr} router' exists`);
  //   }

  //   try {
  //   const ret2 = await zabbix_aqt.method("host.create", {
  //     "host": `${ptz_address} cam01`,
  //     "name": `ОВН / ${name} | cam01`,
  //     "interfaces": [
  //       {
  //         "type": 2,
  //         "main": 1,
  //         "useip": 1,
  //         "ip": ptz_address,
  //         "dns": "",
  //         "port": "161"
  //       }
  //     ],
  //     "groups": [
  //       {
  //         "groupid": gid
  //       }
  //     ],
  //     "tags": [
  //       {
  //         "tag": "subnet",
  //         "value": router_address
  //       }
  //     ],
  //     "macros": [
  //       {
  //         "macro": "{$ADMINUSER}",
  //         "value": "admin"
  //       },
  //       {
  //         "macro": "{$ADMINPASS}",
  //         "value": "adm12345"
  //       }
  //     ]
  //   });
  //   } catch (e) {
  //     console.log(`'${ptz_address} cam01' exists`);
  //   }

  //   try {
  //   const ret3 = await zabbix_aqt.method("host.create", {
  //     "host": `${cam01_address} cam02`,
  //     "name": `ОВН / ${name} | cam02`,
  //     "interfaces": [
  //       {
  //         "type": 2,
  //         "main": 1,
  //         "useip": 1,
  //         "ip": cam01_address,
  //         "dns": "",
  //         "port": "161"
  //       }
  //     ],
  //     "groups": [
  //       {
  //         "groupid": gid
  //       }
  //     ],
  //     "tags": [
  //       {
  //         "tag": "subnet",
  //         "value": router_address
  //       }
  //     ],
  //     "macros": [
  //       {
  //         "macro": "{$ADMINUSER}",
  //         "value": "admin"
  //       },
  //       {
  //         "macro": "{$ADMINPASS}",
  //         "value": "adm12345"
  //       }
  //     ]
  //   });
  //   } catch (e) {
  //     console.log(`'${cam01_address} cam02' exists`);
  //   }

  //   try {
  //   const ret4 = await zabbix_aqt.method("host.create", {
  //     "host": `${cam02_address} cam03`,
  //     "name": `ОВН / ${name} | cam03`,
  //     "interfaces": [
  //       {
  //         "type": 2,
  //         "main": 1,
  //         "useip": 1,
  //         "ip": cam02_address,
  //         "dns": "",
  //         "port": "161"
  //       }
  //     ],
  //     "groups": [
  //       {
  //         "groupid": gid
  //       }
  //     ],
  //     "tags": [
  //       {
  //         "tag": "subnet",
  //         "value": router_address
  //       }
  //     ],
  //     "macros": [
  //       {
  //         "macro": "{$ADMINUSER}",
  //         "value": "admin"
  //       },
  //       {
  //         "macro": "{$ADMINPASS}",
  //         "value": "adm12345"
  //       }
  //     ]
  //   });
  //   } catch (e) {
  //     console.log(`'${cam02_address} cam03' exists`);
  //   }
  // }

  //fs.writeFileSync("taxonomies.json", JSON.stringify(taxes));
  //const xlsx_cont = xlsx.build([{ name: "list", data: xlsx_arr }]);
  //fs.writeFileSync("cam_d.xlsx", xlsx_cont);
  //fs.writeFileSync("zabbix_groups.json", JSON.stringify(groups));

  // заново добавим OVN

  // let ret = await egsv_rtms.method("camera.list", {
  //   "can": [
  //     "view",
  //     "update",
  //     "delete",
  //   ],
  //   "include": [
  //     "computed",
  //     "account",
  //     "server"
  //   ],
  //   "limit": 100000,
  //   "sort": {
  //     "name": "asc"
  //   },
  //   "filter": {
  //     "_taxonomies": {
  //       "$in": [ "66ebf363ac02e80330a6340a" ]
  //     }
  //   }
  // });

  // //console.log(ret.cameras[0]);
  // //console.log(ret.cameras.length);

  // ret.cameras = ret.cameras.sort((a,b) => strcmp(a.name,b.name));

  // let unique_ip = {};
  // let unique_group = {};
  // let unique_group_name = {};

  // let arr = [];
  // for (const cam of ret.cameras) {
  //   const host = new URL(cam.url).hostname.trim();
  //   const group = cam.name.trim().split(".")[0].trim();
  //   const type = cam.name.trim().split(".")[1].trim();
  //   const group_name = cam.data.description.trim();
  //   const egsv_id = cam.id;
  //   const latlng_str = (cam.latlng[0] ? cam.latlng[0] + "," + cam.latlng[1] : "").trim();
  //   const local_str = `${group} ${type} ${host} ${group_name} ${latlng_str}`;
  //   //console.log(latlng_str);
  //   //console.log(local_str);

  //   arr.push({
  //     group,
  //     type,
  //     host,
  //     group_name,
  //     latlng_str,
  //     egsv_id
  //   });

  //   if (unique_ip[host]) {
  //     console.log(`IP collision ${host}`);
  //   }

  //   if (unique_group[group] && unique_group[group] !== group_name) {
  //     console.log(`Name mismatch ${group} ${group_name}`);
  //   }

  //   if (unique_group_name[group_name] && unique_group_name[group_name] !== group) {
  //     console.log(`Group mismatch ${group_name} ${group}`);
  //   }

  //   if (!unique_ip[host]) unique_ip[host] = true;
  //   if (!unique_group[group]) unique_group[group] = group_name;
  //   if (!unique_group_name[group_name]) unique_group_name[group_name] = group;
  // }

  // let created_group = {};
  // const start = 0;
  // for (let i = start; i < arr.length; ++i) {
  //   const data = arr[i];
  //   const z_group_name = `${data.group} ${data.group_name}`;
  //   if (!created_group[z_group_name]) {
  //     const ret = await zabbix_aqt.method("hostgroup.create", { name: `ОВН/${z_group_name}` });
  //     created_group[z_group_name] = ret.groupids[0];
  //   }

  //   if (!created_group[z_group_name]) {
  //     throw `Could not find group ${z_group_name}`;
  //   }

  //   const short_group_name = data.group_name.substring(0, 20);

  //   const ret = await zabbix_aqt.method("host.create", {
  //     "host": `${data.group} ${data.type} ${data.host}`,
  //     "name": `${data.group} ${data.type} ${data.host}`, // ${short_group_name} 
  //     "interfaces": [
  //       {
  //         "type": 2,
  //         "main": 1,
  //         "useip": 1,
  //         "ip": data.host,
  //         "dns": "",
  //         "port": "161",
  //         "details": {
  //           version: 2,
  //           community: "public"
  //         }
  //       }
  //     ],
  //     "groups": [
  //       {
  //         "groupid": created_group[z_group_name]
  //       }
  //     ],
  //     "tags": [
  //       {
  //         "tag": "type",
  //         "value": data.type
  //       },
  //       {
  //         "tag": "group",
  //         "value": data.group
  //       }
  //     ],
  //     "macros": [
  //       {
  //         "macro": "{$EGSVID}",
  //         "value": data.egsv_id
  //       },
  //       {
  //         "macro": "{$LATLNGSTR}",
  //         "value": data.latlng_str
  //       }
  //     ]
  //   });

  //   console.log(i, ret);

  //   //break;
  // }

  // const make_hikvision_str = function(address) {
  //   return [
  //     `rtsp://user:stream2024@${address}:554/Streaming/channels/101`,
  //     `rtsp://user:stream2024@${address}:554/Streaming/channels/102`
  //   ];
  // }

  // let arr = [ [ "name", "desc", "url1", "url2", "archive", "days", "", "group", "type", "folder" ] ];
  // let excel = xlsx.parse("reparse2.xlsx");
  // for (let i = 1; i < excel[0].data.length; ++i) {
  //   const row = excel[0].data[i];
  //   const type = row[2];
  //   const name = row[3];
  //   const phys_addr = row[4];
  //   const group = row[1];
  //   const groupid = row[8];
  //   const addr = row[5];
  //   const folder = row[6];

  //   if (type === "router") continue;

  //   const [ link1, link2 ] = make_hikvision_str(addr);
  //   arr.push([ name, phys_addr, link1, link2, "true", 30, "", group, type, folder ]);
  // }

  // const buffer = xlsx.build([{ name: "лист", data: arr }]);
  // fs.writeFileSync("egsv_data.xlsx", buffer);

  // const ret = await zabbix_aqt.method("hostgroup.get", {
  //   output: "extend",
  //   search: {
  //     name: [ "ОВН/" ]
  //   }
  // });

  // //console.log(ret);
  // let group_map_id = {};
  // ret.forEach(el => {
  //   const fname = el.name.split("/").slice(1).join("/").split(" ").slice(0, 1).join(" ");
  //   group_map_id[fname] = el.groupid;
  // });

  // excel[0].data.forEach(row => {
  //   if (!row[7] || row[7] === "group_name") { row.push("group_id"); return; }

  //   const group = row[1];
  //   const id = group_map_id[group];
  //   const id_str =  ""+id;
  //   row.push(id_str);
  // });

  // const buffer = xlsx.build(excel);
  // fs.writeFileSync("reparse2.xlsx", buffer);

  // const ignore = {
  //   "OVN0009": true,
  // };

  // let excel = xlsx.parse("reparse2.xlsx");
  // for (let i = 1049; i < excel[0].data.length; ++i) {
  //   const row = excel[0].data[i];
  //   if (row[8] !== "undefined") continue;
  //   if (row[1] === "OVN07") continue;
  //   if (row[2] !== "router") continue;
  //   if (ignore[row[1]]) continue;

  //   const group_name = "ОВН/"+row[7];
  //   console.log(group_name);
  //   const ret = await zabbix_aqt.method("hostgroup.create", { name: group_name });
  //   row[7] = ret.groupids[0];
  // }
  // const buffer = xlsx.build(excel);
  // fs.writeFileSync("reparse2.xlsx", buffer);

  // const hostgroup_ret = await zabbix_aqt.method("hostgroup.get", {
  //   output: "extend",
  //   search: {
  //     name: [ "ОВН/" ]
  //   }
  // });

  // const hostgroups_id = hostgroup_ret.map(el => el.groupid);
  // const host_ret = await zabbix_aqt.method("host.get", {
  //   groupids: hostgroups_id,
  //   output: "extend",
  //   selectInterfaces: "extend", 
  // });

  // let arr = host_ret.map(el => {
  //   const group = el.name.split(" ").slice(0, 1).join(" ");
  //   let type = el.name.split(" ").slice(1, 2).join(" ");
  //   if (type.startsWith("FIX")) type = "FIX";
  //   const group_addr = el.name.split(" ").slice(2).join(" ");
  //   return [ group, type, group_addr, el.interfaces[0].ip ];
  // });
  // arr.unshift([ "group", "type", "phys_addr", "addr" ]);

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
        $in: ['66ebf363ac02e80330a6340a', '672b0ca9177a0766a6bc8ebd', '673af1673bd57a9f74abd5b9', '678df1c5f3fe4b19014b5507', '679723ab0ad8f8dca0ee5191', '67a209f30ad8f8dca076a6d2', '6784dcf2d8c2d0cc93438f7d', '67a337b60ad8f8dca0c7bb03']
      }
    }
  });

  let arr = ret.cameras.map(el => {
    const group = el.name.split(".").slice(0, 1).join(" ");
    let type = el.name.split(".").slice(1, 2).join(" ");
    if (type.startsWith("FIX")) type = "FIX";
    const group_addr = el.data.description;
    const ip = new URL(el.url).hostname;
    //console.log([ group, type, group_addr, ip ]);
    return [ group, type, group_addr, ip ];
  });
  arr.unshift([ "group", "type", "phys_addr", "addr" ]);

  const buffer = xlsx.build([{ name: "list", data: arr }]);
  fs.writeFileSync("2025.02.07 egsv_ovn_zabbix.xlsx", buffer);

  // //console.log(host_ret[0]);
  // let unique_host = {};
  // host_ret.forEach(el => {
  //   const name = el.host.split(" ").slice(0, -1).join(" ");
  //   if (name === "") return;
  //   if (unique_host[name]) {
  //     //console.log(unique_host[name]+" collision "+el.host);
  //     return;
  //   }

  //   unique_host[name] = el.hostid;
  // });

  // let excel = xlsx.parse("reparse2.xlsx");
  // for (let i = 0; i < excel[0].data.length; ++i) {
  //   const row = excel[0].data[i];
  //   if (!row[7] || row[7] === "group_name") { row.push("host_id"); continue; }

  //   const find_host = row[3] || row[3] !== "" ? row[3].split(".").join(" ") : "";
  //   const id = unique_host[find_host];
  //   const id_str = ""+id;
  //   excel[0].data[i].push(id_str);
  // }

  // const buffer = xlsx.build(excel);
  // fs.writeFileSync("reparse2.xlsx", buffer);

  // const human_groups = {
  //   "2 этап - 240": 615,
  //   "3 этап - 513": 682,
  //   "4 этап - 215": 684,
  //   "4 этап": 684,
  //   "5 этап - 458": 1077,
  //   "6 этап": 1078,
  //   "6 этап - 641": 1078,
  // };

  // const ignore = {
  //   "OVN0001": true,
  //   "OVN0174": true,
  //   "OVN0277": true,
  //   "OVN0297": true,
  //   "OVN0390": true,
  //   "OVN07": true,

  // };
  // const excel = xlsx.parse("reparse2.xlsx");
  // for (let i = 3005; i < excel[0].data.length; ++i) {
  //   const row = excel[0].data[i];
  //   if (!row[7] || row[7] === "host_id") continue;
  //   if (ignore[row[1]]) continue;
  //   const hostid = row[9];
  //   if (hostid !== "undefined") continue;


  //   const type = row[2];
  //   const group = row[1];
  //   const groupid = row[8];
  //   const addr = row[5];
  //   const folder = row[6];
  //   if (folder === "ДУБЛЬ") continue;
  //   if (folder === "РУБЕЖ") continue;

  //   const human_groupid = human_groups[folder];
  //   if (!human_groupid) throw `Could not find folder '${folder}' on line ${i}`;

  //   const short_name = (!row[3] || row[3] === "" ? group + " ROUTER" : row[3].split(".").join(" "));
  //   const zabbix_name = (short_name + " " + row[4]).slice(0, 120);
  //   const zabbix_host = short_name + " " + row[5];
  //   let groups = [ { "groupid": groupid }, { "groupid": 121 } ];
  //   if (type !== "router") {
  //     groups.push({ "groupid": human_groupid });
  //   } else {
  //     groups.push({ "groupid": 1080 });
  //   }

  //   console.log(i, zabbix_name);
  //   const ret = await zabbix_aqt.method("host.create", {
  //     "host": zabbix_host,
  //     "name": zabbix_name,
  //     "interfaces": [
  //       {
  //         "type": 2,
  //         "main": 1,
  //         "useip": 1,
  //         "ip": addr,
  //         "dns": "",
  //         "port": "161",
  //         "details": {
  //           version: 2,
  //           community: "public"
  //         }
  //       }
  //     ],
  //     "groups": groups,
  //     "tags": [
  //       { "tag": "type", "value": type },
  //       { "tag": "group", "value": group }
  //     ],
  //     "templates": [
  //       { "templateid": 10564 }
  //     ]
  //   });
  // }
})();