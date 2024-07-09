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

const filename = "devices.xlsx";
const devices_file = xlsx.parse(filename);
//console.log(devices_file);
const schools = devices_file[1]; // данные по школам
const computed_length = schools.data.reduce((accumulator, row) => row[0] ? accumulator + 1 : accumulator, 0);
console.log(computed_length);

function is_numeric(str) { return /^\d+$/.test(str); }

let xlsx_out = [
  [ "№", "Наименование организации образования",  "Оператор связи",  "IP адрес",  "логин", "Пароль",  "Подключено камер",  "Состояние", "Статус", "Производитель", "NVR" ]
];

async function compute_info(row) {
  const [ num, name, coords, net_provider, address, login, password, cameras_count ] = row;

  const hikvision_dev = new hikvision({
    host: address,
    port: 80,
    user: login,
    pass: password
  });

  const dahua_dev = new dahua({
    host: address,
    port: 80,
    user: login,
    pass: password
  });

  try {
    const [ hikvision_info, dahua_info ] = await Promise.all([ hikvision_dev.device_info(), dahua_dev.device_info() ]);
    if (hikvision_info.status.code === 200) {
      console.log(address, "Hikvision");
      return [
        num, name, net_provider, address, login, password, cameras_count, "Работает", "Доступен", "Hikvision", hikvision_info.data.type+" "+hikvision_info.data.model
      ];
    }

    if (hikvision_info.status.code === 401) {
      console.log(address, "Hikvision");
      return [
        num, name, net_provider, address, login, password, cameras_count, "Неверный логин/пароль", "Доступен", "Hikvision", ""
      ];
    }

    if (dahua_info.status.code === 200) {
      console.log(address, "Dahua");
      return [
        num, name, net_provider, address, login, password, cameras_count, "Работает", "Доступен", "Dahua", dahua_info.data.type+" "+dahua_info.data.model
      ];
    }

    if (dahua_info.status.code === 401) {
      console.log(address, "Dahua");
      return [
        num, name, net_provider, address, login, password, cameras_count, "Неверный логин/пароль", "Доступен", "Dahua", ""
      ];
    }

    console.log(address, "Other");
    return [];
  } catch (e) {
    console.log(e);
    return [];
  }
}

async function get_devices_info(xlsx_arr, out_arr) { // device_func, provider
  let promises_arr = [];
  for (let i = 0; i < xlsx_arr.length; ++i) {
    const row = xlsx_arr[i];
    promises_arr.push(42);
    if (!row[0]) continue;
    if (!is_numeric(row[0])) continue;

    const [ num, name, coords, net_provider, address, login, password, cameras_count ] = row;
    if (typeof login !== "string" || (typeof login === "string" && login.trim() === "")) continue;
    if (typeof password !== "string" || (typeof password === "string" && password.trim() === "")) continue;

    if (net_provider.trim() !== "Сапа Телеком") continue;

    // const dev = new device_func({
    //   host: address,
    //   port: 80,
    //   user: login,
    //   pass: password
    // });

    //const info = await dev.device_info();
    //promises_arr.push(dev.device_info());
    //promises_arr[promises_arr.length-1] = dev.device_info();
    promises_arr[promises_arr.length-1] = compute_info(row);
    //console.log(info);
  }

  console.log(promises_arr.length);
  const data_arr = await Promise.all(promises_arr);
  for (let i = 0; i < xlsx_arr.length; ++i) {
    const row = xlsx_arr[i];
    if (typeof data_arr[i] === "number") continue;
    //if (!row[0]) continue;
    //if (!is_numeric(row[0])) continue;

    const [ num, name, coords, net_provider, address, login, password, cameras_count ] = row;


    const info = data_arr[i];
    //console.log(info);
    // if (info.status.code === 200) {
    //   out_arr[i] = [
    //     num, name, net_provider, address, login, password, cameras_count, "Работает", "Доступен", provider, info.data.type+" "+info.data.model
    //   ];
    // } else if (info.status.code === 401) {
    //   out_arr[i] = [
    //     num, name, net_provider, address, login, password, cameras_count, "Неверный логин/пароль", "Доступен", provider, ""
    //   ];
    // }

    out_arr[i] = info;
  }
}

