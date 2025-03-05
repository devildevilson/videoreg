require("dotenv").config();
const axios = require("axios");
const egsv_api = require("./apis/egsv");
//const xlsx = require("node-xlsx");
const fs = require("fs");
const crypto = require("crypto");

const egsv_rtms = new egsv_api({
  host: process.env.EGSV_HOST5,
  port: process.env.EGSV_PORT5,
  user: process.env.EGSV_USER5,
  pass: process.env.EGSV_PASS5
});

const day_seconds = 60*60*24;
const date_diff = (start, end) => (+((new Date(end)) - (new Date(start))) / 1000.0);
const toLocalHumanString = (date) => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
  const localISOTime = (new Date(+(new Date(date)) - tzoffset)).toISOString().slice(0, -1);
  return localISOTime.split(".")[0].split("T").join(" ");
};

(async () => {
  await egsv_rtms.auth();

  const tax_str = "66ebf363ac02e80330a6340a, 672b0ca9177a0766a6bc8ebd, 673af1673bd57a9f74abd5b9, 678df1c5f3fe4b19014b5507, 679723ab0ad8f8dca0ee5191, 67a209f30ad8f8dca076a6d2, 6784dcf2d8c2d0cc93438f7d, 67a337b60ad8f8dca0c7bb03";
  const tax_arr = tax_str.split(",").map(el => el.trim());
  const ret = await egsv_rtms.method("camera.list", {
    filter: {
      _taxonomies: {
        "$in": tax_arr
      }
    },
    limit: 100000,
    sort: {
      name: "asc"
    },
    //include: ['archive', 'computed', 'player']
  });

  //console.log(ret);
  //console.log(ret.cameras[0].archive);
  let xlsx_arr1 = [ [ "Группа", "Название камеры", "Адрес", "Старт", "Конец", "Секунды" ] ];
  let xlsx_arr2 = [ [ "Группа", "Название камеры", "Адрес", "Старт", "Конец", "Секунды (Пересчет)", "Дни (Пересчет)", "Секунды (Общее)", "Дни (Общее)" ] ];
  let cameras_obj = {};
  ret.cameras.forEach(el => cameras_obj[el.id] = el);
  const m_arr = ret.cameras.map(el => { return { method: "camera.archive.summary", params: { camera: { id: el.id } } }; });
  console.log(`Send bulk request for ${m_arr.length} cameras`);
  const cameras_arch = await egsv_rtms.method("bulk.queue", { bulk: m_arr, skip_errors: true });
  //fs.writeFileSync("bulk1.json", JSON.stringify(ret2));
  //const cameras_arch = JSON.parse(fs.readFileSync("bulk1.json"));
  //console.log(`Bulk request for ${m_arr.length} cameras done`);
  
  //console.log(ret2);
  for (const res of cameras_arch.results) {
    const camera = cameras_obj[res.params.camera.id];
    if (!camera) throw `Could not find '${res.params.camera.id}'`;
    if (!res.data || !res.data.archive) {
      console.log(`Archive? ${camera.name}`);
      continue;
    }

    const archive = res.data ? res.data.archive : undefined;
    if (!archive) continue;
    const arr = archive.summary;

    //console.log(camera.name);
    const group = camera.name.split(".")[0];

    let time_min = +(new Date());
    let time_max = -1;
    let counter = 0;
    for (const part of arr) {
      const human_start = part.localStart.split("T")[0] + " " + part.localStart.split("T")[1].split("-").join(":");
      const human_end = part.localEnd.split("T")[0] + " " + part.localEnd.split("T")[1].split("-").join(":");
      const tmp_start = part.localStart.split("T")[0] + "T" + part.localStart.split("T")[1].split("-").join(":") + "+05:00";
      const tmp_end = part.localEnd.split("T")[0] + "T" + part.localEnd.split("T")[1].split("-").join(":") + "+05:00";
      const date_start = new Date(tmp_start);
      const date_end = new Date(tmp_end);
      //const date_start = new Date(part.start);
      //const date_end = new Date(part.end);
      //console.log("date_start", tmp_start, date_start.toString());
      //console.log("date_end  ", tmp_end, date_end.toString());

      time_min = Math.min(time_min, +(date_start));
      time_max = Math.max(time_max, +(date_end));

      const diff_seconds = date_diff(date_start, date_end);
      counter += diff_seconds;
      //console.log("archive", human_start, human_end, diff_seconds);

      xlsx_arr1.push([ group, camera.name, camera.data.description.trim(), "'"+human_start, "'"+human_end, diff_seconds ]);
    }

    const overall_archive = counter === 0 ? 0 : Math.abs(time_min / 1000 - time_max / 1000);
    const date_min = new Date(time_min);
    const date_max = new Date(time_max);
    const date_min_human = toLocalHumanString(date_min);
    const date_max_human = toLocalHumanString(date_max);
    //console.log("archive_seconds1", counter, (counter / day_seconds));
    //console.log("archive_seconds2", overall_archive, (overall_archive / day_seconds));
    xlsx_arr2.push([ group, camera.name, camera.data.description.trim(), "'"+date_min_human, "'"+date_max_human, counter, (counter / day_seconds), overall_archive, (overall_archive / day_seconds) ]);
  }

  console.log("Done");
  //const xlsx_cont = xlsx.build([{ name: "ПоАрхивно", data: xlsx_arr1 }, { name: "ПоКамерам", data: xlsx_arr2 }]);
  //fs.writeFileSync("archives_data.xlsx", xlsx_cont);
  for (const row of xlsx_arr1) {
    fs.appendFileSync("archives_data1.csv", row.join(";")+"\n");
  }

  for (const row of xlsx_arr2) {
    fs.appendFileSync("archives_data2.csv", row.join(";")+"\n");
  }
})();

