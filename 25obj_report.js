require("dotenv").config();
const axios = require("axios");
const egsv_api = require("./apis/egsv");
const xlsx = require("node-xlsx");
const fs = require("fs");
const zabbix_api = require("./apis/zabbix");

const zabbix_akm = new zabbix_api({ host: "10.0.67.142", token: process.env.ZABBIX_API_TOKEN });

const strcmp = (a,b) => (a < b ? -1 : +(a > b));

(async () => {
  // группа устройств
  // получаем все проблемы + получаем все устройства
  // ищем какие проблемные какие нет
  // 

  const zabbix_groupids = [ 147 ];

  let problem_hosts = {};
  {
    const problems = await zabbix_akm.method("problem.get", { 
      groupids: zabbix_groupids,
      severities: [ 4 ]
    });

    const event_ids = problems.map(el => el.eventid);
    const events = await zabbix_akm.method("event.get", { 
      eventids: event_ids,
      severities: [ 4 ],
      selectHosts: "extend",
    });

    const host_ids_arr = events.map(el => el.hosts.map(el1 => el1.hostid));
    const host_ids = [].concat.apply([], host_ids_arr);

    const hosts = await zabbix_akm.method("host.get", {
      selectInterfaces: "extend",
      hostids: host_ids,
    });

    hosts.forEach(el => problem_hosts[el.hostid] = el);
  }

  const all_hosts = await zabbix_akm.method("host.get", {
    groupids: zabbix_groupids,
    selectInterfaces: "extend",
    selectTags: "extend"
  });

  let xlsx_data = [];
  let work_xlsx_data = [];
  let notwork_xlsx_data = [];

  let school_data = {};
  for (const host of all_hosts) {
    const is_working = !problem_hosts[host.hostid];
    const is_button = host.name.indexOf("BUTTON STRAZH") !== -1;
    const number = host.name.split(" ")[0];
    const device_name = host.name.split(" ").slice(1).join(" ");
    let school_name = host.name.split(" ").slice(1).slice(0, -2).join(" ");
    if (is_button) school_name = host.name.split(" ").slice(1).slice(0, -3).join(" ");
    let type = host.tags.filter(el => el.tag === "type")[0].value;
    if (type.indexOf("25obj_exclude") !== -1) continue;
    type = type === "BUTTON STRAZH" ? "BUTTON" : type;
    type = type === "STRAZH NVR" ? "NVR" : type;
    const status_str = is_working ? "Работает" : "Не работает";

    //console.log(host);
    //console.log(number, device_name, school_name, type, status_str);

    xlsx_data.push([ number, device_name, host.interfaces[0].ip, type, status_str ]);
    if (is_working) {
      work_xlsx_data.push([ number, device_name, host.interfaces[0].ip, type ]);
    } else {
      notwork_xlsx_data.push([ number, device_name, host.interfaces[0].ip, type ]);
    }

    if (!school_data[number]) school_data[number] = { working: 0, notworking: 0, count: 0 };
    school_data[number].number = number;
    school_data[number].name = school_name;
    if (is_working) school_data[number].working += 1;
    else school_data[number].notworking += 1;
    school_data[number].count += 1;
    if (school_data[number].name && school_data[number].name !== school_name) throw `${school_data[number].name} !== ${school_name}`;

    //break;
  }

  let school_xlsx_data = Object.values(school_data).map(el => {
    return [ el.number, el.name, el.working, el.notworking, el.count ];
  });

  xlsx_data.sort((a,b) => strcmp(a[0], b[0]));
  work_xlsx_data.sort((a,b) => strcmp(a[0], b[0]));
  notwork_xlsx_data.sort((a,b) => strcmp(a[0], b[0]));
  school_xlsx_data.sort((a,b) => strcmp(a[0], b[0]));

  xlsx_data.unshift([ "Номер", "Имя", "IP адрес", "Тип", "Статус" ]);
  work_xlsx_data.unshift([ "Номер", "Имя", "IP адрес", "Тип" ]);
  notwork_xlsx_data.unshift([ "Номер", "Имя", "IP адрес", "Тип" ]);
  school_xlsx_data.unshift([ "Номер", "Имя", "Работает", "Не работает", "Всего" ]);

  const xlsx_file_data = xlsx.build([{ name: "Общая", data: xlsx_data }, { name: "Работает", data: work_xlsx_data }, { name: "Не работает", data: notwork_xlsx_data }, { name: "По школам", data: school_xlsx_data }]);
  fs.writeFileSync("25_obj.xlsx", xlsx_file_data);
})();