async function check_connection(xlsx_arr) {
  let connections = [
    [ "name", "provider", "address", "manufacturer", "provider status", "availability", "status", "status_code", "subnet" ]
  ];

  let data = {};
  let promises_arr = [];
  for (const row of xlsx_arr) {
    if (!row[0]) continue;
    if (!is_numeric(row[0])) continue;

    const [ num, name, coords, net_provider, address, login, password, cameras_count, status, type, status2, manufacturer ] = row;
    if (!address) continue;

    if (data[address]) throw `${address} found at least two times`;

    const timeout = 60000;
    const url = `http://${address}:80`;
    let promise = (async () => { try { return await axios.get(url, { insecureHTTPParser: true, timeout, signal: AbortSignal.timeout(timeout) }); } catch(e) { return e; } })();
    data[address] = { num, name, net_provider, address, login, password, cameras_count, promise_index: promises_arr.length, manufacturer, status, status2 };
    //console.log(url);
    promises_arr.push(promise);
  }

  console.log("promise");
  const resp_arr = await Promise.all(promises_arr);
  console.log("resp");
  //const resp_arr = promises_arr;
  for (const [ address, values ] of Object.entries(data)) {
    //const resp = await values.promise;
    const resp = resp_arr[values.promise_index];
    //console.log(resp);

    if (resp.status) {
      connections.push([  
        values.name, values.net_provider, values.address, values.manufacturer, values.status, values.status2, "Ok", resp.status
      ]);
    } else {
      connections.push([  
        values.name, values.net_provider, values.address, values.manufacturer, values.status, values.status2, "Timeout", resp.errno
      ]);
    }
  }

  return connections;
}

let make_rtsp_link = {
  "Hikvision": (username, password, address, index) => {
    const username1 = username ? username : "";
    const password1 = password ? password : "";
    if (!address) throw `address udefined`;
    return [ 
      `rtsp://${username1}:${password1}@${address}:554/ISAPI/Streaming/Channels/${index+1}01`,
      `rtsp://${username1}:${password1}@${address}:554/ISAPI/Streaming/Channels/${index+1}02`
    ];
  },
  "Dahua": (username, password, address, index) => {
    const username1 = username ? username : "";
    const password1 = password ? password : "";
    if (!address) throw `address udefined`;
    return [ 
      `rtsp://${username1}:${password1}@${address}:554/cam/realmonitor?channel=${index+1}&subtype=0`,
      `rtsp://${username1}:${password1}@${address}:554/cam/realmonitor?channel=${index+1}&subtype=1`,
    ];
  },
  "Polyvision": (username, password, address, index) => {
    const username1 = username ? username : "";
    const password1 = password ? password : "";
    if (!address) throw `address udefined`;
    return [ 
      `rtsp://${address}:554/user=${username1}&password=${password1}&channel=${index+1}&stream=00.sdp`,
      `rtsp://${address}:554/user=${username1}&password=${password1}&channel=${index+1}&stream=10.sdp`
    ];
  },
  "Herospeed": (username, password, address, index) => {
    const username1 = username ? username : "";
    const password1 = password ? password : "";
    if (!address) throw `address udefined`;
    return [ 
      `rtsp://${username1}:${password1}@${address}:554/${index+1}0`,
      `rtsp://${username1}:${password1}@${address}:554/${index+1}1`
    ];
  },
};

function load_taxonomies() {
  const taxonomies = xlsx.parse("taxonomies.xlsx");
  let obj = {};
  for (const row of taxonomies[0].data) {
    if (typeof row[0] !== "string") continue;
    if (row[0] === "name") continue;

    const [ name, id, parent_id ] = row;
    obj[name] = { id, parent_id };
  }

  return obj;
}

function load_taxonomies() {
  const taxonomies = xlsx.parse("taxonomies.xlsx");
  let obj = {};
  for (const row of taxonomies[0].data) {
    if (typeof row[0] !== "string") continue;
    if (row[0] === "name") continue;

    const [ name, id, parent_id ] = row;
    obj[name] = { id, parent_id };
  }

  return obj;
}

