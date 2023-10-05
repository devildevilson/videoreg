require("dotenv").config();
const mysql = require("mysql2/promise");

const connection_config = {
  host     : process.env.DB_HOST,
  port     : process.env.DB_PORT,
  user     : process.env.DB_USER,
  password : process.env.DB_PASS,
  database : process.env.DB_NAME,
  connectionLimit: 10,
};

const pool = mysql.createPool(connection_config);
//(async () => { pool = await mysql.createPool(connection_config); })();

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

const group_creation_fields = [ "prtg_id", "object_id", "name", "description", "type", "coords", "gateway", "comment" ];
const device_creation_fields = [ 
  "egsv_id", "prtg_id", "group_id", "parent_id", "ip_address", "name", "port", "protocol", 
  "coords", "type", "vendor", "class", "model", "admin_login", "admin_password", "user_login", "user_password",
  "channel_id", "rtsp_link", "sub_link", "egsv_server", "old_device", "has_rtsp", "has_self_cert", "archive", "comment"
];

function is_empty_string(str) {
  return typeof str === "string" && str === "";
}

let functions = {
  close_connection: async function() { return pool.end(); },

  find_group_by_id: async function(id) {
    const query_str = `SELECT * FROM \`groups\` WHERE id = '${id}';`;
    const [ res, _ ] = await pool.query(query_str);
    return res.length !== 0 ? res[0] : undefined;
  },

  find_device_by_id: async function(id) {
    const query_str = `SELECT * FROM \`devices\` WHERE id = '${id}';`;
    const [ res, _ ] = await pool.query(query_str);
    return res.length !== 0 ? res[0] : undefined;
  },

  find_group_by_object_id: async function(object_id) {
    const query_str = `SELECT * FROM \`groups\` WHERE object_id = '${object_id}';`;
    const [ res, _ ] = await pool.query(query_str);
    return res.length !== 0 ? res[0] : undefined;
  },

  find_group_by_prtg_id: async function(prtg_id) {
    const query_str = `SELECT * FROM \`groups\` WHERE prtg_id = '${prtg_id}';`;
    const [ res, _ ] = await pool.query(query_str);
    return res.length !== 0 ? res[0] : undefined;
  },

  find_device_by_ip_address: async function(ip_address) {
    const query_str = `SELECT * FROM \`devices\` WHERE ip_address = '${ip_address}';`;
    const [ res, _ ] = await pool.query(query_str);
    return res.length !== 0 ? res[0] : undefined;
  },

  find_device_by_group_id_type_channel_id: async function(group_id, type, channel_id) {
    const query_str = `SELECT * FROM \`devices\` WHERE group_id = ${group_id} AND type = '${type}' AND channel_id = ${channel_id};`;
    const [ res, _ ] = await pool.query(query_str);
    return res.length !== 0 ? res[0] : undefined;
  },

  find_group_by_name: async function(name) {
    const query_str = `SELECT * FROM \`groups\` WHERE name LIKE '${name}%';`;
    const [ res, _ ] = await pool.query(query_str);
    return res.length !== 0 ? res[0] : undefined;
  },

  find_device_by_egsv_id: async function(egsv_id) {
    const query_str = `SELECT * FROM \`devices\` WHERE egsv_id = '${egsv_id}';`;
    const [ res, _ ] = await pool.query(query_str);
    return res.length !== 0 ? res[0] : undefined;
  },

  get_groups: async function() {
    const query_str = `SELECT * FROM \`groups\`;`;
    const [ res, _ ] = await pool.query(query_str);
    return res;
  },

  get_groups_by_type: async function(type) {
    const query_str = `SELECT * FROM \`groups\` WHERE type = '${type}';`;
    const [ res, _ ] = await pool.query(query_str);
    return res;
  },

  get_devices: async function() {
    const query_str = `SELECT * FROM \`devices\`;`;
    const [ res, _ ] = await pool.query(query_str);
    return res;
  },

  get_devices_by_type: async function(type) {
    const query_str = `SELECT * FROM \`devices\` WHERE type = '${type}';`;
    const [ res, _ ] = await pool.query(query_str);
    return res;
  },

  update_row: async function(table_name, data) {
    const row_id = data.id;

    let set_fields = "";
    for (const [ key, value ] of Object.entries(data)) {
      if (key === "id") continue;

      const is_string = typeof value === "string";
      const final_value = is_string ? `'${mysql_real_escape_string(value.trim())}'` : `${value}`;
      if (set_fields === "") set_fields += `${key} = ${final_value}`;
      else set_fields += `, ${key} = ${final_value}`;
    }

    const update_str = `UPDATE \`${table_name}\` SET ${set_fields} WHERE id = ${row_id};`;
    await pool.query(update_str);
  },

  create_device: async function(data) {
    let fields = "";
    let field_data = "";

    //let found_group = false;
    for (const key of device_creation_fields) {
      if (data[key] === undefined) continue; // || is_empty_string(data[key])
      //const db_data = typeof data[key] === "string" ? mysql_real_escape_string(data[key].trim()) : data[key];
      const is_string = typeof data[key] === "string";
      const db_data = is_string ? `'${mysql_real_escape_string(data[key].trim())}'` : `${data[key]}`;

      if (fields !== "") fields += `, ${key}`;
      else fields += `${key}`;

      // if (key === "group_id") {
      //   // const group = await functions.find_group_by_object_id(db_data);
      //   // if (!group) {
      //   //   console.log(`Could not find group by object id '${db_data}'. Skip`);
      //   //   continue;
      //   // }

      //   // found_group = true;

      //   if (field_data !== "") field_data += `, ${group.id}`;
      //   else field_data += `${group.id}`;
      //   continue;
      // }

      // if (key === "has_rtsp" || key === "has_self_cert" || key === "old_device") {
      //   if (field_data !== "") field_data += `, ${db_data}`;
      //   else field_data += `${db_data}`;
      //   continue;
      // }

      if (field_data !== "") field_data += `, ${db_data}`;
      else field_data += `${db_data}`;
    }

    //if (!found_group) return 0;

    const status_text = data.status ? data.status : "";
    const insert_str = `INSERT INTO \`devices\` (${fields}) VALUES (${field_data});`;
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    await conn.query(insert_str);
    const [ [ { device_id } ], _ ] = await conn.query("SELECT LAST_INSERT_ID() AS device_id;");
    const insert2_str = `INSERT INTO devices_health_check (parent_id, status) VALUES (${device_id}, '${status_text}'), (${device_id}, '${status_text}');`;
    await conn.query(insert2_str);
    await conn.commit()
    conn.release();
    return device_id;

    //console.log(insert_str);
    //return 1;
  },

  update_device: async function(data) {
    return functions.update_row("devices", data);
  },

  create_group: async function(data) {
    let fields = "";
    let field_data = "";

    for (const key of group_creation_fields) {
      if (data[key] === undefined) continue; // || is_empty_string(data[key])
      const is_string = typeof data[key] === "string";
      const db_data = is_string ? `'${mysql_real_escape_string(data[key].trim())}'` : `${data[key]}`;
      //const db_data = typeof data[key] === "string" ? mysql_real_escape_string(data[key].trim()) : data[key];
      //console.log(key, db_data);

      if (fields !== "") fields += `, ${key}`;
      else fields += `${key}`;
      if (field_data !== "") field_data += `, ${db_data}`;
      else field_data += `${db_data}`;
    }

    const insert_str = `INSERT INTO \`groups\` (${fields}) VALUES (${field_data});`;
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    await conn.query(insert_str);
    const [ [ { group_id } ], _ ] = await conn.query("SELECT LAST_INSERT_ID() AS group_id;");
    await conn.commit()
    conn.release();
    return group_id;

    //console.log(insert_str);
    //return 1;
  },

  update_group: async function(data) {
    return functions.update_row("groups", data);
  },

  create_device_comment: async function(device_id, comment) {
    // const insert_str = `
    //   INSERT INTO device_comments (parent_id, \`index\`, data) VALUES (${device_id}, 
    //   (SELECT COUNT(id)+1 FROM device_comments WHERE parent_id = ${device_id}),
    //   '${mysql_real_escape_string(comment.trim())}');
    // `;

    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const [ [ { count } ], _ ] = await conn.query(`SELECT COUNT(id)+1 AS count FROM device_comments WHERE parent_id = ${device_id};`);
    const insert_str = `INSERT INTO device_comments (parent_id, \`index\`, data) VALUES (${device_id}, ${count}, '${mysql_real_escape_string(comment.trim())}');`;
    await conn.query(insert_str);
    await conn.commit()
    conn.release();
  }
};

module.exports = functions;