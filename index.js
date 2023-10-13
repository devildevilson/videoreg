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

let xlsx_data = [
  [ "№ объекта", "Описание", "IP", "Тип устройства", "Модель устройства", "Производитель" ]
];

(async () => {
  const egsv = new egsv_api({
    host: process.env.EGSV_HOST,
    port: process.env.EGSV_PORT,
    user: process.env.EGSV_USER,
    pass: process.env.EGSV_PASS
  });

  const prtg = new prtg_api({
    host: process.env.PRTG_HOST,
    port: process.env.PRTG_PORT,
    user: process.env.PRTG_USER,
    hash: process.env.PRTG_HASH,
  });

  //const new_group_id = await prtg.add_group(1, "Тест группа (удалить)");
  //console.log(new_group_id);
  //await prtg.delete_object(3917);

  //const groups = await prtg.get_child_groups(2520);
  //console.log(groups);

  //const devices = await prtg.get_child_devices(2526);
  //console.log(devices);

  //const sensors = await prtg.get_child_sensors(2529);
  //console.log(sensors);
  

  //const cams_list = await egsv.camera_list();
  //const prtg_list = await prtg.sensors_tree();

  //console.log(prtg_list);
  //console.log(prtg_list.sensortree.nodes.group.probenode.group["6"].group["1"].device);

  //console.log("count:", cams_list.count);
  //console.log(cams_list);
  //console.log(cams_list.cameras[1]);

  //const cam_url = new URL(cams_list.cameras[0].url);
  //console.log(cam_url);

  // надо сделать так чтобы среди всех производителей АПИ был максимально одинаковым + указать какой тип камеры

  {
    //const dev_url = new URL(cams_list.cameras[0].url);
    // const device = new dahua({
    //   host: "10.0.114.131",
    //   port: 80,
    //   user: "admin",
    //   pass: "qwerty12345"
    // });

    //const ret1 = await device.get_channel_title();
    //const ret2 = await device.get_system_info();
    //const ret1 = await device.get_caps(1);
    //const ret1 = await device.get_device_type();
    //console.log(ret1);
    //console.log(ret2.data);
  }

  // {
  //   //const dev_url = new URL(cams_list.cameras[0].url);
  //   const device = new trassir({
  //     host: "10.29.20.194",
  //     port: 8080,
  //     user: "aqmol",
  //     pass: "aqmol12345" // это пароль для специального пользователя, только его достаточно
  //   });

  //   //await device.login();
  //   //console.log(device.sid);
  //   const ret = await device.objects();
  //   console.log(ret);
  // }  

  {
    //const dev_url = new URL(cams_list.cameras[0].url);
    //http://10.29.2.2/ISAPI/Streaming/channels/101/picture
    // const device = new dahua({
    //   host: "10.29.21.3",
    //   port: 80,
    //   user: "aqmol",
    //   pass: "aqmol12345"
    // });

    //const ret1 = await device.device_info(101);
    //console.log(ret1);
    // const date_str = make_current_day_str();
    // const buffer = ret1;
    // fs.writeFile(`pic1_${date_str}.jpg`, buffer, err => {
    //   if (err) { console.error(err); return; }
    //   console.log(`Success computing`);
    // });
  }

  // {
  //   //const dev_url = new URL(cams_list.cameras[0].url);
  //   //http://10.29.2.2/ISAPI/Streaming/channels/101/picture
  //   const device = new hikvision({
  //     host: "10.29.2.2",
  //     port: 80,
  //     user: "aqmol",
  //     pass: "aqmol12345"
  //   });

  //   const ret1 = await device.picture(101);
  //   const date_str = make_current_day_str();
  //   const buffer = ret1;
  //   fs.writeFile(`pic2_${date_str}.jpg`, buffer, err => {
  //     if (err) { console.error(err); return; }
  //     console.log(`Success computing`);
  //   });
  // }

  {
    //const dev_url = new URL(cams_list.cameras[0].url);
    //http://10.29.2.2/ISAPI/Streaming/channels/101/picture
    // const device = new trassir({
    //   host: "10.29.20.194",
    //   port: 8080,
    //   user: "aqmol",
    //   pass: "aqmol12345"
    // });

    // const ret1 = await device.object_data(201);
    // console.log(ret1);
    // const date_str = make_current_day_str();
    // const buffer = ret1;
    // fs.writeFile(`pic3_${date_str}.jpg`, buffer, err => {
    //   if (err) { console.error(err); return; }
    //   console.log(`Success computing`);
    // });
  }

  // let unique_device = new Set();
  // let dahua_promises = [];
  // let hikvision_promises = [];
  // let url_data = [];
  // for (const dev of cams_list.cameras) {
  //   const dev_url = new URL(dev.url);
  //   if (unique_device.has(dev_url.hostname)) continue;
  //   unique_device.add(dev_url.hostname);

  //   const code1_promise = device_is_dahua(dev_url);
  //   const code2_promise = device_is_hikvision(dev_url);
  //   dahua_promises.push(code1_promise);
  //   hikvision_promises.push(code2_promise);
  //   const desc = dev.data ? dev.data.description : "";
  //   url_data.push({ dev_url, name: dev.name, desc });
  // }

  // const dahua_codes = await Promise.all(dahua_promises);
  // const hikvision_codes = await Promise.all(hikvision_promises);
  // //assert(dahua_codes.length === hikvision_codes.length);
  // console.log(dahua_codes.length);

  // let dahua_counter = 0;
  // let hikvision_counter = 0;
  // let dev_types = [];
  // for (let i = 0; i < dahua_codes.length; ++i) {
  //   const { dev_url, name, desc } = url_data[i];
  //   const obj_num = name.split("_")[0];

  //   let valid_code = {};
  //   let device_vendor = "";
  //   if (dahua_codes[i].status.code === 200) {
  //     dahua_counter += 1;
  //     valid_code = dahua_codes[i];
  //     device_vendor = "dahua";
  //   } else if (hikvision_codes[i].status.code === 200) {
  //     hikvision_counter += 1;
  //     valid_code = hikvision_codes[i];
  //     device_vendor = "hikvision";
  //   } else {
  //     const dahua_str_code = `${dahua_codes[i].status.code} ${dahua_codes[i].status.desc}`;
  //     const hikvision_str_code = `${hikvision_codes[i].status.code} ${hikvision_codes[i].status.desc}`;
  //     xlsx_data.push([ obj_num, desc, dev_url.hostname, dahua_str_code, hikvision_str_code, "" ]);
  //     continue;
  //   }

  //   xlsx_data.push([ obj_num, desc, dev_url.hostname, valid_code.data.type, valid_code.data.model, device_vendor ]);
  // }

  // // let dahua_counter = 0;
  // // let hikvision_counter = 0;
  // // let dev_types = [];
  // // for (let i = 0; i < dahua_codes.length; ++i) {
  // //   const { dev_url, name, desc } = url_data[i];
  // //   const obj_num = name.split("_")[0];

  // //   if (dahua_codes[i].status.code === 200) {
  // //     dev_types.push({
  // //       device: new dahua({
  // //         host: dev_url.hostname,
  // //         port: 80,
  // //         user: dev_url.username,
  // //         pass: dev_url.password
  // //       }),
  // //       type: "dahua",
  // //       data: dahua_codes[i].data,
  // //       name: obj_num,
  // //       desc
  // //     });

  // //     dahua_counter += 1;
  // //     continue;
  // //   }

  // //   if (hikvision_codes[i].status.code === 200) {
  // //     dev_types.push({
  // //       device: new hikvision({
  // //         host: dev_url.hostname,
  // //         port: 80,
  // //         user: dev_url.username,
  // //         pass: dev_url.password
  // //       }),
  // //       type: "hikvision",
  // //       data: hikvision_codes[i].data,
  // //       name: obj_num,
  // //       desc
  // //     });

  // //     hikvision_counter += 1;
  // //     continue;
  // //   }

  // //   const dahua_str_code = `${dahua_codes[i].status.code} ${dahua_codes[i].status.desc}`;
  // //   const hikvision_str_code = `${hikvision_codes[i].status.code} ${hikvision_codes[i].status.desc}`;
  // //   xlsx_data.push([ obj_num, desc, dev_url.hostname, dahua_str_code, hikvision_str_code, "" ]);
  // // }

  // // console.log(`Responded dahua     devices ${dahua_counter}`);
  // // console.log(`Responded hikvision devices ${hikvision_counter}`);

  // // for (let i = 0; i < dev_types.length; ++i) {
  // //   const obj = dev_types[i];
  // //   if (obj.type === "dahua") {
  // //     const klass = await obj.device.get_device_class();
  // //     const type = await obj.device.get_device_type();

  // //     if (!type.data) {
  // //       console.log(type.status);
  // //       throw "Dahua type error";
  // //     }

  // //     if (!klass.data) {
  // //       console.log(klass.status);
  // //       throw "Dahua klass error";
  // //     }

  // //     xlsx_data.push([ obj.name, obj.desc, obj.device.host(), klass.data, type.data, "dahua" ]);
  // //     continue;
  // //   }

  // //   if (obj.type === "hikvision") {
  // //     //const { data, status } = await obj.device.system_device_info();
  // //     // if (!data) {
  // //     //   console.log(status);
  // //     //   throw "Hikvision error";
  // //     // }

  // //     xlsx_data.push([ obj.name, obj.desc, obj.device.host(), obj.data.deviceType, obj.data.model, "hikvision" ]);
  // //     continue;
  // //   }
  // // }

  // const date_str = make_current_day_str();
  // const buffer = xlsx.build([{name: 'Лист1', data: xlsx_data}]);
  // //const buffer = JSON.stringify(prtg_list);
  // //console.log(`Writing sensors tree`);
  // console.log(`Writing ${xlsx_data.length} rows`);
  // fs.writeFile(`cams_${date_str}.xlsx`, buffer, err => {
  //   if (err) { console.error(err); return; }
  //   console.log(`Success computing`);
  // });

  // console.log(eng_abc.length);
  // for (let i = 0; i < 50; ++i) {
  //   console.log(num_to_abc(i));
  // }

  //console.log(num_to_abc(devices_data_fields.length));
  // фух кое как закончил, это обновление таблицы устройств
  // const last_column = num_to_abc(devices_data_fields.length);
  // const values = await google.read_values(file_id, `A2:${last_column}`);
  // for (let index = 0; index < values.length; ++index) {
  //   const row = rows[index];

  //   // без каких данных можно проигнорировать?
  //   const type = row[devices_type_placement];
  //   if (!type || type === "") continue;
  //   const object_id = row[devices_object_id_placement];
  //   if (!object_id || object_id === "") continue;
  //   const ip_address = row[devices_ip_address_placement];

  //   const valuable_data_part = row.slice(0, 22);
  //   const data_str = valuable_data_part.join(";");
  //   const hash = sha256(data_str);
  //   const row_hash = row[devices_hash_placement];
  //   if (row_hash === hash) continue;

  //   const final_index = index + 1 + 1; // индексируем с 1 + стартуем со второй строки
  //   let device_data = {};
  //   let continueb = false;
  //   for (let i = 0; i < devices_data_fields.length; ++i) {
  //     const field_name = devices_data_fields[i];
  //     if (ignore_update_set.has(field_name)) continue;

  //     const row_value = row[i];
  //     const check = devices_data_placement[field_name].check(row_value);
  //     if (!check) {
  //       // пишем комментарий сзади строки
  //       const comm_coord = make_spreadsheet_coord(devices_data_fields.length, final_index);
  //       const error_coord = make_spreadsheet_coord(i, final_index);
  //       await google.write_values(file_id, `${comm_coord}:${comm_coord}`, [ [ `Could not parse '${field_name}' at ${error_coord}` ] ]);
  //       continueb = true;
  //       break;
  //     }

  //     if (devices_data_placement[field_name].get_db_data) {
  //       const obj = await devices_data_placement[field_name].get_db_data(field_name, row_value);
  //       device_data = unite_objs(device_data, obj);
  //     } else {
  //       device_data[field_name] = row_value;
  //     }
  //   }

  //   if (continueb) continue;
  //   // тут у нас есть распаршенные данные строки, теперь надо понять есть ли такое устройство 
  //   // если id нет, то попробуем поискать по данным строки
  //   const row_id = row[devices_id_placement];
  //   if (!row_id || row_id === "") {
  //     if (type === "камера") {
  //       // тогда нам нужны: объект, ид канала, ну и тип
  //       const found_obj = await db.find_device_by_group_id_type_channel_id(device_data["group_id"], type, device_data["channel_id"]);
  //       if (found_obj) {
  //         const camera_data = `${object_id}, ${type}, ${device_data["channel_id"]}`;
  //         const comm_coord = make_spreadsheet_coord(devices_data_fields.length, final_index);
  //         await google.write_values(file_id, `${comm_coord}:${comm_coord}`, [ [ `Found potentional camera doublicate (${camera_data}) with id ${found_obj.id}` ] ]);
  //         continue;
  //       }

  //       // добавим новую камеру
  //       // добавим ее в пртг и егсв
  //       const device_id = await db.create_device(device_data);
  //       // после обновим последние несколько столбцов
  //     } else {
  //       // для остального нужен по большому счету только ip
  //       if (!ip_address || ip_address === "") continue;

  //       const found_obj = await db.find_device_by_ip_address(ip_address);
  //       if (found_obj) {
  //         const dev_data = `${object_id}, ${type}, ${ip_address}`;
  //         const comm_coord = make_spreadsheet_coord(devices_data_fields.length, final_index);
  //         await google.write_values(file_id, `${comm_coord}:${comm_coord}`, [ [ `Found potentional device doublicate (${dev_data}) with id ${found_obj.id}` ] ]);
  //         continue;
  //       }

  //       // добавим новое устройство
  //       // утройство достаточно добавить только в пртг и в нашу базу
  //       const device_id = await db.create_device(device_data);
  //       // после обновим последние несколько столбцов
  //     }
  //   }
  // }

  // // предположим это группы
  // const values = await google.read_values(file_id, "A2:P");
  // for (const row of values) {
  //   // константы 
  //   const valuable_data_part = row.slice(0, 11);
  //   const data_str = valuable_data_part.join(";");
  //   const hash = sha256(data_str);

  //   if (row_hash !== hash) {
  //     // обновим, для этого сделаем из массива объект
  //     await db.update_device(data);
  //     await prtg.update_device(data); // обновим название группы и устройства?
  //     await egsv.update_device(data); // обновим название, описание, координаты, таксономию для всей группы
  //     // обновим хеш и дату в гугл таблице
  //   }
  // }

  // в конце обновим сводную таблицу
  // при обновлении данных нужно как то обнаружить возможные ошибки

  //const group = await prtg.find_group(2520);
  // let xlsx_data = [ [ "Номер объекта", "Название объекта", "Тип", "Адрес", "Маска", "Гейт", "Оборудование" ] ];
  // const { groups } = await prtg.get_child_groups(2520);
  // for (const group of groups) {
  //   //console.log(group);
  //   const id = group.name.split(" ")[0];
  //   const name = get_rid_of_first_el(group.name.split(" ")).join(" ");
  //   //console.log(name);
  //   const { devices } = await prtg.get_child_devices(group.objid);
  //   for (const device of devices) {
  //     //console.log(device);
  //     // const dev = new dahua({
  //     //   host: device.host,
  //     //   port: 80,
  //     //   user: "aqmol", // ???
  //     //   pass: "aqmol12345"
  //     // });

  //     const device_subnet = new subnet(`${device.host}/25`);
  //     const type = get_rid_of_first_el(device.name.split(" ")).join(" ");
  //     xlsx_data.push([ id, name, type, device.host, device_subnet.mask, device_subnet.host_min, "dahua" ]);
  //   }

  //   xlsx_data.push([]);
  // }

  // const { devices } = await prtg.get_child_devices(2504);
  // for (const device of devices) {
  //   const device_subnet = new subnet(`${device.host}/25`);
  //   const type = get_rid_of_first_el(device.name.split(" ")).join(" ");
  //   xlsx_data.push([ "12081", "Дом ребенка города Щучинск, ул. Боровская, 33", type, device.host, device_subnet.mask, device_subnet.host_min, "dahua" ]);
  // }

  // const buffer = xlsx.build([{name: 'Лист1', data: xlsx_data}]);
  // fs.writeFileSync("cam_data123.xlsx", buffer);

  // const hikvision_datas = [
  //   { host: "192.10.16.2", port: 80, user: "admin", pass: "qwerty123456" },
  //   //{ host: "10.4.0.1", port: 4565, user: "admin1", pass: "12345asd", actual_address: "192.168.1.186" },
  //   //{ host: "10.4.0.1", port: 4566, user: "admin", pass: "Ad12345678", actual_address: "192.168.2.100" },
  //   //{ host: "192.12.43.3", port: 80, user: "admin", pass: "admin12345" },
  // ];

  // let xlsx_data = [ [ "address", "user", "pass", "actual_address", "status", "manufacturer", "model" ] ];
  // for (const data of hikvision_datas) {
  //   const dev = new hikvision(data);
  //   const resp = await dev.device_info();
  //   //console.log(resp);
  //   xlsx_data.push([ data.host, data.user, data.pass, data.actual_address, resp.status.code, "Hikvision", resp.data ? resp.data.type+" "+resp.data.model : undefined ]);
  // }

  // const buffer = xlsx.build([{name: 'Лист1', data: xlsx_data}]);
  // fs.writeFileSync("hikvision_devices.xlsx", buffer);

  const device = new hikvision({ host: "192.12.70.4", port: 80, user: "admin", pass: "qwerty12345" });
  {const resp = await device.streaming_params(101);
  console.log(resp.data);}
  {const resp = await device.set_streaming_params(101, 1280, 720, 1024, 15);
  console.log(resp.data);}
  {const resp = await device.streaming_params(101);
  console.log(resp.data);}

})();

