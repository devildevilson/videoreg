require("dotenv").config();
const axios = require("axios");
const https = require("https");

const convert = require("xml-js");

const ignore_set = new Set(["_declaration", "_attributes"]);

function make_sane_output_data(data, root_name) {
  let inner_data = !root_name || root_name === "" ? data : data[root_name];
  if (!inner_data) { console.log(data); throw `Bad root name ${root_name} for data`; }
  let sane_data = {};
  for (const [ key, value ] of Object.entries(inner_data)) {
    //if (key !== "_attributes" && !value._text) { console.log(value); throw `Need to implement data type for ${key} value`; }
    if (ignore_set.has(key)) continue;

    // интересно везде _text?
    if (value._text) {
      sane_data[key] = value._text;
    } else {
      sane_data[key] = make_sane_output_data(value);
    }
  }

  return sane_data;
}

function convert_output(data, root_name) {
  return make_sane_output_data(JSON.parse(convert.xml2json(data, {compact: true, spaces: 2})), root_name);
}

let prtg = function(options) {
  this.TRACE = options.log;
  this.BASEURI = options.port === "443" ? 'https://'+ options.host : 'https://'+ options.host + ':' + options.port;
  this.USER = options.user;
  this.PASS = options.pass;
  this.PASSHASH = options.hash;
  this.HOST = options.host;
  this.auth_part = options.hash ? `username=${this.USER}&passhash=${this.PASSHASH}` : `username=${this.USER}&password=${this.PASS}`;
  this.auth_part_amp = "&" + this.auth_part;
  if (!this.PASS && !this.PASSHASH) throw `At least password or password hash must be specified`;
};

prtg.prototype.sensors_stat = async function() {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/gettreenodestats.xml?${this.auth_part}`;
  const resp = await axios.get(api_url, { httpsAgent });
  return convert_output(resp.data, "data");
};

prtg.prototype.sensors_tree = async function() {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/table.xml?content=sensortree${this.auth_part_amp}`;
  const resp = await axios.get(api_url, { httpsAgent });
  return convert_output(resp.data, "prtg");
};

// что тут нужно? нужно указать некую "мастер" группу которую мы скопируем 
// затем поменять у мастер группы данные, в том числе я так понимаю удалить всех детей у группы
// или он создаст пустую группу?
prtg.prototype.add_group = async function(parent_group_id, name) {
  const final_name = encodeURIComponent(name);
  const master_id = process.env.PRTG_MASTER_GROUP;
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/duplicateobject.htm?id=${master_id}&name=${final_name}&targetid=${parent_group_id}${this.auth_part_amp}`;
  const resp = await axios.get(api_url, { httpsAgent });
  //console.log(resp);
  //console.log(resp.request.res);
  const resp_url = new URL(resp.request.res.responseUrl);
  // "https://abc.com" is dummy site to parse the URL
  const value_url = new URL("https://abc.com"+resp_url.searchParams.get("loginurl"));
  const ret_id = value_url.searchParams.get("id");
  return ret_id;
};

prtg.prototype.add_object = async function(parent_group_id, name) {
  const final_name = encodeURIComponent(name);
  const master_id = process.env.PRTG_MASTER_OBJECT;
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/duplicateobject.htm?id=${master_id}&name=${final_name}&targetid=${parent_group_id}${this.auth_part_amp}`;
  const resp = await axios.get(api_url, { httpsAgent });
  // на выходе нас интересует url
  const resp_url = new URL(resp.request.res.responseUrl);
  // "https://abc.com" is dummy site to parse the URL
  const value_url = new URL("https://abc.com"+resp_url.searchParams.get("loginurl"));
  const ret_id = value_url.searchParams.get("id");
  return ret_id;
};

prtg.prototype.add_device = async function(parent_group_id, name, host, master_id) {
  const final_name = encodeURIComponent(name);
  master_id = master_id ? master_id : process.env.PRTG_MASTER_DEVICE;
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/duplicateobject.htm?id=${master_id}&name=${final_name}&host=${host}&targetid=${parent_group_id}${this.auth_part_amp}`;
  const resp = await axios.get(api_url, { httpsAgent });
  // на выходе нас интересует url
  const resp_url = new URL(resp.request.res.responseUrl);
  // "https://abc.com" is dummy site to parse the URL
  const value_url = new URL("https://abc.com"+resp_url.searchParams.get("loginurl"));
  const ret_id = value_url.searchParams.get("id");
  return ret_id;
};

prtg.prototype.add_sensor = async function(parent_device_id, name) {
  const final_name = encodeURIComponent(name);
  const master_id = process.env.PRTG_MASTER_SENSOR;
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/duplicateobject.htm?id=${master_id}&name=${final_name}&targetid=${parent_device_id}${this.auth_part_amp}`;
  const resp = await axios.get(api_url, { httpsAgent });
  // на выходе нас интересует url
  const resp_url = new URL(resp.request.res.responseUrl);
  // "https://abc.com" is dummy site to parse the URL
  const value_url = new URL("https://abc.com"+resp_url.searchParams.get("loginurl"));
  const ret_id = value_url.searchParams.get("id");
  return ret_id;
};

