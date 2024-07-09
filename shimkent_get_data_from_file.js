require("dotenv").config();
const axios = require("axios");
const dahua = require("./apis/dahua");
const hikvision = require("./apis/hikvision");
const trassir = require("./apis/trassir");
const egsv_api = require("./apis/egsv");
const subnet = require("./apis/subnet");
const xlsx = require("node-xlsx");
const fs = require("fs");

const egsv = new egsv_api({
  host: process.env.SHIMKENT_EGSV_HOST,
  port: process.env.SHIMKENT_EGSV_PORT,
  user: process.env.SHIMKENT_EGSV_USER,
  pass: process.env.SHIMKENT_EGSV_PASS
});

const file_path = "OrsaVision.xlsx";
const devices = xlsx.parse(file_path);

let xlsx_cameras = [];

function make_good_day_num(num) {
  return num < 10 ? "0"+num : ""+num;
}

function make_camera_link(username, password, address, index) {
  const username1 = username ? username : "";
  const password1 = password ? password : "";
  if (!address) throw `address udefined`;
  return [ 
    `rtsp://${username1}:${password1}@${address}:554/ISAPI/Streaming/Channels/${index+1}01`,
    `rtsp://${username1}:${password1}@${address}:554/ISAPI/Streaming/Channels/${index+1}02`
  ];
}

(async () => {
  let taxos = [];
  const main_taxo = "6625ec458b1d8527e32f25e7";
  let prev_username = "";
  let prev_password = "";
  let count = 0;
  for (const row of devices[1].data) {
    //unuse1, unuse2, 
    const [ obj_type, name, ip_address, dev_type, username, password ] = row;
    //console.log(row);
    if (!ip_address || !subnet.is_ip_address(ip_address.trim())) { count = 0; continue; }
    //count += 1;
    // const final_username = !username || username === "" ? prev_username : username;
    // const final_password = !password || password === "" ? prev_password : password;
    // prev_username = !username || username === "" ? prev_username : username;
    // prev_password = !password || password === "" ? prev_password : password;

    //const ret = await egsv.method("taxonomy.create", { taxonomy: { name, parent: main_taxo } });
    // console.log(ret.taxonomy.id);
    // break;

    //taxos.push([ name, ret.taxonomy.id ]);

    //const [ link1, link2 ] = make_camera_link(final_username, final_password, ip_address, 0);
    const link1 = `rtsp://${ip_address}:554/stream1`;
    const link2 = `rtsp://${ip_address}:554/stream2`;

    const cam_name = name.split(" ")[0];
    const cam_desc = name.split(" ").slice(1).join(" ");

    // название нужно сгенерировать, как?
    xlsx_cameras.push([
      cam_name, cam_desc, link1, link2
    ]);
  }

  const data = xlsx.build([{ name: "List1", data: xlsx_cameras }]);
  fs.writeFileSync("shimkent2.xlsx", data);
})();


