require("dotenv").config();
const axios = require("axios");
const egsv_api = require("./apis/egsv");
const prtg_api = require("./apis/prtg");
const db = require("./apis/db");
//const google = require("./apis/google").config("jwt.keys.json");

const eng_abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function num_to_abc(num) {
  const count = Math.floor(num / eng_abc.length);
  const index = num % eng_abc.length;
  if (count < 1) return eng_abc[index];
  return num_to_abc(count-1) + eng_abc[index];
}

function uppercase_char_index(char) {
  return char.charCodeAt(0) - "A".charCodeAt(0);
}

function abc_to_num_internal(str, index) {
  const final_index = index ? index : 0;
  const char_index = uppercase_char_index(str[final_index]);
  if (final_index === str.length-1) return { cur_num: char_index, pow: 1 };

  const { cur_num, pow } = abc_to_num_internal(str, final_index+1);
  const cpow = pow * eng_abc.length;
  return { cur_num: cur_num+(char_index+1)*cpow, pow: cpow };
}

function abc_to_num(str) {
  const { cur_num, pow } = abc_to_num_internal(str);
  return cur_num;
}

function make_spreadsheet_coord(x, y) { return `${num_to_abc(x)}${y}`; }
function sha256(data) { return crypto.createHash("sha256").update(data).digest('hex'); }

function arr_find(arr, value) {
  let i = 0;
  for (; i < arr.length && arr[i] !== value; ++i) {}
  return i;
}

function is_empty_string(str) { return typeof str === "string" && str === ""; }
function is_exact_string(str, value) { return typeof str === "string" && str === value; }

function is_numeric_char(c) { return typeof c === "string" && /^\d$/.test(c); }
function is_numeric(str) { return typeof str === "number" || (typeof str === "string" && /^\d+$/.test(str)); }
function is_hex(str) { return typeof str === "string" && /^[0-9A-F]+$/i.test(str); }
function is_identificator(str) { return typeof str === "string" && /^[0-9A-Za-z]+$/i.test(str); }
function is_coords(str) { return typeof str === "string" && /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/g.test(str); }
function is_ip_address(str) { return typeof str === "string" && /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/g.test(str); }
function is_valid_ip_value(str) { return is_ip_address(str) || is_empty_string(str) || is_exact_string(str, "local"); }
function is_valid_numeric_value(str) { return is_numeric(str) || is_empty_string(str); }
function is_valid_hex_value(str) { return is_hex(str) || is_empty_string(str); }
function is_valid_identificator_value(str) { return is_identificator(str) || is_empty_string(str); }
function is_valid_coords_value(str) { return is_coords(str) || is_empty_string(str); }
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

const GOOGLESHEETS_DEFAULT_NAME = "Sheet1";

const devices_data_fields = [ 
  "object_id", "type", "channel_id", 

  "ip_address", "name", "vendor", "class", "model", "rtsp_link", "protocol", "port", "coords", "admin_login", "admin_password", 
  "user_login", "user_password", "old_device", "has_rtsp", "has_self_cert", "archive", "comment", 

  "id", "data_hash", "egsv_id", "prtg_id", "time_updated" 
];

const devices_data_placement = {
  "object_id": { column: "A", check: is_numeric, get_db_data: get_db_group }, 
  "type": { column: "B", check: check_type_device, get_db_data: undefined }, 
  "channel_id": { column: "C", check: is_valid_numeric_value, get_db_data: get_int }, 

  "parent_device": { column: "D", check: is_valid_ip_value, get_db_data: undefined }, 
  "ip_address": { column: "E", check: is_valid_ip_value, get_db_data: undefined }, 
  "name": { column: "F", check: get_true, get_db_data: undefined }, 
  "vendor": { column: "G", check: get_true, get_db_data: undefined }, 
  "class": { column: "H", check: get_true, get_db_data: undefined }, 
  "model": { column: "I", check: get_true, get_db_data: undefined }, 
  "rtsp_link": { column: "J", check: get_true, get_db_data: undefined }, 
  "protocol": { column: "K", check: check_protocol, get_db_data: undefined }, 
  "port": { column: "L", check: is_valid_numeric_value, get_db_data: undefined }, 
  "coords": { column: "M", check: is_coords, get_db_data: undefined }, 
  "admin_login": { column: "N", check: get_true, get_db_data: undefined }, 
  "admin_password": { column: "O", check: get_true, get_db_data: undefined }, 
  "user_login": { column: "P", check: get_true, get_db_data: undefined }, 
  "user_password": { column: "Q", check: get_true, get_db_data: undefined }, 
  //"egsv_server": { column: "B", check: is_numeric, get_db_data: undefined }, 
  "old_device": { column: "R", check: check_boolean, get_db_data: undefined }, 
  "has_rtsp": { column: "S", check: check_boolean, get_db_data: undefined }, 
  "has_self_cert": { column: "T", check: check_boolean, get_db_data: undefined }, 
  "archive": { column: "U", check: get_true, get_db_data: undefined }, 
  "comment": { column: "V", check: get_true, get_db_data: undefined }, 

  "id": { column: "X", check: is_valid_numeric_value, get_db_data: undefined }, 
  "data_hash": { column: "Y", check: is_hex, get_db_data: undefined }, 
  "egsv_id": { column: "Z", check: is_valid_identificator_value, get_db_data: undefined }, 
  "prtg_id": { column: "AA", check: is_valid_numeric_value, get_db_data: undefined }, 
  "time_updated": { column: "AB", check: get_true, get_db_data: undefined }, 
};