prtg.prototype.delete_object = async function(object_id) {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/deleteobject.htm?id=${object_id}&approve=1${this.auth_part_amp}`;
  const resp = await axios.get(api_url, { httpsAgent });
  console.log(resp);
};

prtg.prototype.pause_object = async function(object_id, message) {
  const final_message = encodeURIComponent(message);
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/pause.htm?id=${object_id}&pausemsg=${final_message}&action=0${this.auth_part_amp}`
  await axios.get(api_url, { httpsAgent });
};

prtg.prototype.resume_object = async function(object_id) {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/pause.htm?id=${object_id}&action=1${this.auth_part_amp}`
  await axios.get(api_url, { httpsAgent });
};

prtg.prototype.set_property = async function(object_id, property_name, value) {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/setobjectproperty.htm?id=${object_id}&name=${property_name}&value=${value}${this.auth_part_amp}`;
  await axios.get(api_url, { httpsAgent });
};

prtg.prototype.get_child_groups = async function(group_id) {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/table.json?content=groups&columns=objid,name,active,parent,parentid&count=*&filter_parentid=${group_id}${this.auth_part_amp}`;
  const resp = await axios.get(api_url, { httpsAgent });
  return resp.data;
};

prtg.prototype.get_child_devices = async function(group_id) {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/table.json?content=devices&columns=objid,name,tags,host,active,parent,parentid&count=*&filter_parentid=${group_id}${this.auth_part_amp}`;
  const resp = await axios.get(api_url, { httpsAgent });
  return resp.data;
};

prtg.prototype.get_child_sensors = async function(device_id) {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/table.json?content=sensors&columns=objid,name,active,parent,parentid&count=*&filter_parentid=${device_id}${this.auth_part_amp}`;
  const resp = await axios.get(api_url, { httpsAgent });
  return resp.data;
};

prtg.prototype.get_sensors_by_tags = async function(tag) {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/table.json?content=sensors&columns=objid,name,active,parent,parentid,status&count=*&filter_tags=@tag(${tag})${this.auth_part_amp}`;
  const resp = await axios.get(api_url, { httpsAgent });
  return resp.data;
};

prtg.prototype.find_group = async function(group_id) {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/table.json?content=groups&columns=objid,name,active,parent,parentid&count=*&filter_objid=${group_id}${this.auth_part_amp}`;
  const resp = await axios.get(api_url, { httpsAgent });
  return resp.data.groups && resp.data.groups.length !== 0 ? resp.data.groups[0] : undefined;
};

prtg.prototype.find_device = async function(device_id) {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/table.json?content=devices&columns=objid,name,active,parent,parentid&count=*&filter_objid=${device_id}${this.auth_part_amp}`;
  const resp = await axios.get(api_url, { httpsAgent });
  return resp.data.devices && resp.data.devices.length !== 0 ? resp.data.devices[0] : undefined;
};

prtg.prototype.find_device_by_host = async function(host) {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/api/table.json?content=devices&columns=objid,name,tags,host,active,parent,parentid&count=*&filter_host=${host}${this.auth_part_amp}`;
  const resp = await axios.get(api_url, { httpsAgent });
  return resp.data.devices && resp.data.devices.length !== 0 ? resp.data.devices[0] : undefined;
};

const graph_type_to_num = { live: 0, "48 hours": 1, "30 days": 2, "365 days": 3 };
prtg.prototype.get_graph_image = async function(type, width, height, object_id) {
  let final_type = type;
  if (typeof type !== "number") {
    final_type = graph_type_to_num[type];
  }

  if (!final_type || type < 0 || type > 3) throw `Could not parse graph type '${type}'`;

  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const api_url = `${this.BASEURI}/chart.png?type=graph&width=${width}&height=${height}&graphid=${final_type}&id=${object_id}${this.auth_part_amp}`;
  const resp = await axios.get(api_url, { httpsAgent, responseType: 'arraybuffer' });
  return resp.data;
};

module.exports = prtg;