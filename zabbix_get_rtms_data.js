require("dotenv").config();
const egsv_api = require("./apis/egsv");
const axios = require("axios");

const egsv_sko = new egsv_api({
  host: process.env.EGSV_HOST3,
  port: process.env.EGSV_PORT3,
  user: process.env.EGSV_USER3,
  pass: process.env.EGSV_PASS3
});

const egsv_cam_id = process.argv[2];

//console.log(process.argv);
//return;

if (typeof egsv_cam_id !== "string") {
  console.log(`Usage: node zabbix_get_rtms_data.js *egsv cam id*`);
  return;
}

// нужно посмотреть сколько ивентов за последних несколько часов было
// и отправить эту инфу в заббикс
// добавить это в шедулер и проверять пару раз в день

const make_good_num = num => num < 10 ? "0"+num : ""+num;

function make_sane_time_string(date) {
  const final_date = new Date(date);
  const y = final_date.getFullYear();
  const m = make_good_num(final_date.getMonth()+1);
  const d = make_good_num(final_date.getDate());
  const H = make_good_num(final_date.getHours());
  const M = make_good_num(final_date.getMinutes());
  const S = make_good_num(final_date.getSeconds());
  return `${y}-${m}-${d} ${H}:${M}:${S}`;
}

function make_sane_date_string(date) {
  const final_date = new Date(date);
  const y = final_date.getFullYear();
  const m = make_good_num(final_date.getMonth()+1);
  const d = make_good_num(final_date.getDate());
  return `${y}.${m}.${d}`;
}

const minimum_events_within_hour = 1;

(async () => {
  const current_date = new Date();
  const last_30d = (new Date()).setTime(current_date.getTime() - 30*24*60*60*1000);

  const ret = await egsv_sko.method("rtms.number.list", {
    filter: {
      datetime: {
        $gte: make_sane_time_string(last_30d),
        $lte: make_sane_time_string(current_date)
      },
      camera: { $in: [ egsv_cam_id ] },
    },
    limit: 1,
    group: { hour: true },
    include: [ 'cameras' ],
    sort: { datetime: 'desc' }
  });

  console.log(ret);

  if (ret.numbers.length === 0) {

  }

  const obj = {
    id: egsv_cam_id,
    name: ret.cameras[0].name,
    last_event_time: ret.numbers[0].datetime,

  };

  //   

  // const obj = {};
  // ret.cameras.forEach((elem) => { obj[elem.id] = elem; });

  // let arr = [];
  // for (const [ key, stats ] of Object.entries(ret.stats)) {
  //   //console.log(key, stat);

  //   let problem_start = undefined;
  //   for (let i = stats.length-1; i > 0; --i) {
  //     if (stats[i].count > minimum_events_within_hour) break;
  //     problem_start = stats[i].datetime;
  //   }

  //   if (problem_start) {
  //     arr.push({ problem_start, camera: obj[key] });
  //   }
  // }

  // //console.log(arr);

  // let str = "";
  // let counter = 1;
  // for (const elem of arr) {
  //   const problem_date = new Date(elem.problem_start);
  //   const start_hours = problem_date.getHours();
  //   const local_str = `${counter}) ${elem.camera.name} не работает с ${start_hours}\n`;
  //   str += local_str;
  // }

  // const chat_id = "-1002161033657";
  // const msg = `chat_id=${chat_id}&parse_mode=Markdown&text=\nСКО Отчет ${make_sane_date_string(current_date)}\n${str}`;
  // const t_ret = await axios.post("https://api.telegram.org/bot7406288231:AAFdUOy7uOYWf1wKJVA-_fuvO0b70xfKpHg/sendMessage", msg);
  //console.log(t_ret);

  // const obj = {
  //   id: "",
  //   name: "",
  //   rtms_data_count: 100,
  //   last_event: "",
  //   last_event_time : "",
  //   has_events_within_time: false
  // };
})();