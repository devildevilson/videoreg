require("dotenv").config();
const db = require("./apis/db");
const axios = require("axios");
const dahua = require("./apis/dahua");
const hikvision = require("./apis/hikvision");
const trassir = require("./apis/trassir");
const egsv_api = require("./apis/egsv");
const prtg_api = require("./apis/prtg");

(async () => {
  const egsv = new egsv_api({
    host: process.env.EGSV_HOST,
    port: process.env.EGSV_PORT,
    user: process.env.EGSV_USER,
    pass: process.env.EGSV_PASS
  });

  await egsv.auth();

  const cams_list = await egsv.camera_list();

  let counter = 0;
  for (const camera of cams_list.cameras) {
    if (counter % 100 === 0) console.log(`Processed ${counter} devices`);
    counter += 1;

    const camera_device = await db.find_device_by_egsv_id(camera.id);
    if (!camera_device) continue;
    let camera_device_data = { id: camera_device.id, parent_id: camera_device.parent_id }
    const old_parent_id = camera_device_data.parent_id;

    const main_link = new URL(camera.url);
    const sub_link = camera.secondary && camera.secondary.url ? new URL(camera.secondary.url) : undefined;

    const device = await db.find_device_by_ip_address(main_link.hostname);
    // if (!device) {
    //   console.log(`Could not find device by ip address ${main_link.hostname}`);
    //   continue;
    // }

    //if (device && device.type === "камера") {}

    if (device && device.type === "рег") camera_device_data["parent_id"] = device.id;
    //if (!device || (device && device.type === "камера") || (device && device.type !== "рег" && device.type !== "камера")) 
    else {
      const device_sub = sub_link ? await db.find_device_by_ip_address(sub_link.hostname) : undefined;
      if (device_sub && device_sub === "рег") camera_device_data["parent_id"] = device_sub.id;
      else {
        const name_parts = camera.name.trim().split("_");
        const raw_object_id = name_parts[0];
        let object_id = "";
        if (raw_object_id[0] === "0") {
          object_id = raw_object_id.substring(1);
        } else {
          object_id = raw_object_id;
        }

        const group = await db.find_group_by_object_id(object_id);
        if (group) {
          const pdevice = await db.find_device_by_group_id_type_channel_id(group.id, "рег", 0);
          if (pdevice) camera_device_data["parent_id"] = pdevice.id;
        }
      }
    }

    if (camera_device_data.parent_id === old_parent_id) continue;
    await db.update_device(camera_device_data);
  }

  console.log(`Updated ${counter} devices`);
  await db.close_connection();
})();
