require("dotenv").config();
const axios = require("axios");
const dahua = require("./apis/dahua");
const fs = require("fs");

const ip_addresses = `10.29.14.2
10.29.14.3
10.29.21.2
10.29.21.3
10.0.113.130
10.29.21.130
10.0.113.2
10.0.121.2
10.0.112.2
10.0.118.130
10.0.116.2
10.29.23.2
10.0.123.2
10.0.123.130
10.0.115.2
10.0.118.2
10.0.115.130
10.0.112.130
10.0.120.2
10.0.119.2 admin qwerty12345
10.0.120.130
10.0.116.130
10.0.122.130
10.0.121.130
10.0.122.2
10.0.117.130
10.0.117.2
10.0.114.130 admin qwerty12345`;

function make_good_day_num(num) {
  return num < 10 ? "0"+num : ""+num;
}

function make_current_day_str() {
  const current_date = new Date();
  const month_str = make_good_day_num(current_date.getMonth()+1);
  const day_str = make_good_day_num(current_date.getDate());
  return `${current_date.getFullYear()}.${month_str}.${day_str}`;
}

let output = [];

(async () => {
  const ip_addresses_local = ip_addresses.split("\n");

  for (const ip of ip_addresses_local) {
    const host_data = ip.trim().split(" ");
    const final_host = host_data[0];
    let username = "aqmol";
    let password = "aqmol12345";
    if (host_data.length > 1) {
      username = host_data[1];
      password = host_data[2];
    }

    console.log(`Current host ${final_host}`);
    const device = new dahua({
      host: final_host,
      port: 80,
      user: username,
      pass: password
    });

    const hard_disk = await device.get_hard_disk_info();
    const storage_names = await device.get_storage_names();
    const storage_info = await device.get_storage_info();
    const storage_caps = await device.get_storage_caps();

    const record_storage_point = await device.get_record_storage_point();
    const storage_group = await device.get_storage_group();

    const record_caps = await device.get_record_caps();
    const record_info = await device.get_record_info();
    const record_mode = await device.get_record_mode();
    const global_media_config = await device.get_global_media_config();

    output.push({
      host: final_host,
      hard_disk: hard_disk.data ? hard_disk.data : hard_disk.status,
      storage_names: storage_names.data ? storage_names.data : storage_names.status,
      storage_info: storage_info.data ? storage_info.data : storage_info.status,
      storage_caps: storage_caps.data ? storage_caps.data : storage_caps.status,

      record_storage_point: record_storage_point.data ? record_storage_point.data : record_storage_point.status,
      storage_group: storage_group.data ? storage_group.data : storage_group.status,

      record_caps: record_caps.data ? record_caps.data : record_caps.status,
      record_info: record_info.data ? record_info.data : record_info.status,
      record_mode: record_mode.data ? record_mode.data : record_mode.status,
      global_media_config: global_media_config.data ? global_media_config.data : global_media_config.status,
    });
  }

  const date_str = make_current_day_str();
  const str = JSON.stringify(output);
  console.log(`Writing ${output.length} hosts data`);
  fs.writeFile(`nvr_${date_str}.json`, str, err => {
    if (err) { console.error(err); return; }
    console.log(`Success computing`);
  });
})();