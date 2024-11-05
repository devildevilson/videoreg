require("dotenv").config();
const egsv_api = require("./apis/egsv");
const zabbix_api = require("./apis/zabbix");
//const schedule = require('node-schedule');
const axios = require("axios");
const fs = require("fs");

const egsv_sko = new egsv_api({
  host: process.env.EGSV_HOST3,
  port: process.env.EGSV_PORT3,
  user: process.env.EGSV_USER3,
  pass: process.env.EGSV_PASS3
});

const zabbix_sko = new zabbix_api({ host: "172.20.21.200", token: process.env.ZABBIX_SKO_API_TOKEN });

// const camera_id = process.argv[2];
// if (typeof camera_id !== "string") {
//   console.log(`Usage: node script.js *egsv camera id*`);
//   return;
// }

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

function load_file_content(path) {
  return fs.readFileSync(path, { encoding: 'utf8', flag: 'r' });
}

const strcmp = (a,b) => (a < b ? -1 : +(a > b));
const parse_unix_date = (timestamp) => new Date(timestamp * 1000);

const minimum_events_within_hour = 1;
const telegram_bot_id = load_file_content("./telegram_bot_id");
const telegram_chat_id = load_file_content("./telegram_chat_id");

async function broadcast_message() {
  const current_date = new Date();
  const last_5h = (new Date()).setTime(current_date.getTime() - 5*60*60*1000);

  const ret = await egsv_sko.method("rtms.report.list", {
    filter: {
      datetime: {
        $gte: make_sane_time_string(last_5h),
        $lte: make_sane_time_string(current_date)
      },
      //camera: { $in: [ camera_id ] }
    },
    group: { hour: true },
    include: [ 'cameras', 'last_datetimes' ]
  });

  const obj = {};
  ret.cameras.forEach((elem) => { obj[elem.id] = elem; });

  // тут нужно добавить еще заббикс типа получить все проблемы по устройствам на текущий момент
  // как сделать? в заббиксе сейчас лежит id камеры
  // нужно получить все проблемы по устройствам
  let zabbix_egsv_cam_id = {};
  let zabbix_problem_arr = [];

  {
    const problems = await zabbix_sko.method("problem.get", { 
      groupids: [ 28, 31, 42 ],
      severities: [ 4 ]
    });

    //console.log(problems);
    const event_ids = problems.map(el => el.eventid);
    const events = await zabbix_sko.method("event.get", { 
      eventids: event_ids,
      severities: [ 4 ],
      selectHosts: "extend",
    });

    //console.log(events);
    let host_problem_time = {};
    events.forEach(el => el.hosts.forEach(h => host_problem_time[h.hostid] = el.clock));
    //console.log(host_problem_time);
    const host_ids_arr = events.map(el => el.hosts.map(el1 => el1.hostid));
    const host_ids = [].concat.apply([], host_ids_arr);
    const macros = await zabbix_sko.method("usermacro.get", {
      selectHosts: "extend",
      hostids: host_ids,
    });

    zabbix_problem_arr = macros.filter(el => el.macro === "{$EGSVCAMERAID}").map(el => { return { cam_id: el.value, host_id: el.hostid, host_name: el.hosts[0].name, host_short: el.hosts[0].host, problem_since: host_problem_time[el.hostid] } });
    zabbix_problem_arr.forEach(el => zabbix_egsv_cam_id[el.cam_id] = true);
    zabbix_problem_arr.sort((a, b) => strcmp(a.host_short, b.host_short));
    console.log(zabbix_problem_arr);
    return;
  }

  let arr = [];
  const stats_arr = Object.entries(ret.stats);
  if (stats_arr.length === 0) {
    console.log(`Could not find rtms data for camera '${camera_id}'`);
    return;
  }

  if (stats_arr.length > 1) {
    console.log(`Found ${stats_arr.length} stats rows fro camera '${camera_id}'`);
  }


  const [ key, stats ] = stats_arr[0];
  const camera_data = obj[key];
  let ret_obj = {
    id: camera_id,
    name: camera_data.name,
    last_event_date: "",
    last_date_event_count: 0,
    last_hour_event_count: 0,
    has_last_hour_events: false
  };
  if (stats.length > 0) {
    const data = stats[stats.length-1];
    ret_obj.last_event_date = data.datetime;
    ret_obj.last_date_event_count = data.count;
    const date = new Date(data.datetime);
    const cur_str = make_sane_date_string(current_date);
    const date_str = make_sane_date_string(date);
    if (cur_str === date_str && current_date.getHours() === date.getHours()) {
      ret_obj.last_hour_event_count = data.count;
      ret_obj.has_last_hour_events = ret_obj.last_hour_event_count > 0;
    }

    // наверное тут еще имеет смысл найти предыдущий час и у него взять количество событий для статистики
    // for (let i = stats.length-1; i >= 0; --i) {
    //   const data = stats[i];
    //   const date = new Date(data.datetime);
    //   const hours = date.getHours();

    // }
  }

  // for (const [ key, stats ] of stats_arr) {
  //   let problem_start = undefined;
  //   // нужно сделать проверку получше
  //   // мы должны в общем то проверить чтобы дата и час совпадали - 
  //   // тогда это работающий или недавно запущенный объект
  //   if (stats.length < 4) {
  //     problem_start = stats.length !== 0 ? stats[stats.length-1].datetime : last_5h;
  //   }

  //   for (let i = stats.length-1; i >= 0; --i) {
  //     const data = stats[i];

  //   }

  //   if (problem_start) {
  //     arr.push({ problem_start, camera: obj[key] });
  //   }
  // }

  console.log(ret_obj);
}

// const job1 = schedule.scheduleJob('30 9 * * *', async function(){
//   await broadcast_message();
//   const time = make_sane_time_string(new Date());
//   console.log(`[${time}] send report`);
// });

// const job2 = schedule.scheduleJob('30 15 * * *', async function(){
//   await broadcast_message();
//   const time = make_sane_time_string(new Date());
//   console.log(`[${time}] send report`);
// });

// const time = make_sane_time_string(new Date());
// console.log(`[${time}] send report`);
broadcast_message();