function load_taxonomies2() {
  const taxonomies = xlsx.parse("taxonomies2.xlsx");
  let obj = {};
  for (const row of taxonomies[0].data) {
    if (typeof row[0] !== "string") continue;
    if (row[0] === "name") continue;

    const [ name, id, parent_id ] = row;
    obj[name] = { id, parent_id };
  }

  return obj;
}

function make_good_num(num) {
  return num < 10 ? "0"+num : ""+num;
}

(async () => {
  // проверим сначала один тип оборудования, потом другой
  for (const row of schools.data) {
    xlsx_out.push([]);
  }  

  // await get_devices_info(schools.data, xlsx_out, hikvision, "Hikvision");
  // console.log("Hikvision");
  // await get_devices_info(schools.data, xlsx_out, dahua, "Dahua");
  // console.log("Dahua");
  //await get_devices_info(schools.data, xlsx_out);

  //console.log(xlsx_out);
  //const buffer = xlsx.build([{name: 'list1', data: xlsx_out}]);
  //fs.writeFileSync("devices_out2.xlsx", buffer);

  // const subnets = [ new subnet("192.12.0.0/16"), new subnet("192.10.0.0/16"), new subnet("10.2.0.0/17"), new subnet("10.20.0.0/16"), new subnet("192.11.0.0/16"), new subnet("192.180.0.0/16") ];

  // let connections = await check_connection(schools.data);
  // for (let i = 1; i < connections.length; ++i) {
  //   const [ name, provider,  address, manufacturer,  status,  status_code ] = connections[i];
  //   for (const net of subnets) {
  //     if (!net.include(address)) continue;
  //     connections[i].push(net.toString());
  //     break;
  //   }
  // }
  // const buffer = xlsx.build([{name: 'list1', data: connections}]);
  // fs.writeFileSync("devices_connections.xlsx", buffer);

  // const egsv = new egsv_api({
  //   host: process.env.EGSV_HOST2,
  //   port: process.env.EGSV_PORT2,
  //   user: process.env.EGSV_USER2,
  //   pass: process.env.EGSV_PASS2
  // });

  //const resp = await egsv.create_taxonomy("test2", "651ba8836dc7712e12c20e21");
  //console.log(resp);
  //console.log(resp.taxonomy.name, resp.taxonomy.id);
  // for (const row of schools.data) {
  //   if (typeof row[0] !== "string" && typeof row[0] !== "number") continue;
  //   if (row[0] === "№") continue;
  //   if (typeof row[1] !== "string") {
  //     //console.log(row);
  //     continue;
  //   }

  //   const obj_name = row[1].trim();
  //   try {
  //     const resp = await egsv.create_taxonomy(obj_name, "651ba8836dc7712e12c20e21");
  //     taxonomies.push([ resp.taxonomy.name, resp.taxonomy.id ]);
  //   } catch (e) {

  //   }
  // }

  //let taxonomies = [ [ "name", "id", "parent_id" ] ];
  //const list = await egsv.taxonomy_list();
  //console.log(list);
  // for (const taxonomy of list.taxonomies) {
  //   taxonomies.push([ taxonomy.name, taxonomy.id, taxonomy.parent ]);
  // }

  //const buffer = xlsx.build([{name: 'list1', data: taxonomies}]);
  //fs.writeFileSync("taxonomies.xlsx", buffer);

  // {
  // let full_device_data = {};
  // for (const dev_data of schools.data) {
  //   const [ num, name, coords, net_provider, address, login, password, cameras_count, status, type, status2, manufacturer ] = dev_data;
  //   if (!address) continue;
  //   if (full_device_data[address]) throw `Double ${address}`;
  //   full_device_data[address] = { num, name, coords, net_provider, address, login, password, cameras_count, status, type, status2, manufacturer };
  // }

  // let xlsx_out2 = [ [ "№", "Наименование организации образования",  "Оператор связи",  "IP адрес",  "логин", "Пароль",  "Подключено камер",  "Состояние", "Статус", "Производитель", "NVR" ] ];
  // const known_devices = xlsx.parse("devices_connections.xlsx");
  // for (const known_device_data of known_devices[0].data) {
  //   const [ name,  provider,  address, manufacturer, provider_status, availability,  status,  status_code, subnet, manufacturer2 ] = known_device_data;
  //   if (typeof manufacturer2 !== "string" || (typeof manufacturer2 === "string" && manufacturer2 === "")) continue;
  //   if (!make_rtsp_link[manufacturer2]) continue;

  //   const dev_data = full_device_data[address];
  //   if (!dev_data) throw `Could not find ${address}`;

  //   let model_str = "";
  //   let status_code2 = 200;
  //   if (manufacturer2 === "Hikvision") {
  //     const dev = new hikvision({ host: address, port: 80, user: dev_data.login, pass: dev_data.password });
  //     const resp = await dev.device_info();
  //     model_str = resp.data ? resp.data.type+" "+resp.data.model : "";
  //     status_code2 = resp.status.code;
  //   } else if (manufacturer2 === "Dahua") {
  //     const dev = new dahua({ host: address, port: 80, user: dev_data.login, pass: dev_data.password });
  //     const resp = await dev.device_info();
  //     model_str = resp.data ? resp.data.type+" "+resp.data.model : "";
  //     status_code2 = resp.status.code;
  //   }

  //   xlsx_out2.push([
  //     1, dev_data.name, dev_data.net_provider, dev_data.address, dev_data.login, dev_data.password, dev_data.cameras_count, "Доступен", "", manufacturer2, model_str, status_code2
  //   ]);
  // }
  // const buffer = xlsx.build([{name: 'list1', data: xlsx_out2}]);
  // fs.writeFileSync("devices_out2.xlsx", buffer);
  // }

  // {
  // let egsv_camera_data = [ [ "name", "desc", "url1", "url2", "archive", "days", "ignore", "ignore", "ignore", "ignore", "ignore", "ignore", "ignore", "ignore", "ignore", "taxonomy" ] ];
  // const taxonomy = load_taxonomies();
  // const known_devices = xlsx.parse("devices_out2.xlsx");
  // for (const row of known_devices[0].data) {
  //   if (typeof row[0] !== "string" && typeof row[0] !== "number") continue;
  //   if (row[0] === "№") continue;
  //   if (typeof row[1] !== "string") continue;

  //   const [ num, org, provider, address, username, password, cameras_count, status, status2, company, model ] = row;
  //   for (let i = 0; i < cameras_count; ++i) {
  //     const func = make_rtsp_link[company];
  //     if (!func) throw `Could not find company '${company}'`;
  //     const t = taxonomy[org.trim()];
  //     if (!t) throw `Could not find taxonomy '${org.trim()}'`;

  //     const [ link1, link2 ] = func(username, password, address, i);
  //     egsv_camera_data.push([ `cam${make_good_num(i+1)}`, org.trim(), link1, link2, "true", 3, "", "", "", "", "", "", "", "", "", t.id, status ]);
  //   }

  //   egsv_camera_data.push([]);
  // }

  // const buffer = xlsx.build([{name: 'list1', data: egsv_camera_data}]);
  // fs.writeFileSync("known_devices_egsv_data.xlsx", buffer);
  // }

  // for (const row of schools.data) {
  //   const [ num, name, coords, net_provider, address, login, password, cameras_count, status, type, status2, manufacturer ] = row;
  //   if (!manufacturer || manufacturer !== "Hikvision") continue;
  //   if (!status2 || status2 !== "Доступен") continue;
  //   if (!address) continue;
  //   if (!login) continue;
  //   if (!password) continue;

  //   const device = new hikvision({ host: address, port: 80, user: login, pass: password });
  //   //const resp = await device.streaming_params(101);
  //   let resp = {};
  //   for (let i = 0; i < cameras_count; ++i) {
  //     const channel_id = `${i+1}01`;
  //     resp = await device.set_streaming_params(channel_id, 1280, 720, 1024, 15);
  //     if (resp.status.code !== 200) break;
  //     const sub_channel_id = `${i+1}02`;
  //     resp = await device.set_streaming_params(sub_channel_id, 352, 288, 512, 15);
  //     //break;
  //   }
  //   //console.log(resp.status);
  //   console.log(num,"|",name,"|",address,"|",resp.status);
  //   //break;
  // }

  const egsv = new egsv_api({
    host: process.env.EGSV_HOST2,
    port: process.env.EGSV_PORT2,
    user: process.env.EGSV_USER2,
    pass: process.env.EGSV_PASS2
  });

  // let provider_school = {};
  // for (const row of schools.data) {
  //   if (!row[0]) continue;
  //   if (!is_numeric(row[0])) continue;

  //   const [ num, name, coords, net_provider, address, login, password, cameras_count, status, type, status2, manufacturer ] = row;
  //   if (!provider_school[net_provider]) provider_school[net_provider] = [];
  //   provider_school[net_provider].push({
  //     num, name, coords, net_provider, address, login, password, cameras_count, status, type, status2, manufacturer
  //   });
  // }

  // let unique_list = {};
  // let taxonomies2 = [ [ "name", "id", "parent_id" ] ];
  // const resp1 = await egsv.create_taxonomy("Школы (по провайдерам)");
  // const main_tax = { name: resp1.taxonomy.name, id: resp1.taxonomy.id };
  // taxonomies2.push( [ resp1.taxonomy.name, resp1.taxonomy.id ] );
  // const known_taxonomies = xlsx.parse("taxonomies.xlsx");
  // for (const [ net_provider, obj_arr ] of Object.entries(provider_school)) {
  //   const resp1 = await egsv.create_taxonomy(net_provider, main_tax.id);
  //   const net_provider_tax = { name: resp1.taxonomy.name, id: resp1.taxonomy.id };
  //   taxonomies2.push( [ net_provider_tax.name, net_provider_tax.id, main_tax.id ] );
  //   console.log(net_provider_tax.name);
  //   for (const obj of obj_arr) {
  //     if (unique_list[obj.name]) continue;
  //     unique_list[obj.name] = true;

  //     const resp1 = await egsv.create_taxonomy(obj.name, net_provider_tax.id);
  //     const tax = { name: resp1.taxonomy.name, id: resp1.taxonomy.id };
  //     taxonomies2.push( [ tax.name, tax.id, net_provider_tax.id ] );
  //   }
  // }

  // const buffer = xlsx.build([{name: 'list1', data: taxonomies2}]);
  // fs.writeFileSync("taxonomies2.xlsx", buffer);

  // const taxes = load_taxonomies();
  // const taxes2 = load_taxonomies2();
  // const list = await egsv.camera_list();
  // let counter = 0;
  // for (const camera of list.cameras) {
  //   if (camera.taxonomies.length === 0) continue;
  //   //console.log(camera);
  //   //console.log(taxes[camera.data.description]);
  //   //console.log(taxes2[camera.data.description]);
  //   const tax1 = taxes[camera.data.description];
  //   const tax2 = taxes2[camera.data.description];
  //   if (!tax1 || !tax2) { console.log(`Not found ${camera.data.description}`); continue; }
  //   const data = { id: camera.id, taxonomies: [ tax1.id, tax2.id ] };
  //   await egsv.update_camera(data);
  //   ++counter;

  //   //break;
  // }

  // console.log(`Updated ${counter} cameras, cameras count ${list.cameras.length}`);

  let links = [];
  for (const row of devices_file[0].data) {
    if (!row[0]) continue;
    if (!subnet.is_ip_address(row[6])) continue;

    const [ num, name, desc, city, link1, address, camera_address, link2, openvpn, coords ] = row;
    const ls = make_rtsp_link["Dahua"]("admin", "adm12345", camera_address, 0);
    links.push([ name+" "+desc, desc, ls[0], ls[1], coords ]);
  }

  const buffer = xlsx.build([{name: 'list1', data: links}]);
  fs.writeFileSync("view_cameras.xlsx", buffer);

  //await db.close();
})();