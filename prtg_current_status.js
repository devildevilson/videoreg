require("dotenv").config();
const axios = require("axios");
const dahua = require("./apis/dahua");
const hikvision = require("./apis/hikvision");
const trassir = require("./apis/trassir");
const prtg_api = require("./apis/prtg");
const subnet = require("./apis/subnet");
const xlsx = require("node-xlsx");
const fs = require("fs");

const prtg = new prtg_api({
  host: process.env.PRTG_HOST,
  port: process.env.PRTG_PORT,
  user: process.env.PRTG_USER,
  hash: process.env.PRTG_HASH,
});

function good_num(num) { return num < 10 ? "0"+num : ""+num; }

function human_date(in_date) {
  const date = new Date(in_date);
  const year = date.getFullYear();
  const month = good_num(date.getMonth()+1);
  const day = good_num(date.getDate());
  return `${year}.${month}.${day}`;
}

(async () => {
  let obj80_data = [ [ "obj id", "description", "device name", "address", "status" ] ];

  const list = await prtg.get_sensors_by_tags("80obj");
  //console.log(list.sensors[0]);
  for (const sensor of list.sensors) {
    const device = await prtg.find_device(sensor.parentid);
    if (device.name.indexOf("router") !== -1) continue;
    const group = await prtg.find_group(device.parentid);
    //console.log(device);
    //console.log(group);
    //break;

    let arr = group.name.split(" ");
    const obj_id = arr[0];
    arr.shift();
    const desc = arr.join(" ");
    const address = device.name.split(" ")[0];
    obj80_data.push( [ obj_id, desc, device.name, address, sensor.status ] );
    //console.log(obj80_data);
  }

  const cur_date = human_date(new Date());
  const file_name = `80obj_status_${cur_date}.xlsx`;
  const buffer = xlsx.build([{name: 'Лист1', data: obj80_data}]);
  fs.writeFileSync(file_name, buffer);
  console.log(`Written ${obj80_data.length} lines to '${file_name}'`);
})();