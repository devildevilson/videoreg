require("dotenv").config();
const fs = require("fs");
const axios = require("axios");
const zabbix_api = require("./apis/zabbix");

const cookie_value = "eyJzZXNzaW9uaWQiOiJiNTMwYTI5ZDA2N2QzYTM0NjE4ZmY0ZmNjMmU3OWI2OSIsInNlcnZlckNoZWNrUmVzdWx0Ijp0cnVlLCJzZXJ2ZXJDaGVja1RpbWUiOjE3MjQ2Nzg1MjksInNpZ24iOiI4N2NhYWE3ODVhMzIxZWNkMjU0Yjc5MjkzMjI1YmM2MTdhYTFjMDY1ZjE4YzJiMDFkMzZmOTkxZWNiMmIwYzRkIn0%3D";
const folder_path = "./aqtobe_icmp_images";
if (!fs.existsSync(folder_path)) fs.mkdirSync(folder_path);

(async () => {
  // кукис нужно получить сначала
  const last_amount_time = "2d";
  const ret = await zabbix_aqt.method("graph.get", { groupids: [ 36 ], selectHosts: "extend" });
  const ping_arr = ret.filter(el => el.name.indexOf("g1") >= 0);
  for (const graph of ping_arr) {
    const name = graph.hosts[0].name.replaceAll(/[:\/\\]/g, "_");
    const image_graph_url = `http://10.4.1.49/chart2.php?graphid=${graph.graphid}&from=now-${last_amount_time}&to=now&height=201&width=1335&profileIdx=web.charts.filter&_=wsesoro0`;
    const img_ret = await axios.get(image_graph_url, { headers: { Cookie: `zbx_session=${cookie_value}` }, withCredentials: "true", responseType: "arraybuffer" });
    const file_path = `${folder_path}/${name}.png`;
    fs.writeFileSync(file_path, img_ret.data);
  }
}();