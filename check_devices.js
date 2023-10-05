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
const schools = devices_file[2]; // данные по школам
const computed_length = schools.data.reduce((accumulator, row) => row[0] ? accumulator + 1 : accumulator, 0);
console.log(computed_length);

function is_numeric(str) { return /^\d+$/.test(str); }

let xlsx_out = [
  [ "№", "Наименование организации образования",  "Оператор связи",  "IP адрес",  "логин", "Пароль",  "Подключено камер",  "Состояние", "Статус", "Производитель", "NVR" ]
];

async function get_devices_info(xlsx_arr, out_arr, device_func, provider) {
  let promises_arr = [];
  for (let i = 0; i < xlsx_arr.length; ++i) {
    const row = xlsx_arr[i];
    promises_arr.push(42);
    if (!row[0]) continue;
    if (!is_numeric(row[0])) continue;

    const [ num, name, net_provider, address, login, password, cameras_count ] = row;
    if (typeof login !== "string" || (typeof login === "string" && login.trim() === "")) continue;
    if (typeof password !== "string" || (typeof password === "string" && password.trim() === "")) continue;

    const dev = new device_func({
      host: address,
      port: 80,
      user: login,
      pass: password
    });

    //const info = await dev.device_info();
    //promises_arr.push(dev.device_info());
    promises_arr[promises_arr.length-1] = dev.device_info();
    //console.log(info);
  }

  console.log(promises_arr.length);
  const data_arr = await Promise.all(promises_arr);
  for (let i = 0; i < xlsx_arr.length; ++i) {
    const row = xlsx_arr[i];
    if (typeof data_arr[i] === "number") continue;
    //if (!row[0]) continue;
    //if (!is_numeric(row[0])) continue;

    const [ num, name, net_provider, address, login, password, cameras_count ] = row;


    const info = data_arr[i];
    console.log(info);
    if (info.status.code === 200) {
      out_arr[i] = [
        num, name, net_provider, address, login, password, cameras_count, "Работает", "Доступен", provider, info.data.type+" "+info.data.model
      ];
    } else if (info.status.code === 401) {
      out_arr[i] = [
        num, name, net_provider, address, login, password, cameras_count, "Неверный логин/пароль", "Доступен", provider, ""
      ];
    }
  }
}

async function check_connection(xlsx_arr) {
  let connections = [
    [ "name", "provider", "address", "status", "status_code" ]
  ];

  let data = {};
  let promises_arr = [];
  for (const row of xlsx_arr) {
    if (!row[0]) continue;
    if (!is_numeric(row[0])) continue;

    const [ num, name, net_provider, address, login, password, cameras_count ] = row;
    if (!address) continue;

    if (data[address]) throw `${address} found at least two times`;

    const promise = (async () => { try { return await axios.get(`http://${address}:80`, { insecureHTTPParser: true }); } catch(e) { return e; } })();
    data[address] = { num, name, net_provider, address, login, password, cameras_count, promise };
    promises_arr.push(promise);
  }

  const resp_arr = await Promise.all(promises_arr);
  for (const [ address, values ] of Object.entries(data)) {
    const resp = await values.promise;
    //console.log(resp);

    if (resp.status) {
      connections.push([  
        values.name, values.net_provider, values.address, "Ok", resp.status
      ]);
    } else {
      connections.push([  
        values.name, values.net_provider, values.address, "Timeout", resp.errno
      ]);
    }
  }

  return connections;
}

let make_rtsp_link = {
  "Hikvision": (username, password, address, index) => {
    return [ 
      `rtsp://${username}:${password}@${address}:554/ISAPI/Streaming/Channels/${index+1}01`, 
      `rtsp://${username}:${password}@${address}:554/ISAPI/Streaming/Channels/${index+1}02`
    ];
  },
  "Dahua": (username, password, address, index) => {
    return [ 
      `rtsp://${username}:${password}@${address}:554/cam/realmonitor?channel=${index+1}&subtype=0`,
      `rtsp://${username}:${password}@${address}:554/cam/realmonitor?channel=${index+1}&subtype=1`,
    ];
  },
  "Polyvision": (username, password, address, index) => {
    return [ 
      `rtsp://${address}:554/user=${username}&password=${password}&channel=${index+1}&stream=00.sdp`, 
      `rtsp://${address}:554/user=${username}&password=${password}&channel=${index+1}&stream=10.sdp`
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

function make_good_num(num) {
  return num < 10 ? "0"+num : ""+num;
}

(async () => {
  // проверим сначала один тип оборудования, потом другой
  // for (const row of schools.data) {
  //   xlsx_out.push([]);
  // }  

  // await get_devices_info(schools.data, xlsx_out, hikvision, "Hikvision");
  // await get_devices_info(schools.data, xlsx_out, dahua, "Dahua");

  // console.log(xlsx_out);
  // const buffer = xlsx.build([{name: 'list1', data: xlsx_out}]);
  // fs.writeFileSync("devices_out2.xlsx", buffer);

  //const connections = await check_connection(schools.data);
  //const buffer = xlsx.build([{name: 'list1', data: connections}]);
  //fs.writeFileSync("devices_connections.xlsx", buffer);

  const egsv = new egsv_api({
    host: process.env.EGSV_HOST2,
    port: process.env.EGSV_PORT2,
    user: process.env.EGSV_USER2,
    pass: process.env.EGSV_PASS2
  });

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

  let egsv_camera_data = [ [ "name", "desc", "url1", "url2", "archive", "days", "ignore", "ignore", "ignore", "ignore", "ignore", "ignore", "ignore", "ignore", "ignore", "taxonomy" ] ];
  const taxonomy = load_taxonomies();
  const known_devices = xlsx.parse("devices_out2.xlsx");
  for (const row of known_devices[0].data) {
    if (typeof row[0] !== "string" && typeof row[0] !== "number") continue;
    if (row[0] === "№") continue;
    if (typeof row[1] !== "string") continue;

    const [ num, org, provider, address, username, password, cameras_count, status, status2, company, model ] = row;
    for (let i = 0; i < cameras_count; ++i) {
      const func = make_rtsp_link[company];
      if (!func) throw `Could not find company '${company}'`;
      const t = taxonomy[org.trim()];
      if (!t) throw `Could not find taxonomy '${org.trim()}'`;

      const [ link1, link2 ] = func(username, password, address, i);
      egsv_camera_data.push([ `cam${make_good_num(i+1)}`, org.trim(), link1, link2, "true", 3, "", "", "", "", "", "", "", "", "", t.id, status ]);
    }

    egsv_camera_data.push([]);
  }

  const buffer = xlsx.build([{name: 'list1', data: egsv_camera_data}]);
  fs.writeFileSync("known_devices_egsv_data.xlsx", buffer);
})();
