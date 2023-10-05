require("dotenv").config();
const axios = require("axios");
const egsv_api = require("./apis/egsv");
const prtg_api = require("./apis/prtg");
const db = require("./apis/db");
const crypto = require("crypto");
const google = require("./apis/google").config("jwt.keys.json");

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

const devices_order = [ "роутер", "рег", "кнопка", "камера" ];

const GOOGLESHEETS_DEFAULT_NAME = "Sheet1";

const devices_data_fields = [ 
  "object_id", "type", "channel_id", 

  "parent_device", "ip_address", "name", "vendor", "class", "model", "rtsp_link", "sub_link", 
  "protocol", "port", "coords", "admin_login", "admin_password", "user_login", "user_password", 
  "old_device", "has_rtsp", "has_self_cert", "archive", "comment", 

  "empty",

  "data_hash", "id", "egsv_id", "prtg_id", "time_updated" 
];

const devices_data_placement_raw = {
  "object_id": { check: is_numeric, get_db_data: get_db_group }, 
  "type": { check: check_type_device, get_db_data: undefined }, 
  "channel_id": { check: is_valid_numeric_value, get_db_data: get_int }, 

  "parent_device": { check: is_valid_ip_value, get_db_data: undefined }, 
  "ip_address": { check: is_valid_ip_value, get_db_data: undefined }, 
  "name": { check: get_true, get_db_data: undefined }, 
  "vendor": { check: get_true, get_db_data: undefined }, 
  "class": { check: get_true, get_db_data: undefined }, 
  "model": { check: get_true, get_db_data: undefined }, 
  "rtsp_link": { check: get_true, get_db_data: undefined }, 
  "sub_link": { check: get_true, get_db_data: undefined }, 
  "protocol": { check: check_protocol, get_db_data: undefined }, 
  "port": { check: is_valid_numeric_value, get_db_data: undefined }, 
  "coords": { check: is_coords, get_db_data: undefined }, 
  "admin_login": { check: get_true, get_db_data: undefined }, 
  "admin_password": { check: get_true, get_db_data: undefined }, 
  "user_login": { check: get_true, get_db_data: undefined }, 
  "user_password": { check: get_true, get_db_data: undefined }, 
  //"egsv_server": { check: is_numeric, get_db_data: undefined }, 
  "old_device": { check: check_boolean, get_db_data: undefined }, 
  "has_rtsp": { check: check_boolean, get_db_data: undefined }, 
  "has_self_cert": { check: check_boolean, get_db_data: undefined }, 
  "archive": { check: get_true, get_db_data: undefined }, 
  "comment": { check: get_true, get_db_data: undefined }, 

  "empty": { check: undefined, get_db_data: undefined },

  "data_hash": { check: is_hex, get_db_data: undefined }, 
  "id": { check: is_valid_numeric_value, get_db_data: undefined }, 
  "egsv_id": { check: is_valid_identificator_value, get_db_data: undefined }, 
  "prtg_id": {  check: is_valid_numeric_value, get_db_data: undefined }, 
  "time_updated": {  check: get_true, get_db_data: undefined }, 
};

function make_placement() {
  let placement = {};
  for (let i = 0; i < devices_data_fields.length; ++i) {
    const field = devices_data_fields[i];
    placement[field] = {};
    placement[field].column = num_to_abc(i);
    placement[field].index = i;
    if (!devices_data_placement_raw[field]) throw `Could not find ${field} in devices_data_placement_raw`;
    placement[field].check = devices_data_placement_raw[field].check;
    placement[field].get_db_data = devices_data_placement_raw[field].get_db_data;
  }
  return placement;
}

const devices_data_placement = make_placement();
//console.log(devices_data_placement);

(async () => {
  let rows = [];
  for (const d_type of devices_order) {
    console.log(`Making '${d_type}' type`);
    const devices = await db.get_devices_by_type(d_type);
    for (const device of devices) {
      let sheet_row = [];
      for (const field of devices_data_fields) {
        sheet_row.push("");

        if (field === "empty") continue;
        if (device[field] === null) continue;

        if (field === "object_id") {
          const group = await db.find_group_by_id(device.group_id);
          sheet_row[sheet_row.length-1] = group.object_id;
          continue;
        }

        if (field === "parent_device") {
          if (device.parent_id === 0) continue;
          const parent_device = await db.find_device_by_id(device.parent_id);
          sheet_row[sheet_row.length-1] = parent_device.ip_address;
          continue;
        }

        if (field === "data_hash") {
          // здесь у sheet_row должны быть все данные, мы можем взять массив и посчитать хеш
          const row_data = sheet_row.join(";");
          const hash = sha256(row_data);
          sheet_row[sheet_row.length-1] = hash;
          // хеш надо обновить в бд, в будущем хеш надо пересчитывать по изменениям в бд, как сделать? 
          //const device_data = { id: device.id, data_hash: hash };
          //await db.update_device(device_data);
          continue;
        }

        if (device[field] === undefined) throw `Could not find device field '${field}'`;
        
        sheet_row[sheet_row.length-1] = device[field];
      }

      //console.log(sheet_row);
      rows.push(sheet_row);
    }
  }

  console.log("Writing data to google");
  const file_id = process.env.GOOGLE_SHEET_DEVICES;
  const last_column = num_to_abc(devices_data_fields.length);
  await google.write_values(file_id, `A2:${last_column}`, rows);

  await db.close_connection();
})();