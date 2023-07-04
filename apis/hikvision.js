const axios_digest = require("@mhoc/axios-digest-auth");
const https = require('https');

const convert = require('xml-js');
//var result = convert.xml2json(xml, {compact: true, spaces: 2});

function make_sane_output_data(data, root_name) {
  if (!data[root_name]) { console.log(data); throw `Bad root name ${root_name} for data`; }

  let inner_data = data[root_name];
  let sane_data = {};
  for (const [ key, value ] of Object.entries(inner_data)) {
    if (key !== "_attributes" && !value._text) { console.log(value); throw `Need to implement data type for ${key} value`; }
    sane_data[key] = value._text;
  }

  return sane_data;
}

// блен возвращает тег со значением как '"tag": { _text: "value" }', когда тут было бы неплохо сократить
function convert_output(data, root_name) {
  return make_sane_output_data(JSON.parse(convert.xml2json(data, {compact: true, spaces: 2})), root_name);
}

async function make_sane_return(func) {
  // try {
  //   const data = await func();
  // } catch (e) {
  //   //console.log(e);
  //   //assert(false);
  //   throw e;
  // }
  // console.log(data);
  // assert(1 == 2);

  try {
    return { data: await func(), status: { code: 200, desc: "Ok" } };
  } catch (e) {
    if (e.errno) {
      return { data: undefined, status: { code: e.errno, desc: e.code } }
    }

    if (e.response) {
      return { data: undefined, status: { code: e.response.status, desc: e.response.statusText } }
    }

    //console.log(e);
    if (typeof e.code === "string") {
      return { data: undefined, status: { code: -1, desc: `${e.code} ${e.reason}` } }
    }

    throw e;
  }
}

const protocol_port = {
  http: 80,
  https: 443,

};

function str_exists(str) { return str && str !== ""; }

let hikvision = function(options) {
  this.TRACE = options.log;
  this.PROTOCOL = str_exists(options.protocol) ? options.protocol : "http";
  this.PORT = str_exists(options.port) ? options.port : (protocol_port[this.PROTOCOL] ? protocol_port[this.PROTOCOL] : 80);
  this.HOST = options.host;
  this.BASEURI = this.PROTOCOL + "://" + options.host + ':' + this.PORT;
  this.USER = options.user;
  this.PASS = options.pass;

  this.digest_auth = new axios_digest.default({
    username: this.USER,
    password: this.PASS,
  });
}

hikvision.prototype.host = function() { return this.HOST; };
hikvision.prototype.type = function() { return "hikvision"; };

hikvision.prototype.system_status = async function() {
  const path = "/ISAPI/System/status";
  const self = this;
  const ret = await make_sane_return(async function() {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await self.digest_auth.request({
      method: "GET",
      url: self.BASEURI + path,
      //httpsAgent,
    });

    if (typeof response.data === "string" && 
       (response.data.indexOf("The requested URL was not found on this server") !== -1 || 
        response.data.indexOf("404 File Not Found") !== -1)) {
      throw { response: { status: 404, statusText: "File Not Found" } };
    }

    if (response.request.path !== path) {
      throw { response: { status: 404, statusText: "Path Not Found" } };
    }

    return response.data;
  });

  const data = ret.data ? convert_output(ret.data, "Status") : undefined;
  return { data, status: ret.status };
}

hikvision.prototype.system_device_info = async function() {
  const path = "/ISAPI/System/deviceInfo";
  const self = this;
  const ret = await make_sane_return(async function() {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await self.digest_auth.request({
      method: "GET",
      url: self.BASEURI + "/ISAPI/System/deviceInfo",
      httpsAgent,
    });

    if (typeof response.data === "string" && 
       (response.data.indexOf("The requested URL was not found on this server") !== -1 || 
        response.data.indexOf("404 File Not Found") !== -1)) {
      throw { response: { status: 404, statusText: "File Not Found" } };
    }

    if (response.request.path !== path) {
      throw { response: { status: 404, statusText: "Path Not Found" } };
    }

    //console.log(response);
    return response.data;
  });

  //console.log(ret);
  const data = ret.data ? convert_output(ret.data, "DeviceInfo") : undefined;
  return { data, status: ret.status };
}

// отправим строку (или число) вида: А0В, где А - номер канала, В - номер доп канала (обычно 1 или 2)
// например 101 или 201
hikvision.prototype.picture = async function(channel_id) {
  const req_url = `${this.BASEURI}/ISAPI/Streaming/channels/${channel_id}/picture`;
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const response = await this.digest_auth.request({
    method: "GET",
    url: req_url,
    httpsAgent,
    responseType: 'arraybuffer'
  });

  if (typeof response.data === "string" && 
     (response.data.indexOf("The requested URL was not found on this server") !== -1 || 
      response.data.indexOf("404 File Not Found") !== -1)) {
    throw { response: { status: 404, statusText: "File Not Found" } };
  }

  if (response.request.path !== path) {
      throw { response: { status: 404, statusText: "Path Not Found" } };
    }

  //console.log(response);
  return response.data;
}

hikvision.prototype.device_info = async function() {
  const info = await this.system_device_info();
  if (!info.data) return info;

  //console.log(info);
  return { data: { type: info.data.deviceType, model: info.data.model }, status: { code: 200, desc: "Ok" } };
}

module.exports = hikvision;