const devices_hash_placement = arr_find(devices_data_fields, "data_hash");
const devices_id_placement = arr_find(devices_data_fields, "id");
const devices_type_placement = arr_find(devices_data_fields, "type");
const devices_object_id_placement = arr_find(devices_data_fields, "object_id");
const devices_ip_address_placement = arr_find(devices_data_fields, "ip_address");
const devices_prtg_id_placement = arr_find(devices_data_fields, "prtg_id");

const devices_admin_login_placement = arr_find(devices_data_fields, "admin_login");
const devices_admin_password_placement = arr_find(devices_data_fields, "admin_password");
const devices_user_login_placement = arr_find(devices_data_fields, "user_login");
const devices_user_password_placement = arr_find(devices_data_fields, "user_password");
function check_row_creds(row) {
  let login = row[devices_admin_login_placement];
  let password = row[devices_admin_password_placement];
  let admin = true;
  if ((!login || login === "") || (!password || password === "")) {
    login = row[devices_user_login_placement];
    password = row[devices_user_password_placement];
    admin = false;
  }

  if ((!login || login === "") || (!password || password === "")) return undefined;
  return { login, password, admin };
}

function make_rtsp_link_dahua(login, password, ip, channel_id) {
  return { 
    main: `rtsp://${login}:${password}@${ip}:554/cam/realmonitor?channel=${channel_id}&subtype=0`, 
    sub: `rtsp://${login}:${password}@${ip}:554/cam/realmonitor?channel=${channel_id}&subtype=1`
  };
}

function make_rtsp_link_camera_dahua(login, password, ip) {
  return { 
    main: `rtsp://${login}:${password}@${ip}:554/live`,
    sub: `rtsp://${login}:${password}@${ip}:554/live/sub`
  };
}

function make_rtsp_link_hikvision(login, password, ip, channel_id) {
  return {
    main: `rtsp://${login}:${password}@${ip}:554/Streaming/Channels/${channel_id+1}01`,
    sub: `rtsp://${login}:${password}@${ip}:554/Streaming/Channels/${channel_id+1}02`
  };
}

function make_rtsp_link_camera_hikvision(login, password, ip) {
  return {
    main: `rtsp://${login}:${password}@${ip}:554/Streaming/Channels/101`,
    sub: `rtsp://${login}:${password}@${ip}:554/Streaming/Channels/102`
  };
}

function make_rtsp_link_trassir(login, password, ip, channel_id) {
  return {
    main: `rtsp://${login}:${password}@${ip}:554/user=${login}_password=${password}_channel=${channel_id+1}_stream=0.sdp`,
    sub: `rtsp://${login}:${password}@${ip}:554/user=${login}_password=${password}_channel=${channel_id+1}_stream=1.sdp`
  };
}

function make_rtsp_link_camera_trassir(login, password, ip) {
  return {
    main: `rtsp://${login}:${password}@${ip}:554/live/main`,
    sub: `rtsp://${login}:${password}@${ip}:554/live/sub`
  };
}

function make_rtsp_link_polyvision(login, password, ip, channel_id) {
  return {
    main: `rtsp://${login}:${password}@${ip}:554/user=${login}&password=${password}&channel=${channel_id+1}&stream=00.sdp`,
    sub: `rtsp://${login}:${password}@${ip}:554/user=${login}&password=${password}&channel=${channel_id+1}&stream=01.sdp`
  };
}

function make_rtsp_link_camera_polyvision(login, password, ip) {
  return {
    main: `rtsp://${login}:${password}@${ip}:554/user=${login}&password=${password}&channel=1&stream=00.sdp`,
    sub: `rtsp://${login}:${password}@${ip}:554/user=${login}&password=${password}&channel=1&stream=01.sdp`
  };
}

const prtg = new prtg_api({
  host: process.env.PRTG_HOST,
  port: process.env.PRTG_PORT,
  user: process.env.PRTG_USER,
  hash: process.env.PRTG_HASH,
});

