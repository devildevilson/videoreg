require("dotenv").config();
const db = require("./apis/db");
const axios = require("axios");
const dahua = require("./apis/dahua");
const hikvision = require("./apis/hikvision");
const trassir = require("./apis/trassir");
const egsv_api = require("./apis/egsv");
const prtg_api = require("./apis/prtg");
const xlsx = require("node-xlsx");
const subnet = require("./apis/subnet");

// const file_name = "для_виктора.xlsx";
// const file_data = xlsx.parse(file_name);

const ip_regex = /^((25[0-5]|(2[0-4]|1[0-9]|[1-9]|)[0-9])(\.(?!$)|$)){4}$/;
const is_ip_address = str => ip_regex.test(str);
const good_num = (num) => num < 10 ? "0"+num : ""+num;

// как найти группу в пртг по имени?
const object_id = "12085";
const prtg_group_id = 2978; // object
const prtg_copy_object = 4107; // camera
const devices = `
10.29.10.131 CAM
10.29.10.132 CAM
10.29.10.133 CAM
10.29.10.134 CAM
10.29.10.135 CAM
10.29.10.136 CAM
10.29.10.137 CAM
10.29.10.138 CAM
10.29.10.139 CAM
10.29.10.140 CAM
10.29.10.141 CAM
10.29.10.142 CAM
10.29.10.143 CAM
10.29.10.144 CAM
10.29.10.145 CAM
10.29.10.146 CAM
10.29.10.147 CAM
10.29.10.148 CAM
10.29.10.149 CAM
10.29.10.150 CAM
10.29.10.151 CAM
`;

(async () => {
  const prtg = new prtg_api({
    host: process.env.PRTG_HOST,
    port: process.env.PRTG_PORT,
    user: process.env.PRTG_USER,
    hash: process.env.PRTG_HASH,
  });

  const list = devices.split("\n");
  for (const camera_name of list) {
    const cam_name_final = camera_name.trim();
    if (cam_name_final === "") continue;

    const space_index = cam_name_final.indexOf(" ");
    const ip_address = cam_name_final.substring(0, space_index);
    const tags = cam_name_final.substring(space_index+1);
    //console.log(ip_address,",",tags);
    const id = await prtg.add_device(prtg_group_id, cam_name_final, ip_address, prtg_copy_object);
    await prtg.resume_object(id);
    console.log(`Created camera ${id} ${cam_name_final}`);
  }

  // let counter = 0;
  // for (const row of file_data[0].data) {
  //   const camera_host = row[0];
  //   if (!camera_host || camera_host === "") { counter = 0; continue; }
  //   if (!is_ip_address(camera_host.trim())) { counter = 0; continue; }
  //   counter += 1;
  //   // если адрес задан не был то пропускаем
  //   if (!row[1] || row[1] === "") continue;

  //   const camera_device = await prtg.find_device_by_host(camera_host.trim());
  //   if (camera_device) {
  //     // если такая камера уже существует то пропускаем
  //     // надо ее переназвать
  //     const new_name = camera_host.trim() + " CAM" + good_num(counter);
  //     console.log("new_name:",new_name);
  //     await prtg.set_property(camera_device.objid, "name", new_name);
  //     continue;
  //   } 

  //   const group_subnet = new subnet(camera_host.trim()+"/25");
  //   const router_host = group_subnet.at(0);

  //   const device = await prtg.find_device_by_host(router_host);
  //   //console.log(device);
  //   const group = await prtg.find_group(device.parentid);
  //   //console.log(group);
  //   const object_id = group.name.split(" ", 1)[0];
  //   console.log(`Found router '${device.name}' and group '${object_id}'`);

  //   const cam_name_final = camera_host.trim() + " CAM" + good_num(counter);
  //   const id = await prtg.add_device(group.objid, cam_name_final, camera_host.trim(), prtg_copy_object);
  //   await prtg.resume_object(id);
  //   //const id = 1;
  //   console.log(`Created camera ${id} '${cam_name_final}'`);
  //   //break;
  // }
})();
