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

const groups_order = [ "группа", "объект" ];

const GOOGLESHEETS_DEFAULT_NAME = "Sheet1";

const groups_data_fields = [ 
  "parent", "object_id", "name", "description", "type", "coords", "gateway", "netmask", "host_min", "host_max", "comment", 
  "empty",
  "data_hash", "id", "egsv_id", "prtg_id", "time_updated" 
];

const groups_data_placement_raw = { 
  "parent": { check: is_numeric, get_db_data: get_db_parent }, 
  "object_id": { check: is_numeric, get_db_data: undefined }, 
  "name": { check: get_true, get_db_data: undefined }, 
  "description": { check: get_true, get_db_data: undefined }, 
  "type": { check: check_type_group, get_db_data: undefined }, 
  "coords": { check: is_coords, get_db_data: undefined }, 
  "gateway": { check: is_ip_address, get_db_data: undefined }, 
  "netmask": { check: is_ip_address, get_db_data: undefined }, 
  "host_min": { check: is_ip_address, get_db_data: undefined }, 
  "host_max": { check: is_ip_address, get_db_data: undefined }, 
  "comment": { check: get_true, get_db_data: undefined }, 
  // вот эти данные не изменяются в бд
  "id": { check: is_numeric, get_db_data: undefined }, 
  "data_hash": { check: is_hex, get_db_data: undefined }, 
  "egsv_id": { check: is_numeric, get_db_data: undefined }, 
  "prtg_id": { check: is_numeric, get_db_data: undefined }, 
  "time_updated": { check: get_true, get_db_data: undefined }, 
};

function make_placement() {
  let placement = {};
  for (let i = 0; i < groups_data_fields.length; ++i) {
    const field = groups_data_fields[i];
    if (field === "empty") continue;

    placement[field] = {};
    placement[field].column = num_to_abc(i);
    placement[field].index = i;
    if (!groups_data_placement_raw[field]) throw `Could not find ${field} in groups_data_placement_raw`;
    placement[field].check = groups_data_placement_raw[field].check;
    placement[field].get_db_data = groups_data_placement_raw[field].get_db_data;
  }
  return placement;
}

const groups_data_placement = make_placement();

(async () => {
  let rows = [];
  for (const type of groups_order) {
    console.log(`Making '${type}' type`);
    const groups = await db.get_groups_by_type(type);
    for (const group of groups) {
      let sheet_row = [];
      for (const field of groups_data_fields) {
        sheet_row.push("");

        if (field === "empty") continue;
        if (group[field] === null) continue;

        if (field === "parent") {
          if (group.parent_id === 0) continue;
          const pgroup = await db.find_group_by_id(group.parent_id);
          sheet_row[sheet_row.length-1] = pgroup.name;
          continue;
        }

        if (field === "data_hash") {
          const row_data = sheet_row.join(";");
          const hash = sha256(row_data);
          sheet_row[sheet_row.length-1] = hash;
          // хеш надо обновить в бд, в будущем хеш надо пересчитывать по изменениям в бд, как сделать? 
          const group_data = { id: group.id, data_hash: hash };
          await db.update_group(group_data);
          continue;
        }

        if (group[field] === undefined) throw `Could not find group field '${field}'`;
        
        sheet_row[sheet_row.length-1] = group[field];
      }

      rows.push(sheet_row);
    }
  }

  //console.log(rows);
  console.log("Writing data to google");
  const file_id = process.env.GOOGLE_SHEET_GROUPS;
  const last_column = num_to_abc(groups_data_fields.length);
  await google.write_values(file_id, `A2:${last_column}`, rows);

  await db.close_connection();
})();