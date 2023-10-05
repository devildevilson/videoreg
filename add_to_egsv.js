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

const fs = require('fs');
//const spawn = require('child_process').spawn;
//const ffmpeg = require("ffmpeg");
const {createTunnel} = require("tunnel-ssh");

//const RecordNSnap = require('node-ffmpeg-stream').RecordNSnap; 

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const ssh_options = {
  host: '172.24.131.123',
  port: 22,
  username: 'root',
  password: 'q1w2e3'
};

function ssh_tunnel(address, port){
  let forward_options = {
    //srcAddr: address,
    //srcPort: port,
    dstAddr: address,
    dstPort: 80
  };

  return createTunnel({ autoClose: true }, null, ssh_options, forward_options);
}

function rtsp_link1(ip_address, username, password, index) {
  return [
    `rtsp://${username}:${password}@${ip_address}:554/cam/realmonitor?channel=${index+1}&subtype=0`,
    `rtsp://${username}:${password}@${ip_address}:554/cam/realmonitor?channel=${index+1}&subtype=1`,
  ];
}

function rtsp_link2(ip_address, username, password, index) {
  return [
    `rtsp://${username}:${password}@${ip_address}:554/ISAPI/Streaming/Channels/${index+1}01`,
    `rtsp://${username}:${password}@${ip_address}:554/ISAPI/Streaming/Channels/${index+1}02`,
  ];
}

function rtsp_link3(ip_address, username, password, index) {
  return [
    `rtsp://${ip_address}:554/user=${username}&password=${password}&channel=${index+1}&stream=00.sdp`,
    `rtsp://${ip_address}:554/user=${username}&password=${password}&channel=${index+1}&stream=01.sdp`,
  ];
}

async function check_device_type(host, port, username, password) {
  {
    const device = new dahua({
      host,
      port,
      user: username,
      pass: password
    });

    const { data, status } = await device.device_info();
    console.log("dahua",status);
    if (data) return "dahua";
  }

  {
    const device = new hikvision({
      host,
      port,
      user: username,
      pass: password
    });

    const { data, status } = await device.device_info();
    console.log("hikvision",status);
    if (data) return "hikvision";
  }

  return "other";
}

const good_num = (num) => num < 10 ? "0"+num : ""+num;

const links_factory = [ rtsp_link1, rtsp_link2, rtsp_link3 ];

const file_name = "working_123.xlsx";
const file_data = xlsx.parse(file_name);

async function close_server(server) {
  return new Promise(function (resolve, reject) {
    server.close(function(err) {
      if (err) { reject(err); return; }
      resolve();
    });
  });
}

function valid_string(str) {
  return typeof str === "string" ? str.trim() : "";
}

function valid_string_case(str) {
  return typeof str === "string" ? str.trim().toLowerCase() : "";
}

(async () => {
  let output = [];
  for (const row of file_data[0].data) {
    const name = valid_string(row[0]);
    const region = valid_string(row[1]);
    const address = valid_string(row[2]);
    const username = valid_string(row[3]);
    //console.log(row[4]);
    const password = valid_string(row[4]) === "без пароля" ? "" : (""+row[4]).trim();
    const ip_address = valid_string(row[5]).split(":")[0];
    const type = valid_string_case(row[6]);
    const error = row[7];

    if (!type || type === "" || type === "???") continue;
    if (error && error !== "") continue;

    // const listening_port = 4042;
    // const [ server, con ] = await ssh_tunnel(ip_address, listening_port);
    // const auto_port = server.address().port;
    // console.log("port:",auto_port);

    // const type = await check_device_type("localhost", auto_port, username, password);
    // console.log(name,ip_address,type);
    // console.log(await axios.get(`http://localhost:${auto_port}`));

    // await close_server(server);
    // //await con.close();
    // //break;

    const cam_name = ip_address.substring(ip_address.indexOf(".")+1);
    for (let i = 0; i < 16; ++i) {
      const final_cam_name = `${cam_name}_${good_num(i+1)}`;
      let links = [];
      if (type === "dahua") links = rtsp_link1(ip_address, username, password, i);
      if (type === "hikvision") links = rtsp_link2(ip_address, username, password, i);
      if (type === "other") links = rtsp_link3(ip_address, username, password, i);

      const outrow = [ final_cam_name, name, links[0], links[1], region, type ];
      output.push(outrow);
    }

    //output.push([]);
  }

  const buffer = xlsx.build([{name: 'Лист1', data: output}]);
  fs.writeFileSync("cameras_egsv2.xlsx", buffer);
})();