require("dotenv").config();
const axios = require("axios");
const dahua = require("./apis/dahua");
const hikvision = require("./apis/hikvision");
const trassir = require("./apis/trassir");
const egsv_api = require("./apis/egsv");
const prtg_api = require("./apis/prtg");
const xlsx = require("node-xlsx");
const fs = require("fs");

async function device_is_dahua(url) {
  const ipreg = new dahua({
    host: url.hostname,
    port: 80,
    user: url.username,
    pass: url.password
  });

  return await ipreg.device_info();
}

async function device_is_hikvision(url) {
  const ipreg = new hikvision({
    host: url.hostname,
    port: 80,
    user: url.username,
    pass: url.password
  });

  return await ipreg.device_info();
}

function make_good_day_num(num) {
  return num < 10 ? "0"+num : ""+num;
}

function make_current_day_str() {
  const current_date = new Date();
  const month_str = make_good_day_num(current_date.getMonth()+1);
  const day_str = make_good_day_num(current_date.getDate());
  return `${current_date.getFullYear()}.${month_str}.${day_str}`;
}

let xlsx_data = [
  [ "№ объекта", "Описание", "IP", "Тип устройства", "Модель устройства", "Производитель" ]
];

(async () => {
  const egsv = new egsv_api({
    host: process.env.EGSV_HOST,
    port: process.env.EGSV_PORT,
    user: process.env.EGSV_USER,
    pass: process.env.EGSV_PASS
  });

  const prtg = new prtg_api({
    host: process.env.PRTG_HOST,
    port: process.env.PRTG_PORT,
    user: process.env.PRTG_USER,
    hash: process.env.PRTG_HASH,
  });

  //const cams_list = await egsv.camera_list();
  //const prtg_list = await prtg.sensors_tree();

  //console.log(prtg_list);
  //console.log(prtg_list.sensortree.nodes.group.probenode.group["6"].group["1"].device);

  //console.log("count:", cams_list.count);
  //console.log(cams_list.cameras[0]);
  //console.log(cams_list.cameras[1]);

  //const cam_url = new URL(cams_list.cameras[0].url);
  //console.log(cam_url);

  // надо сделать так чтобы среди всех производителей АПИ был максимально одинаковым + указать какой тип камеры

  {
    //const dev_url = new URL(cams_list.cameras[0].url);
    const device = new dahua({
      host: "10.0.114.131",
      port: 80,
      user: "admin",
      pass: "qwerty12345"
    });

    //const ret1 = await device.get_channel_title();
    //const ret2 = await device.get_system_info();
    //const ret1 = await device.get_caps(1);
    const ret1 = await device.get_device_type();
    console.log(ret1);
    //console.log(ret2.data);
  }

  // {
  //   //const dev_url = new URL(cams_list.cameras[0].url);
  //   const device = new trassir({
  //     host: "10.29.20.194",
  //     port: 8080,
  //     user: "aqmol",
  //     pass: "aqmol12345" // это пароль для специального пользователя, только его достаточно
  //   });

  //   //await device.login();
  //   //console.log(device.sid);
  //   const ret = await device.objects();
  //   console.log(ret);
  // }  

  // {
  //   //const dev_url = new URL(cams_list.cameras[0].url);
  //   //http://10.29.2.2/ISAPI/Streaming/channels/101/picture
  //   const device = new dahua({
  //     host: "10.29.18.68",
  //     port: 80,
  //     user: "aqmol",
  //     pass: "aqmol12345"
  //   });

  //   const ret1 = await device.picture(101);
  //   const date_str = make_current_day_str();
  //   const buffer = ret1;
  //   fs.writeFile(`pic1_${date_str}.jpg`, buffer, err => {
  //     if (err) { console.error(err); return; }
  //     console.log(`Success computing`);
  //   });
  // }

  // {
  //   //const dev_url = new URL(cams_list.cameras[0].url);
  //   //http://10.29.2.2/ISAPI/Streaming/channels/101/picture
  //   const device = new hikvision({
  //     host: "10.29.2.2",
  //     port: 80,
  //     user: "aqmol",
  //     pass: "aqmol12345"
  //   });

  //   const ret1 = await device.picture(101);
  //   const date_str = make_current_day_str();
  //   const buffer = ret1;
  //   fs.writeFile(`pic2_${date_str}.jpg`, buffer, err => {
  //     if (err) { console.error(err); return; }
  //     console.log(`Success computing`);
  //   });
  // }

  {
    //const dev_url = new URL(cams_list.cameras[0].url);
    //http://10.29.2.2/ISAPI/Streaming/channels/101/picture
    // const device = new trassir({
    //   host: "10.29.20.194",
    //   port: 8080,
    //   user: "aqmol",
    //   pass: "aqmol12345"
    // });

    // const ret1 = await device.object_data(201);
    // console.log(ret1);
    // const date_str = make_current_day_str();
    // const buffer = ret1;
    // fs.writeFile(`pic3_${date_str}.jpg`, buffer, err => {
    //   if (err) { console.error(err); return; }
    //   console.log(`Success computing`);
    // });
  }

  // let unique_device = new Set();
  // let dahua_promises = [];
  // let hikvision_promises = [];
  // let url_data = [];
  // for (const dev of cams_list.cameras) {
  //   const dev_url = new URL(dev.url);
  //   if (unique_device.has(dev_url.hostname)) continue;
  //   unique_device.add(dev_url.hostname);

  //   const code1_promise = device_is_dahua(dev_url);
  //   const code2_promise = device_is_hikvision(dev_url);
  //   dahua_promises.push(code1_promise);
  //   hikvision_promises.push(code2_promise);
  //   const desc = dev.data ? dev.data.description : "";
  //   url_data.push({ dev_url, name: dev.name, desc });
  // }

  // const dahua_codes = await Promise.all(dahua_promises);
  // const hikvision_codes = await Promise.all(hikvision_promises);
  // //assert(dahua_codes.length === hikvision_codes.length);
  // console.log(dahua_codes.length);

  // let dahua_counter = 0;
  // let hikvision_counter = 0;
  // let dev_types = [];
  // for (let i = 0; i < dahua_codes.length; ++i) {
  //   const { dev_url, name, desc } = url_data[i];
  //   const obj_num = name.split("_")[0];

  //   let valid_code = {};
  //   let device_vendor = "";
  //   if (dahua_codes[i].status.code === 200) {
  //     dahua_counter += 1;
  //     valid_code = dahua_codes[i];
  //     device_vendor = "dahua";
  //   } else if (hikvision_codes[i].status.code === 200) {
  //     hikvision_counter += 1;
  //     valid_code = hikvision_codes[i];
  //     device_vendor = "hikvision";
  //   } else {
  //     const dahua_str_code = `${dahua_codes[i].status.code} ${dahua_codes[i].status.desc}`;
  //     const hikvision_str_code = `${hikvision_codes[i].status.code} ${hikvision_codes[i].status.desc}`;
  //     xlsx_data.push([ obj_num, desc, dev_url.hostname, dahua_str_code, hikvision_str_code, "" ]);
  //     continue;
  //   }

  //   xlsx_data.push([ obj_num, desc, dev_url.hostname, valid_code.data.type, valid_code.data.model, device_vendor ]);
  // }

  // // let dahua_counter = 0;
  // // let hikvision_counter = 0;
  // // let dev_types = [];
  // // for (let i = 0; i < dahua_codes.length; ++i) {
  // //   const { dev_url, name, desc } = url_data[i];
  // //   const obj_num = name.split("_")[0];

  // //   if (dahua_codes[i].status.code === 200) {
  // //     dev_types.push({
  // //       device: new dahua({
  // //         host: dev_url.hostname,
  // //         port: 80,
  // //         user: dev_url.username,
  // //         pass: dev_url.password
  // //       }),
  // //       type: "dahua",
  // //       data: dahua_codes[i].data,
  // //       name: obj_num,
  // //       desc
  // //     });

  // //     dahua_counter += 1;
  // //     continue;
  // //   }

  // //   if (hikvision_codes[i].status.code === 200) {
  // //     dev_types.push({
  // //       device: new hikvision({
  // //         host: dev_url.hostname,
  // //         port: 80,
  // //         user: dev_url.username,
  // //         pass: dev_url.password
  // //       }),
  // //       type: "hikvision",
  // //       data: hikvision_codes[i].data,
  // //       name: obj_num,
  // //       desc
  // //     });

  // //     hikvision_counter += 1;
  // //     continue;
  // //   }

  // //   const dahua_str_code = `${dahua_codes[i].status.code} ${dahua_codes[i].status.desc}`;
  // //   const hikvision_str_code = `${hikvision_codes[i].status.code} ${hikvision_codes[i].status.desc}`;
  // //   xlsx_data.push([ obj_num, desc, dev_url.hostname, dahua_str_code, hikvision_str_code, "" ]);
  // // }

  // // console.log(`Responded dahua     devices ${dahua_counter}`);
  // // console.log(`Responded hikvision devices ${hikvision_counter}`);

  // // for (let i = 0; i < dev_types.length; ++i) {
  // //   const obj = dev_types[i];
  // //   if (obj.type === "dahua") {
  // //     const klass = await obj.device.get_device_class();
  // //     const type = await obj.device.get_device_type();

  // //     if (!type.data) {
  // //       console.log(type.status);
  // //       throw "Dahua type error";
  // //     }

  // //     if (!klass.data) {
  // //       console.log(klass.status);
  // //       throw "Dahua klass error";
  // //     }

  // //     xlsx_data.push([ obj.name, obj.desc, obj.device.host(), klass.data, type.data, "dahua" ]);
  // //     continue;
  // //   }

  // //   if (obj.type === "hikvision") {
  // //     //const { data, status } = await obj.device.system_device_info();
  // //     // if (!data) {
  // //     //   console.log(status);
  // //     //   throw "Hikvision error";
  // //     // }

  // //     xlsx_data.push([ obj.name, obj.desc, obj.device.host(), obj.data.deviceType, obj.data.model, "hikvision" ]);
  // //     continue;
  // //   }
  // // }

  // const date_str = make_current_day_str();
  // const buffer = xlsx.build([{name: 'Лист1', data: xlsx_data}]);
  // //const buffer = JSON.stringify(prtg_list);
  // //console.log(`Writing sensors tree`);
  // console.log(`Writing ${xlsx_data.length} rows`);
  // fs.writeFile(`cams_${date_str}.xlsx`, buffer, err => {
  //   if (err) { console.error(err); return; }
  //   console.log(`Success computing`);
  // });
})();

// так что теперь? мы получаем список камер из ЕГСВ и пытаемся понять что перед нами: камера или рег?
// если отдельная камера, то проверяем что это либо dahua либо hikvision отправив какой нибудь простой запрос
// для камер дальше нужно понять что за модель и взять еще парочку параметров и свести это дело в табличку
// если это рег, то опять проверяем производителя, берем модель и дальше нужно понять сколько и какие камеры подключены
// к регу, в hikvision кажется есть команды чтобы так или иначе провзаимодействовать с каналами, а у dahua я не нашел
// нужно взять модели камер которые подключены к регу и их тоже в табличку засунуть