async function update() {
  const last_column = num_to_abc(devices_data_fields.length);
  const values = await google.read_values(file_id, `A2:${last_column}`);
  for (let index = 0; index < values.length; ++index) {
    const row = rows[index];

    // без каких данных можно проигнорировать?
    const type = row[devices_type_placement];
    if (!type || type === "") continue;
    const object_id = row[devices_object_id_placement];
    if (!object_id || object_id === "") continue;
    const ip_address = row[devices_ip_address_placement];

    const valuable_data_part = row.slice(0, 22);
    const data_str = valuable_data_part.join(";");
    const hash = sha256(data_str);
    const row_hash = row[devices_hash_placement];
    if (row_hash === hash) continue;

    const final_index = index + 1 + 1; // индексируем с 1 + стартуем со второй строки
    let device_data = {};
    let continueb = false;
    for (let i = 0; i < devices_data_fields.length; ++i) {
      const field_name = devices_data_fields[i];
      if (ignore_update_set.has(field_name)) continue;

      const row_value = row[i];
      const check = devices_data_placement[field_name].check(row_value);
      if (!check) {
        // пишем комментарий сзади строки
        const comm_coord = make_spreadsheet_coord(devices_data_fields.length, final_index);
        const error_coord = make_spreadsheet_coord(i, final_index);
        await google.write_values(file_id, `${comm_coord}:${comm_coord}`, [ [ `Could not parse '${field_name}' at ${error_coord}` ] ]);
        continueb = true;
        break;
      }

      if (devices_data_placement[field_name].get_db_data) {
        const obj = await devices_data_placement[field_name].get_db_data(field_name, row_value);
        device_data = unite_objs(device_data, obj);
      } else {
        device_data[field_name] = row_value;
      }
    }

    if (continueb) continue;
    // тут у нас есть распаршенные данные строки, теперь надо понять есть ли такое устройство 
    // если id нет, то попробуем поискать по данным строки
    const row_id = row[devices_id_placement];
    if (!row_id || row_id === "") {
      if (type === "камера") {
        // тогда нам нужны: объект, ид канала, ну и тип
        const found_obj = await db.find_device_by_group_id_type_channel_id(device_data["group_id"], type, device_data["channel_id"]);
        if (found_obj) {
          const camera_data = `${object_id}, ${type}, ${device_data["channel_id"]}`;
          const comm_coord = make_spreadsheet_coord(devices_data_fields.length, final_index);
          await google.write_values(file_id, `${comm_coord}:${comm_coord}`, [ [ `Found potentional camera duplicate (${camera_data}) with id ${found_obj.id}` ] ]);
          continue;
        }

        // добавим новую камеру
        if (is_ip_address(ip_address)) {
          // добавим в пртг, как? создадим дубликат устройства (там сенсор скорее всего будет пинг)
          // изменим параметры имя, адрес, тег, ничего особо сложного кажется
          // нужно получить id группы родителя
          const group = await db.find_group_by_object_id(object_id);
          if (group.prtg_id !== "") {
            const camera_id = await prtg.add_device(group.prtg_id, `${ip_address} CAM`, ip_address);
            await prtg.set_property(camera_id, "tags", "CAM");
            await prtg.set_property(camera_id, "deviceicon", "device_webcam.png");
            device_data[prtg_id] = `${camera_id}`;
            const comm_coord = make_spreadsheet_coord(devices_prtg_id_placement, final_index);
            await google.write_values(file_id, `${comm_coord}:${comm_coord}`, [ [ `${camera_id}` ] ]);
          }
        }

        // для того чтобы добавить ее в егсв нужно знать логин пароли, если мы их знаем, и знаем либо ip либо рег то можем составить ртсп
        const creds = check_row_creds(row);
        if (creds) {
          const channel = device_data["channel_id"];
          const vendor = device_data["vendor"];
          // ртсп сложно, нужен ip адрес, а если его нет, то ip адрес родителя, + понять какой производитель
          const rtsp_link = `rtsp://${creds.login}:${creds.password}@${}`;
        }

        const device_id = await db.create_device(device_data);
        // после обновим последние несколько столбцов
      } else {
        // для остального нужен по большому счету только ip
        if (!ip_address || ip_address === "") continue;

        const found_obj = await db.find_device_by_ip_address(ip_address);
        if (found_obj) {
          const dev_data = `${object_id}, ${type}, ${ip_address}`;
          const comm_coord = make_spreadsheet_coord(devices_data_fields.length, final_index);
          await google.write_values(file_id, `${comm_coord}:${comm_coord}`, [ [ `Found potentional device duplicate (${dev_data}) with id ${found_obj.id}` ] ]);
          continue;
        }

        // добавим новое устройство
        // утройство достаточно добавить только в пртг и в нашу базу
        const device_id = await db.create_device(device_data);
        // после обновим последние несколько столбцов
      }
    }
  }
}

// console.log(" A", abc_to_num("A"));
// console.log(" B", abc_to_num("B"));
// console.log(" C", abc_to_num("C"));
// console.log(" Z", abc_to_num("Z"));
// console.log("AA", abc_to_num("AA"));
// console.log("AB", abc_to_num("AB"));
// console.log("BA", abc_to_num("BA"));

// let arr = [];
// for (let i = 0; i < 55; ++i) {
//   arr.push(num_to_abc(i));
// }
// console.log(arr);

// const arr = [
//   'A',  'B',  'C',  'D',  'E',  'F',  'G',  'H',
//   'I',  'J',  'K',  'L',  'M',  'N',  'O',  'P',
//   'Q',  'R',  'S',  'T',  'U',  'V',  'W',  'X',
//   'Y',  'Z',  'AA', 'AB', 'AC', 'AD', 'AE', 'AF',
//   'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN',
//   'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV',
//   'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC'
// ];
// for (const coord of arr) {
//   console.log(coord, abc_to_num(coord));
// }

(async () => {

})();