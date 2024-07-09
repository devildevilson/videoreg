const fs = require("fs");

const data = fs.readFileSync("cameras--172.20.21.100-4080--2024-05-06.json");
const obj = JSON.parse(data);

let final_obj = {};
for (const cam of obj.cameras) {
  final_obj[cam.id] = { name: cam.name, desc: cam.description };
  const id = cam.name.split(" ")[1].split("-")[0];
  console.log(`UserParameter=archive.data.${id},/usr/bin/node /root/nodejs/index.js ${cam.id}`);
}

fs.writeFileSync("124152515215.json", JSON.stringify(final_obj));