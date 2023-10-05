require("dotenv").config();
const db = require("./apis/db");
const axios = require("axios");
const dahua = require("./apis/dahua");
const hikvision = require("./apis/hikvision");
const trassir = require("./apis/trassir");
const egsv_api = require("./apis/egsv");
const prtg_api = require("./apis/prtg");

// надо дропнуть comment у групп и добавить маску и диапазон ip

const prtg = new prtg_api({
  host: process.env.PRTG_HOST,
  port: process.env.PRTG_PORT,
  user: process.env.PRTG_USER,
  hash: process.env.PRTG_HASH,
});

const is_empty = (obj) => (obj && Object.keys(obj).length === 0) || !obj ? true : false;

const object_tags_to_human = {
  "router": "роутер",
  "cam": "камера",
  "button": "кнопка",
  "nvr": "рег",
};

async function parse_concrete_object_info(parent_id, info) {
  // лучше наверное использовать теги, предполагаем что используемый тег один
  // const tags = info.tags.trim().toLowerCase().split(" ");
  // let final_type = "";
  // for (const tag of tags) {
  //   if (!object_tags_to_human[tag]) continue;
  //   final_type = object_tags_to_human[tag];
  //   break;
  // }

  // if (final_type === "") {
  //   let name_split = info.name.trim().split(" ");
  //   name_split.shift();
  //   final_type = name_split.join(" ");
  // }

  // //console.log(info);
  // let device_data = {
  //   comment: "",
  //   archive: "",
  //   rtsp_link: "",
  //   name: info.name,

  //   group_id: parent_id,
  //   prtg_id: info.id,
  //   ip_address: info.host,
  //   type: final_type,
  // };

  // //console.log(device_data);
  // let device_id = 0;
  // const device = await db.find_device_by_ip_address(info.host);
  // if (device) { 
  //   device_id = device.id;
  //   device_data.id = device.id;
  //   await db.update_device(device_data);
  //   console.log(`Device updated ${device_id} ${info.name}`);
  // } else {
  //   device_id = await db.create_device(device_data);
  //   console.log(`Device created ${device_id} ${info.name}`);
  // }

  //const index = info.name.indexOf("кнопка STRAZH");
  //if (index === -1) return;

  // зададим теги для устройства
  // if (typeof info.tags === "string" && new Set(info.tags.split(" ")).has("STRAZH")) return;
  // const new_tags = typeof info.tags === "string" ? info.tags+` STRAZH` : `BUTTON STRAZH`;
  // console.log(`Set new tags '${new_tags}' to device ${info.id}`);
  // await prtg.set_property(info.id, "tags", new_tags);
}

async function parse_object_info(parent_id, info) {
  let name_split = info.name.trim().split(" ");
  const object_id = name_split[0];
  name_split.shift();
  const final_name = name_split.join(" ");
  //console.log(final_name);

  // let group_data = {
  //   description: "",
  //   comment: "",

  //   parent_id,
  //   object_id,
  //   prtg_id: info.id,
  //   name: final_name,
  //   type: "объект",
  // };

  // if (object_id === "12031" || object_id === "12079") {
  //   console.log(group_data);
  // }

  //console.log(group_data);
  // let object_group_id = 0;
  // const group = await db.find_group_by_object_id(object_id);
  // if (group) { 
  //   group_data.id = group.id;
  //   object_group_id = group.id;
  //   await db.update_group(group_data); 
  //   console.log(`Group updated ${object_group_id} ${final_name}`);
  // } else {
  //   object_group_id = await db.create_group(group_data);
  //   console.log(`Group created ${object_group_id} ${final_name}`);
  // }

  // зададим теги для объекта
  // if (typeof info.tags === "string" && new Set(info.tags.split(" ")).has("object")) return;
  // const new_tags = typeof info.tags === "string" ? info.tags+` object ${object_id}` : `object ${object_id}`;
  // console.log(`Set new tags '${new_tags}' to group ${info.id}`);
  // await prtg.set_property(info.id, "tags", new_tags);

  if (info.device["0"]) {
    for (const [ key, concrete_object_info ] of Object.entries(info.device)) {
      await parse_concrete_object_info(1, concrete_object_info);
    }
  } else {
    await parse_concrete_object_info(1, info.device);
  }
}

(async () => {

  const prtg_list = await prtg.sensors_tree();

  //console.log(prtg_list);
  //console.log(prtg_list.sensortree.nodes.group.probenode.group["6"].group["1"].device);
  //console.log(prtg_list.sensortree.nodes.group.probenode);
  //console.log(prtg_list.sensortree.nodes.group.probenode.group["6"].group["1"]);

  const root_group = prtg_list.sensortree.nodes.group.probenode;
  for (const [ key, group_info ] of Object.entries(root_group.group)) {
    if (!group_info.group) {
      //console.log(group_info.name);
      continue;
    }

    // const group_data = {
    //   description: "",
    //   comment: "",

    //   parent_id: 97, // Акмолинская область
    //   prtg_id: group_info.id,
    //   name: group_info.name,
    //   type: "группа",
    // };

    // //console.log(group_data);
    // let group_id = 0;
    // const group = await db.find_group_by_prtg_id(group_info.id);
    // if (group) {
    //   group_data.id = group.id;
    //   group_id = group.id;
    //   await db.update_group(group_data);
    //   console.log(`Group updated ${group_id} ${group_info.name}`);
    // } else {
    //   group_id = await db.create_group(group_data);
    //   console.log(`Group created ${group_id} ${group_info.name}`);
    // }

    // тут сейчас мы пробежимся по всем группам и распарсим имена чтобы было удобно потом брать по тегам
    // что делать с группами районов? придется ручками задавать, надо хотя бы тег регион задать

    //if (typeof group_info.tags === "string" && new Set(group_info.tags.split(" ")).has("region")) continue;
    //const new_tags = typeof group_info.tags === "string" ? group_info.tags+" region" : "region";
    //console.log(`Set new tags '${new_tags}' to group ${group_info.id}`);
    //await prtg.set_property(group_info.id, "tags", new_tags);

    if (group_info.group["0"]) {
      for (const [ key, object_info ] of Object.entries(group_info.group)) {
        await parse_object_info(1, object_info);
      }
    } else {
      await parse_object_info(1, group_info.group);
    }
  }

  //await db.close_connection();
})();