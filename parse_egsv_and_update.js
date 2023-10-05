require("dotenv").config();
const db = require("./apis/db");
const axios = require("axios");
const dahua = require("./apis/dahua");
const hikvision = require("./apis/hikvision");
const trassir = require("./apis/trassir");
const egsv_api = require("./apis/egsv");
const prtg_api = require("./apis/prtg");

const object_tags_to_human = {
  "router": "роутер",
  "cam": "камера",
  "button": "кнопка",
  "nvr": "рег",
};

const devices_data_fields = [ 
  "object_id", "type", "channel_id", 

  "ip_address", "name", "vendor", "class", "model", "rtsp_link", "protocol", "port", "coords", "admin_login", "admin_password", 
  "user_login", "user_password", "old_device", "has_rtsp", "has_self_cert", "archive", "comment", 

  "id", "data_hash", "egsv_id", "prtg_id", "time_updated" 
];

function get_channel1(link) {
  const matches = link.trim().match(/\/ch[0-9]+\//g);
  if (!matches || matches.length === 0) return undefined;
  const num_str = matches[0].substring("/ch".length, matches[0].length-1);
  const num = parseInt(num_str);
  if (isNaN(num)) return undefined;
  return num;
}

function get_channel2(link) {
  const matches = link.trim().match(/channel=[0-9]+&/g);
  if (!matches || matches.length === 0) return undefined;
  const num_str = matches[0].substring("channel=".length, matches[0].length-1);
  const num = parseInt(num_str);
  if (isNaN(num)) return undefined;
  return num;
}

function get_channel3(link) {
  const matches = link.trim().match(/[0-9]+0[1-2]$/g);
  if (!matches || matches.length === 0) return undefined;
  const num_str = matches[0].substring(0, matches[0].length-2);
  const num = parseInt(num_str);
  if (isNaN(num)) return undefined;
  return num;
}

function get_channel4(link) {
  const matches = link.trim().match(/\/live$/g);
  if (!matches || matches.length === 0) return undefined;
  return 1;
}

function get_channel4(link) {
  const matches = link.trim().match(/\/live\/main$/g);
  if (!matches || matches.length === 0) return undefined;
  return 1;
}

function get_channel5(link) {
  const matches = link.trim().match(/\/live\/sub$/g);
  if (!matches || matches.length === 0) return undefined;
  return 1;
}

function get_channel6(link) {
  const matches = link.trim().match(/\/c[0-9]+\//g);
  if (!matches || matches.length === 0) return undefined;
  const num_str = matches[0].substring("/c".length, matches[0].length-1);
  const num = parseInt(num_str);
  if (isNaN(num)) return undefined;
  return num;
}

function get_channel7(link) {
  const matches = link.trim().match(/\/live1\.264$/g);
  if (!matches || matches.length === 0) return undefined;
  return 1;
}

function get_channel8(link) {
  const matches = link.trim().match(/chID=[0-9]+&/g);
  if (!matches || matches.length === 0) return undefined;
  const num_str = matches[0].substring("chID=".length, matches[0].length-1);
  const num = parseInt(num_str);
  if (isNaN(num)) return undefined;
  return num;
}

const channel_link_checkers = [
  get_channel1, get_channel2, get_channel3, get_channel4, get_channel5, get_channel6, get_channel7, get_channel8
];

function is_numeric(str) { return typeof str === "number" || (typeof str === "string" && /^\d+$/.test(str)); }
function parse_channel_id(link) {
  let channel_id = undefined;
  for (let i = 0; i < channel_link_checkers.length && typeof channel_id !== "number"; ++i) {
    const checker = channel_link_checkers[i];
    channel_id = checker(link);
  }
  return channel_id;
}

(async () => {
  const egsv = new egsv_api({
    host: process.env.EGSV_HOST,
    port: process.env.EGSV_PORT,
    user: process.env.EGSV_USER,
    pass: process.env.EGSV_PASS
  });

  const cams_list = await egsv.camera_list();
  //console.log(cams_list.cameras[0]);
  //const main_link = new URL(cams_list.cameras[0].url);
  //console.log(main_link);

  let create_count = 0;
  let update_count = 0;
  let counter = 0;
  for (const camera of cams_list.cameras) {
    let device_data = {};

    const main_link = new URL(camera.url);
    const sub_link = camera.secondary && camera.secondary.url ? new URL(camera.secondary.url) : undefined;

    // потом по таксономии можно поискать группу
    if (!camera.taxonomies || camera.taxonomies.length === 0) continue;

    let channel_id = parse_channel_id(camera.url);
    if (!channel_id && sub_link) channel_id = parse_channel_id(camera.secondary.url);
    if (!channel_id) {
      console.log(`Could not parse channel id from camera ${camera.name}, rtsp link: '${camera.url}'`);
      continue;
    }

    if (counter % 100 === 0) console.log(`Processed ${counter} devices`);
    counter += 1;

    //if (main_link.hostname !== "10.0.87.3") continue;

    device_data["archive"] = "";
    device_data["comment"] = "";
    device_data["sub_link"] = camera.secondary && camera.secondary.url ? camera.secondary.url : "";
    device_data["egsv_id"] = camera.id;
    device_data["type"] = "камера";
    device_data["channel_id"] = channel_id;
    device_data["rtsp_link"] = camera.url;
    device_data["egsv_server"] = camera.server;
    device_data["admin_login"] = main_link.username;
    device_data["admin_password"] = main_link.password;
    device_data["coords"] = camera.latlng && camera.latlng.length !== 0 ? camera.latlng.join(",") : "";
    const egsv_id = camera.id;
    const device = await db.find_device_by_ip_address(main_link.hostname);
    // если нашли устройство, то это может быть конкретная камера, она отдельно была выведена в пртг
    if (device && device.type === "камера") {
      if (device.rtsp_link && device.rtsp_link !== "") {
        console.log(`Found camera duplicate ${device.id} ${main_link.hostname}`);
        continue;
      }

      // что тут нужно сделать? найти родительское устройство (если оно есть), и обновить данные
      // наверное пока что просто обновим что есть, родительское устройство найти сложновато
      device_data["id"] = device.id;

      if (device.parend_id === 0) {
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
          if (pdevice) device_data["parent_id"] = pdevice.id;
        }
      }

      await db.update_device(device_data);
      //console.log("update", device_data);
      update_count += 1;
      continue;
    } 

    if (device && device.type === "рег") {
      
      device_data["parent_id"] = device.id;
      device_data["group_id"] = device.group_id;
      device_data["ip_address"] = "local";
    } else if (!device) {
      // если не нашли, то существует маленькая вероятность что рег не задан в пртг
      // как найти объект к которому относится камера? парсить название
      // еще было бы неплохо проверить есть ли камера во вторичном потоке
      const device_sub = sub_link ? await db.find_device_by_ip_address(sub_link.hostname) : undefined;
      if (device_sub) {
        //const device = await db.find_device_by_ip_address(sub_link.hostname);
        if (device_sub && device_sub.type === "камера") {
          console.log(`Found camera duplicate ${device_sub.id} ${sub_link.hostname} by sublink`);
          continue;
        } 

        if (device_sub && device_sub.type !== "рег") {
          console.log(`Found another device ${device_sub.id} type '${device_sub.type}' at ${sub_link.hostname} by sublink`);
          continue;
        }

        device_data["parent_id"] = device_sub.id;
        device_data["group_id"] = device_sub.group_id;
        device_data["ip_address"] = "local";
      } else {
        const name_parts = camera.name.trim().split("_");
        const raw_object_id = name_parts[0];
        let object_id = "";
        if (raw_object_id[0] === "0") {
          object_id = raw_object_id.substring(1);
        } else {
          object_id = raw_object_id;
        }

        const group = await db.find_group_by_object_id(object_id);
        if (!group) {
          console.log(`Could not find by id ${object_id} from camera name ${camera.name}`);
          continue;
        }

        const device = await db.find_device_by_group_id_type_channel_id(group.id, "рег", 0);
        if (device) device_data["parent_id"] = device.id;
        device_data["group_id"] = group.id;
        device_data["ip_address"] = main_link.hostname;
      }
    }

    if (device && device.type !== "рег" && device.type !== "камера") {
      console.log(`Found another device ${device.id} type '${device.type}' at ${main_link.hostname}`);
      continue;
    }

    await db.create_device(device_data);
    //console.log("create", device_data);
    create_count += 1;
  }

  console.log(`Created ${create_count} cameras, updated ${update_count} cameras`);

  await db.close_connection();
})();