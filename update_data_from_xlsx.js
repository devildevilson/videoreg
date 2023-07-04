require("dotenv").config();
const db = require("./apis/db");
const xlsx = require("node-xlsx");
const fs = require("fs");

const file_data = xlsx.parse(`cams2_2023.06.27.xlsx`);
const xlsx_object_row = {
  object_id: 0,
  name: 1,
};
const xlsx_device_row = {
  ip_address: 2,
  type: 3,
  "class": 4,
  model: 5,
  vendor: 6,
  comment: 7,
};
const xlsx_device_comment_row = {
  additional_comment: 8
};

const set_ignore_this_values = new Set([ "404 File Not Found", "-4039 ETIMEDOUT", "404 Not Found", "136 Not support", "-4078 ECONNREFUSED", "401 Unauthorized", "-1 SELF_SIGNED_CERT_IN_CHAIN undefined", "-1 HPE_INVALID_CONSTANT Expected HTTP/", "-1 HPE_INVALID_HEADER_TOKEN Invalid header value char" ]);

(async () => {
  for (const row of file_data[0].data) {
    if (!row[0]) continue;
    if (row[0] === "") continue;
    if (row[0] === "№ объекта") continue;
    if (row[0] === "test") continue;

    let group_data = {};
    group_data.description = "";
    group_data.comment = "";
    for (const [ key, value ] of Object.entries(xlsx_object_row)) {
      group_data[key] = row[value];
    }

    // приводим к одному общему виду
    group_data["object_id"] = group_data["object_id"][0] === "0" ? group_data["object_id"].substring(1) : group_data["object_id"];
    let group_id = 0;
    const group = await db.find_group_by_object_id(group_data["object_id"]);
    if (!group) {
      group_id = await db.create_group(group_data);
    } else {
      group_id = group.id;
    }

    let device_data = {};
    device_data.rtsp_link = "";
    device_data.archive = "";
    device_data.comment = "";
    for (const [ key, value ] of Object.entries(xlsx_device_row)) {
      const val = row[value];
      device_data[key] = !val || set_ignore_this_values.has(val) ? "" : val;
    }

    //device_data.group_id = group_data["object_id"];
    device_data.group_id = group_id;
    //console.log(device_data);
    const device_id = await db.create_device(device_data);

    const comment = row[xlsx_device_comment_row.additional_comment];
    if (device_id !== 0 && comment && comment !== "") {
      await db.create_device_comment(device_id, comment);
    }

    //if (comment && comment !== "") break;
  }

  await db.close_connection();
})();