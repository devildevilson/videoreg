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
    //return { data: undefined, status: { code: -1, desc: "Undefined error" } }
    throw e;
  }
}

let hikvision = function(options) {
  this.TRACE = options.log;
  this.BASEURI = 'http://'+ options.host + ':' + options.port;
  this.USER = options.user;
  this.PASS = options.pass;
  this.HOST = options.host;

  this.digest_auth = new axios_digest.default({
    username: this.USER,
    password: this.PASS,
  });
}

hikvision.prototype.host = function() { return this.HOST; };
hikvision.prototype.type = function() { return "hikvision"; };

hikvision.prototype.system_status = async function() {
  const self = this;
  const ret = await make_sane_return(async function() {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await self.digest_auth.request({
      method: "GET",
      url: self.BASEURI + '/ISAPI/System/status',
      //httpsAgent,
    });

    if (typeof response.data === "string" && 
       (response.data.indexOf("The requested URL was not found on this server") !== -1 || 
        response.data.indexOf("404 File Not Found") !== -1)) {
      throw { response: { status: 404, statusText: "File Not Found" } };
    }

    return response.data;
  });

  const data = ret.data ? convert_output(ret.data, "Status") : undefined;
  return { data, status: ret.status };
}

hikvision.prototype.system_device_info = async function() {
  const self = this;
  const ret = await make_sane_return(async function() {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await self.digest_auth.request({
      method: "GET",
      url: self.BASEURI + '/ISAPI/System/deviceInfo',
      httpsAgent,
    });

    if (typeof response.data === "string" && 
       (response.data.indexOf("The requested URL was not found on this server") !== -1 || 
        response.data.indexOf("404 File Not Found") !== -1)) {
      throw { response: { status: 404, statusText: "File Not Found" } };
    }

    //console.log(response);
    return response.data;
  });

  //console.log(ret);
  const data = ret.data ? convert_output(ret.data, "DeviceInfo") : undefined;
  return { data, status: ret.status };
}

module.exports = hikvision;