// так что теперь? мы получаем список камер из ЕГСВ и пытаемся понять что перед нами: камера или рег?
// если отдельная камера, то проверяем что это либо dahua либо hikvision отправив какой нибудь простой запрос
// для камер дальше нужно понять что за модель и взять еще парочку параметров и свести это дело в табличку
// если это рег, то опять проверяем производителя, берем модель и дальше нужно понять сколько и какие камеры подключены
// к регу, в hikvision кажется есть команды чтобы так или иначе провзаимодействовать с каналами, а у dahua я не нашел
// нужно взять модели камер которые подключены к регу и их тоже в табличку засунуть

// так что делаем сейчас? нужно создать сервис который будет парсить гугл таблицы и следить за их состоянием 
// по этим данным сервис будет синхронизировать данные с пртг и егсв
// прежде всего нужно сделать 4 таблицы: устройства, группы, контакты + общая сводная таблица
// общая сводная таблица - только для чтения, из остальных таблиц читаем инфу
// не будет ли таблица устройств слишком большой? скорее всего будет, надо ли что бы она была меньше?
// да может быть и нет исправлений там немного + есть фильтры
// как это выглядит? каждые два часа запускаем скрипт который:
// пройдет все строки, посчитает для строки хеш, сравнит его (с чем? хеш в базе? хеш в строке?),
// если хеш не совпадает, обновит бд и если нужно обновит ПРТГ и ЕГСВ
