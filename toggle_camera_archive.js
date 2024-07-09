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
//const google = require("./apis/google").config("jwt.keys.json");
const crypto = require("crypto");

(async () => {
  const egsv = new egsv_api({
    host: "10.4.0.10",
    port: "4080",
    user: "alemeshev",
    pass: "alemeshev"
  });

  // нам нужны все ОВН камеры
  const list = await egsv.camera_list_filter({
    can: [ 'view', 'update', 'delete', 'rtms', 'lvs2' ],
    filter: { _taxonomies: { "$in": [ "65a4ef518cc9dc0189b661a0" ] } },
    include: [ 'account', 'server' ],
    sort: { name: 'asc' }
  });

  //console.log(list.cameras.length);
  //console.log(list.cameras[0]);
  //const data = await egsv.update_camera({ id: list.cameras[0].id, archive: { enable: false, days: 3 } });
  //console.log(data);

  // let camera_promises = [];
  // let count = 0;
  // for (const camera of list.cameras) {
  //   //if (count % 100 === 0) console.log(count);
  //   const promise = (async () => {
  //     try {
  //       const data = await egsv.update_camera({ id: camera.id, archive: { enable: false, days: 3 } });
  //       count += 1;
  //     } catch (e) {
  //       console.log(camera.id);
  //     }
  //   })();
  //   camera_promises.push(promise);
  // }

  // const arr = await Promise.all(camera_promises);
  // //console.log(arr.length);

  // console.log("count", count);

  // оттуда мы просто берем названия и ссылку
  for (const camera of list.cameras) {
    console.log(`${camera.url} ${camera.name}`);
  }
})();