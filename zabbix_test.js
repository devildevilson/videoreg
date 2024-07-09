"use strict"
require("dotenv").config();
const axios = require("axios");
const dahua = require("./apis/dahua");
const hikvision = require("./apis/hikvision");
const trassir = require("./apis/trassir");
const prtg_api = require("./apis/prtg");
const egsv_api = require("./apis/egsv");
const subnet = require("./apis/subnet");
const xlsx = require("node-xlsx");
const fs = require("fs");
const crypto = require("crypto");
const zabbix_api = require("./apis/zabbix");

//const zabbix = new zabbix_api({ host: "10.0.67.142", token: process.env.ZABBIX_API_TOKEN });
//const zabbix_aqt = new zabbix_api({ host: "10.4.1.49", token: process.env.ZABBIX_AQT_API_TOKEN });
const zabbix_sko = new zabbix_api({ host: "172.20.21.200", token: process.env.ZABBIX_SKO_API_TOKEN });

const prtg = new prtg_api({
  host: process.env.PRTG_HOST,
  port: process.env.PRTG_PORT,
  user: process.env.PRTG_USER,
  hash: process.env.PRTG_HASH,
});

function process_device_r(obj, hierarchical_names, callback) {
  const names = [ ...hierarchical_names, { name: obj.name, tags: obj.tags } ];

  if (obj.device) {
    for (const [ _, value ] of Object.entries(obj.device)) {
      //console.log(value);
      const human_obj = {
        name: value.name,
        host: value.host,
        tags: value.tags,
        groups: names
      };

      callback(human_obj);
    }

    return;
  }

  if (obj.group) {
    for (const [ _, value ] of Object.entries(obj.group)) {
      process_device_r(value, names, callback);
    }
  }
}

function read_json(filename) {
  const data = fs.readFileSync(filename, { encoding: 'utf8', flag: 'r' });
  return JSON.parse(data);
}

function make_param(hostgroups, device) {
  const groups = device.groups.map(group => { return { groupid: hostgroups[group.name] }; });
  let tags = [];
  for (const group of device.groups) {
    if (typeof group.tags === "string" && group.tags.indexOf("ОБЛАСТЬ") !== -1) {
      // ???
      continue;
    }

    if (typeof group.tags === "string" && group.tags.indexOf("region") !== -1) {
      tags.push( { tag: "region", value: group.name } );
      continue;
    }

    if (typeof group.tags === "string" && group.tags.indexOf("object") !== -1) {
      const arr = group.tags.split(" ");
      tags.push( { tag: "object", value: arr[1] } );
      tags.push( { tag: "human", value: arr[2] } );
      continue;
    }    
  }

  let type = device.name.split(" ")[1];
  if (type.indexOf("кнопка") !== -1) { type = "BUTTON"; }

  const tech_name = `${device.host} ${device.tags}`;
  const target_subnet = new subnet(`${device.host}/25`);
  tags.push( { tag: "target", value: device.host } );
  tags.push( { tag: "network", value: `${target_subnet.network}/25` } );
  tags.push( { tag: "type", value: device.tags } );

  return {
    host: tech_name,
    name: device.name,
    interfaces: [
      {
        type: 2, // SNMP
        main: 1,
        useip: 1,
        ip: device.host,
        dns: "",
        port: "161",
        details: {
          version: 2,
          community: "{$SNMP_COMMUNITY}",
        }
      }
    ],
    groups,
    tags,
    templates: [ { templateid: "10564" } ], // ICMP Ping
    // вообще тут было бы удобно что то добавить
    macros: [
      {
        macro: "{$PHYS_ADDRESS}",
        value: "фвапфпыфпыпфп",
        description: "Адрес объекта (нужно ручками заполнить как нибудь)"
      },
      {
        macro: "{$LOCATION}",
        value: "54.01,23.21",
        description: "Координаты на карте (позже пройдусь по ЕГСВ)"
      }
    ],
    // не уверен что нужна будет инвентаризация, хотя будет полезно в будущем указать мак адреса и модели устройств
    // inventory_mode: 0,
    // inventory: {
    //   macaddress_a: "01234",
    //   macaddress_b: "56768"
    // }
  };
}

