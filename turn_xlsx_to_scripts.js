require("dotenv").config();
const db = require("./apis/db");
const axios = require("axios");
const dahua = require("./apis/dahua");
const hikvision = require("./apis/hikvision");
const trassir = require("./apis/trassir");
const egsv_api = require("./apis/egsv");
const prtg_api = require("./apis/prtg");
const subnet = require("./apis/subnet");
const xlsx = require("node-xlsx");
const fs = require("fs");

const file_name = "victor.xlsx";
const file_data = xlsx.parse(file_name);

const ip_regex = /^((25[0-5]|(2[0-4]|1[0-9]|[1-9]|)[0-9])(\.(?!$)|$)){4}$/;
function is_ip_address(str) {
  return ip_regex.test(str);
}

const good_num = (num) => num < 10 ? "0"+num : ""+num;

(async () => {
  let files_data = [];

  let counter = 0;
  let index = undefined;
  for (const row of file_data[0].data) {
    if (!row[0] || row[0] === "") continue;

    if (!is_ip_address(row[0])) {
      index = files_data.length;
      files_data.push({ name: row[0], addresses: [] });
      counter += 1;
      continue;
    }

    if (typeof index !== "number") continue;

    files_data[index].addresses.push({
      local_address: row[0].trim(),
      remote_address: row[1] ? row[1].trim() : ""
    });
  }

  //console.log(files_data);
  //console.log(files_data[0]);
  //console.log(files_data[0].addresses.length);

  for (const obj of files_data) {
    const obj_num = obj.name.trim().split(" ")[0];
    let script_str = `# ${obj.name}\n`;
    for (let i = 0; i < obj.addresses.length; ++i) {
      const addr = obj.addresses[i];
      const num = good_num(i);
      const line1 = `/ip firewall nat add chain=dstnat action=dst-nat dst-address=${addr.local_address} to-addresses=${addr.remote_address} comment="${obj_num}_${num}"\n`;
      const line2 = `/ip firewall nat add chain=srcnat action=masquerade dst-address=${addr.remote_address} comment="${obj_num}_${num}"\n`;
      script_str += "\n";
      if (addr.remote_address === "") script_str += "# ";
      script_str += line1;
      if (addr.remote_address === "") script_str += "# ";
      script_str += line2;
    }

    const script_name = `./victor_script/${obj_num}.txt`;
    console.log(script_name);
    //console.log(script_str);
    fs.writeFileSync(script_name, script_str);
  }

  console.log(`Files count ${counter}`);
})();