function get_tag_value(tags, tag_name) {
  for (const tag of tags) {
    if (tag.tag === tag_name) return tag.value;
  }
  return undefined;
}

(async () => {
  const prtg_list = await prtg.sensors_tree();

  //await zabbix.login(process.env.ZABBIX_API_USER, process.env.ZABBIX_API_PASS);
  //const hosts = await zabbix.method("host.get", {});
  //console.log(hosts);

  // так теперь нужно получить хосты из ПРТГ и создать хосты в заббиксе
  // в заббиксе нет возможности сделать иерархические группы, 
  // но можно добавить сразу несколько групп
  // сначала надо бы распарсить пртг и положить все в более хороший json
  // а потом завести в заббикс
  // let devices = [];
  // const groups = prtg_list.sensortree.nodes.group.probenode.group;
  // for (const [ _, value ] of Object.entries(groups)) {
  //   if (typeof value.tags !== "string" || value.tags.indexOf("ОБЛАСТЬ") === -1) continue;

  //   //console.log(value);
  //   //value.group - это по идее группы-регионы, у них в подчинении есть группы-объекты
  //   // нам по идее нужно провалиться до конечного хоста и его добавить в массив, где группы будут включать все предыдущие по иерархии

  //   process_device_r(value, [], (obj) => {
  //     devices.push(obj);
  //   });
  // }

  // fs.writeFileSync("devices.json", JSON.stringify(devices, undefined, 2));

  // так вот эти устройства нужно задать в заббиксе, теперь как?
  // надо наверное сначала сохранить одно из них, посмотреть все настройки

  // const devices = read_json("./devices.json");

  // let unique_names = {};
  // for (const device of devices) {
  //   for (const group of device.groups) {
  //     //console.log(group.name);
  //     unique_names[group.name] = true;
  //   }
  // }

  // //const names = Object.keys(unique_names).map(el => { name: el }); // почему это не ошибка
  // const names = Object.keys(unique_names).map(el => { return { name: el }; });
  // const { groupids } = await zabbix.method("hostgroup.create", names);
  // console.log(`${groupids.length} ${names.length}`);
  // for (let i = 0; i < groupids.length; ++i) {
  //   const n = names[i];
  //   const id = groupids[i];
  //   if (!unique_names[n]) throw 123;
  //   unique_names[n] = id;
  // }

  // fs.writeFileSync("hostgroups.json", JSON.stringify(unique_names, undefined, 2));

  // let unique_names = {};
  // const res = await zabbix.method("hostgroup.get", {});
  // for (const elem of res) {
  //   unique_names[elem.name] = elem.groupid;
  // }

  // fs.writeFileSync("hostgroups.json", JSON.stringify(unique_names, undefined, 2));

  // вот у нас есть группы в заббиксе и список устройств в json
  // нужно прочитать список, составить данные для устройства, пихнуть туда группы ну посоздавать все
  // еще для всех сразу подвязать нужно пинг и возможно что то еще, нужно создать одно устройство ручками

  // const hostgroups = read_json("./hostgroups.json");
  // const devices = read_json("./devices.json");
  // const groups = devices[1].groups.map(group => { return { groupid: hostgroups[group.name] }; });
  // let tags = [];
  // for (const group of devices[1].groups) {
  //   if (typeof group.tags === "string" && group.tags.indexOf("ОБЛАСТЬ") !== -1) {
  //     // ???
  //     continue;
  //   }

  //   if (typeof group.tags === "string" && group.tags.indexOf("region") !== -1) {
  //     tags.push( { tag: "region", value: group.name } );
  //     continue;
  //   }

  //   if (typeof group.tags === "string" && group.tags.indexOf("object") !== -1) {
  //     const arr = group.tags.split(" ");
  //     tags.push( { tag: "object", value: arr[1] } );
  //     tags.push( { tag: "human", value: arr[2] } );
  //     continue;
  //   }    
  // }

  // const type = devices[1].name.split(" ")[1];
  // const target_subnet = new subnet(`${devices[1].host}/25`);
  // tags.push( { tag: "target", value: devices[1].host } );
  // tags.push( { tag: "network", value: `${target_subnet.network}/25` } );
  // tags.push( { tag: "type", value: type } );

  // const para = {
  //   host: devices[1].name,
  //   interfaces: [
  //     {
  //       type: 2, // SNMP
  //       main: 1,
  //       useip: 1,
  //       ip: devices[1].host,
  //       dns: "",
  //       port: "161",
  //       details: {
  //         version: 2,
  //         community: "{$SNMP_COMMUNITY}",
  //       }
  //     }
  //   ],
  //   groups,
  //   tags,
  //   templates: [
  //     {
  //       templateid: "10564" // ICMP Ping
  //     }
  //   ],
  //   // вообще тут было бы удобно что то добавить
  //   macros: [
  //     {
  //       macro: "{$PHYS_ADDRESS}",
  //       value: "фвапфпыфпыпфп",
  //       description: "Адрес объекта (нужно ручками заполнить как нибудь)"
  //     },
  //     {
  //       macro: "{$LOCATION}",
  //       value: "54.01,23.21",
  //       description: "Координаты на карте (позже пройдусь по ЕГСВ)"
  //     }
  //   ],
  //   // не уверен что нужна будет инвентаризация, хотя будет полезно в будущем указать мак адреса и модели устройств
  //   // inventory_mode: 0,
  //   // inventory: {
  //   //   macaddress_a: "01234",
  //   //   macaddress_b: "56768"
  //   // }
  // };

  // console.log(para);
  // const res = await zabbix.method("host.create", para);
  // console.log(res);

  // const hostgroups = read_json("./hostgroups.json");
  // const devices = read_json("./devices.json");

  // let params = [];
  // for (const device of devices) {
  //   if (device.host === "10.29.1.129" || device.host === "10.29.1.130") continue;
  //   const p = make_param(hostgroups, device);
  //   params.push(p);
  // }
  
  //console.log(params);
  //const res = await zabbix.method("host.create", params);
  //console.log(res);
  // let count = 0;
  // try {
  //   for (const p of params) {
  //     count += 1;
  //     if (p.interfaces[0].ip === "10.29.1.129" || p.interfaces[0].ip === "10.29.1.130") continue;
  //     const res = await zabbix.method("host.create", p);
  //   }
  // } catch (e) {
  //   console.log("count",count);
  //   console.log(e);
  // }

  // почему то не сработало сразу все добавить ???
  // теперь надо бота настроить и отчеты

  // let res = await zabbix.method("host.get", { output: [ "hostid" ], selectHostGroups: [ "groupid" ], tags: [ { tag: "human", value: "80obj" } ] });
  // console.log(res.length);
  // console.log(res[0]);

  // for (let data of res) {
  //   //data.hostgroups.push({ groupid: "147" }); // группа 25 объектов образования
  //   data.hostgroups.push({ groupid: "148" }); // группа 80 объектов образования
  //   data.groups = data.hostgroups;
  //   data.hostgroups = undefined;
  // }

  // for (const data of res) {
  //   //console.log(data);
  //   //const res2 = await zabbix.method("host.update", data);
  //   //console.log(res2);
  // }
  // console.log(res.length);

  // const res = await zabbix.method("hostgroup.get", { "output": "extend" });
  // let xlsx_out = [ [ "groupid", "name", "shortname" ] ];
  // for (const group of res) {
  //   xlsx_out.push([ group.groupid, group.name ]);
  // }

  // const buffer = xlsx.build([{name: 'Лист1', data: xlsx_out}]);
  // fs.writeFileSync("zabbix_groups.xlsx", buffer);

  const make_good_num = (num) => num < 10 ? "0"+num : ""+num;

  // let new_names_for_hosts = {};
  // const hostgroups = xlsx.parse("zabbix_groups.xlsx");
  // for (const row of hostgroups[0].data) {
  //   if (!row[0] || row[0] === "groupid") continue;
  //   const [ groupid, name, shortname ] = row;
  //   console.log("Группа", name);
  //   const obj_id = name.split(" ")[0];
  //   const res = await zabbix.method("host.get", { output: [ "hostid", "name", "host" ], selectInterfaces: "extend", selectTags: "extend", groupids: groupid });
  //   let cam_type_count = 0;
  //   // кажется хосты идут последовательно друг за другом по адресам (или как добавлены?)
  //   // так что можно не париться на счет порядка камер
  //   for (const host of res) {
  //     const address = host.interfaces[0].ip;
  //     const type = get_tag_value(host.tags, "type");
  //     if (type === "CAM") cam_type_count += 1;

  //     const final_type = type === "CAM" ? type+make_good_num(cam_type_count) : type;
  //     const new_host_name = `${obj_id} ${shortname} ${address} ${final_type}`;
  //     //console.log(new_host_name);
  //     new_names_for_hosts[host.hostid] = new_host_name;
  //   }
  //   //console.log(res[0]);
  //   //console.log(address, type);
  //   //break;
  // }

  // for (const [ hostid, name ] of Object.entries(new_names_for_hosts)) {
  //   try {
  //     const res = await zabbix.method("host.update", { hostid, name });
  //   } catch (e) {
  //     console.log(hostid, name);
  //     throw e;
  //   }
  // }

  // надо добавить миллиард камер, что нужно? адреса + название + желательно тип
  // тип для заббикса наверное будет роутер или не роутер

  const devices = xlsx.parse("актобе1.xlsx");
  // let groupnames = devices[0].data.filter(row => typeof row[0] === "string" && row[2] && row[2] !== "").map(row => { return { name: "ОВН/" + row[0].trim() }; });
  // const { groupids } = await zabbix_aqt.method("hostgroup.create", groupnames);
  // console.log("groupnames",groupnames);
  // console.log(`${groupids.length} ${groupnames.length}`);
  // let unique_names = {};
  // for (let i = 0; i < groupids.length; ++i) {
  //   const n = groupnames[i];
  //   const id = groupids[i];
  //   //if (unique_names[n]) throw 123;
  //   unique_names[n] = id;
  // }

  // fs.writeFileSync("aqtobegroups.json", JSON.stringify(unique_names, undefined, 2));

  // let unique_names = {};
  // const res = await zabbix_aqt.method("hostgroup.get", {});
  // for (const elem of res.filter(elem => elem.name.indexOf("ОВН") !== -1)) {
  //   unique_names[elem.name] = elem.groupid;
  // }

  // fs.writeFileSync("aqtobegroups.json", JSON.stringify(unique_names, undefined, 2));

  // let para = [];
  // const hostgroups = read_json("./aqtobegroups.json");
  // for (const row of devices[0].data) {
  //   const [ name, network ] = row;
  //   const devices = row.slice(2).map(dev => dev.trim());

  //   const groupname = "ОВН/"+name;
  //   if (!hostgroups[groupname]) continue;
  //   const hostgroupid = hostgroups[groupname];

  //   const subnetwork = new subnet(network);
  //   for (const dev of devices) {
  //     console.log(subnetwork.at(0), dev);
  //     const is_router = subnetwork.at(0) === dev;
  //     const tech_name = dev + (is_router ? " router" : " cam");
  //     const device_name = groupname + " | " + tech_name;

  //     let tags = [];
  //     tags.push( { tag: "target", value: dev } );
  //     tags.push( { tag: "network", value: network } );
  //     tags.push( { tag: "type", value: (is_router ? "router" : "cam") } );

  //     const param = {
  //       host: tech_name,
  //       name: device_name,
  //       interfaces: [
  //         {
  //           type: 2, // SNMP
  //           main: 1,
  //           useip: 1,
  //           ip: dev,
  //           dns: "",
  //           port: "161",
  //           details: {
  //             version: 2,
  //             community: "{$SNMP_COMMUNITY}",
  //           }
  //         }
  //       ],
  //       groups: [ { groupid: hostgroupid } ],
  //       tags,
  //       templates: [ { templateid: "10564" } ], // ICMP Ping
  //       // вообще тут было бы удобно что то добавить
  //       macros: [
  //         {
  //           macro: "{$PHYS_ADDRESS}",
  //           value: name,
  //           description: "Адрес объекта"
  //         },
  //         {
  //           macro: "{$LOCATION}",
  //           value: "54.01,23.21",
  //           description: "Координаты на карте (позже пройдусь по ЕГСВ)"
  //         }
  //       ],
  //       // не уверен что нужна будет инвентаризация, хотя будет полезно в будущем указать мак адреса и модели устройств
  //       // inventory_mode: 0,
  //       // inventory: {
  //       //   macaddress_a: "01234",
  //       //   macaddress_b: "56768"
  //       // }
  //     };

  //     para.push(param);
  //   }
    
  // }

  // console.log(para);
  // const res = await zabbix_aqt.method("host.create", para);
  // console.log(res);

  // const res = await zabbix.method("trigger.get", {
  //   'output': ['triggerid', 'description', 'expression', 'value'],
  //   'selectHosts': ['name'],
  //   'expandDescription': true,
  //   'monitored': true,
  //   groupids: [ 153 ],
  // });

  // console.log(res);
  // console.log(res[0].hosts);

  // const name_obj = {
  //   within_hour: "В течении часа",
  //   time_diff: "Разница по времени",
  //   name: "Имя",
  //   id: "ID",
  //   file: "Последний файл",
  // };

  // const res1 = await zabbix_sko.method("template.get", {
  //   search: {
  //     name: "Архив"
  //   }
  // });

  //console.log(res1);
  //for (const template of res1) {
    //if (template.host === "archive") continue;

    //const archive_id = template.name.split(" ")[1];
    //console.log(archive_id);
    //break;

    // const res2 = await zabbix_sko.method("template.update", {
    //   templateid: template.templateid,
    //   tags: [ 
    //     {
    //       tag: "doc_id",
    //       value: archive_id
    //     }
    //   ],
    //   host: `archive.${archive_id}`
    // });

    // console.log(res2);
    // console.log(archive_id);

    // const res2 = await zabbix_sko.method("item.get", {
    //   templateids: [ template.templateid ],
    // });

    // //console.log(res2);
    // for (const item of res2) {
    //   const tmp_arr = item.key_.split(".");
    //   const last_key = tmp_arr[tmp_arr.length-1];

    //   let new_key = `archive.data.${archive_id}`;
    //   let new_name = `Данные ${archive_id}`;
    //   if (tmp_arr.length > 3) {
    //     new_key = new_key + `.${last_key}`;
    //     new_name = name_obj[last_key];
    //   }


    //   const res3 = await zabbix_sko.method("item.update", {
    //     itemid: item.itemid,
    //     key_: new_key,
    //     name: new_name
    //   });
    //   console.log(res3);
    // }
    
    // if (archive_id === "014007") {
    //   const res2 = await zabbix_sko.method("trigger.get", {
    //     templateids: [ template.templateid ],
    //     output: "extend",
    //   });

    //   console.log(res2);
    // }

    // const res2 = await zabbix_sko.method("trigger.create", {
    //   description: `Нету новых архивных файлов на камере ${archive_id}`,
    //   expression: `last(/archive.${archive_id}/archive.data.${archive_id}.within_hour)="false"`,
    //   priority: 4,
    // });
    // console.log(res2);
  //}

  const res = await zabbix_sko.method("hostgroup.get", {});
})();
