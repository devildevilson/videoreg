const axios_digest = require("@mhoc/axios-digest-auth");
const https = require('https');

// обычно это yyyy=XXXXX, где ХХХХХ - это то что нам нужно
function single_line_resp(str) {
  const index = str.indexOf("=");
  return str.substring(index+1);
}

// обычно это yyyy=XXXXX \n yyyy=XXXXX, нужно распарсить в объект
function several_lines_simple_resp(str) {
  let ret = {};
  const lines = str.split("\r\n");
  for (const line of lines) {
    const fin_line = line.trim();
    if (fin_line === "") continue;

    const index = fin_line.indexOf("=");
    const val = fin_line.substring(index+1);
    const key = fin_line.substring(0, index);
    ret[key] = val;
  }

  return ret;
}

// по идее это обобщенная функция, которая может обработать любой вывод из дахуа камер
function parse_output(str) {
  let ret = {};
  const lines = str.trim().split("\r\n");
  if (lines.length === 1) return single_line_resp(str);
  if (lines.length === 2 && lines[1].trim() === "") return single_line_resp(str);

  for (const line of lines) {
    const fin_line = line.trim();
    if (fin_line === "") continue;

    //console.log(fin_line);
    let parts = fin_line.split("=");
    const path = parts.shift();
    const data = parts.join("=");
    const dots = path.split(".");
    let last_key = "";
    let prev = undefined;
    let cur = ret;
    for (let i = 0; i < dots.length; ++i) {
      const fin_key = dots[i].trim();
      if (fin_key === "") continue;

      //console.log(fin_key);
      const last_key = i === dots.length-1;
      const index_open = fin_key.indexOf("[");
      if (index_open < 0) {
        if (!cur[fin_key]) last_key ? cur[fin_key] = data : cur[fin_key] = {};
        prev = cur;
        cur = cur[fin_key];
        //console.log(ret);
        continue;
      }

      const index_close = fin_key.indexOf("]");
      if (index_close < 0) throw `Could not find ']' in key '${fin_key}'`;

      const final_key = fin_key.substring(0, index_open);
      const index = parseInt(fin_key.substring(index_open+1, index_close));
      if (isNaN(index)) throw `Could not parse index in key '${fin_key}'`;

      // проще сделать объектом?
      if (!cur[final_key]) cur[final_key] = [];
      while (cur[final_key].length <= index) {
        cur[final_key].push({});
      }

      if (last_key) cur[final_key][index] = data;
      prev = cur;
      cur = cur[final_key][index];
      //console.log(ret);
    }

    //cur = data;
    //console.log(ret);
  }

  const arr = Object.entries(ret);
  if (arr.length === 1) return arr[0][1]; // [ [ key, value ], [ key, value ] ... ]
  return ret;
}

async function make_sane_return(func) {
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
    if (typeof e.code === "string") {
      return { data: undefined, status: { code: -1, desc: `${e.code} ${e.reason}` } }
    }

    throw e;
  }
}

let dahua = function(options) {
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

function make_proto_method(obj, name, url, parse_func) {
  obj.prototype[name] = async function() {
    const self = this;
    return await make_sane_return(async function() {
      const httpsAgent = new https.Agent({ rejectUnauthorized: false });
      const response = await self.digest_auth.request({
        method: "GET",
        url: self.BASEURI + url,
        //httpsAgent,
      });

      if (typeof response.data !== "string") {
        throw { response: { status: response.data.Ret, statusText: response.data.Tip } };
      }

      if (typeof response.data === "string" && 
         (response.data.indexOf("The requested URL was not found on this server") !== -1 || 
          response.data.indexOf("404 File Not Found") !== -1)) {
        throw { response: { status: 404, statusText: "File Not Found" } };
      }

      return parse_func(response.data);
    });
  };
}

dahua.prototype.host = function() { return this.HOST; };
dahua.prototype.type = function() { return "dahua"; };

make_proto_method(dahua, "get_software_version", '/cgi-bin/magicBox.cgi?action=getSoftwareVersion', parse_output);
make_proto_method(dahua, "get_hardware_version", '/cgi-bin/magicBox.cgi?action=getHardwareVersion', parse_output);
make_proto_method(dahua, "get_device_type", '/cgi-bin/magicBox.cgi?action=getDeviceType', parse_output);
make_proto_method(dahua, "get_serial_no", '/cgi-bin/magicBox.cgi?action=getSerialNo', parse_output);
make_proto_method(dahua, "get_machine_name", '/cgi-bin/magicBox.cgi?action=getMachineName', parse_output);
make_proto_method(dahua, "get_system_info", '/cgi-bin/magicBox.cgi?action=getSystemInfo', parse_output);
make_proto_method(dahua, "get_device_class", `/cgi-bin/magicBox.cgi?action=getDeviceClass`, parse_output);
make_proto_method(dahua, "get_channel_title", `/cgi-bin/configManager.cgi?action=getConfig&name=ChannelTitle`, parse_output);
make_proto_method(dahua, "get_general_config", '/cgi-bin/configManager.cgi?action=getConfig&name=General', parse_output);

dahua.prototype.get_user_info = async function(username) {
  const self = this;
  return await make_sane_return(async function() {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await self.digest_auth.request({
      method: "GET",
      url: self.BASEURI + `/cgi-bin/userManager.cgi?action=getUserInfo&name=${username}`,
      //httpsAgent,
    });

    return parse_output(response.data);
  });
};

dahua.prototype.get_caps = async function(channel_index) {
  const self = this;
  return await make_sane_return(async function() {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await self.digest_auth.request({
      method: "GET",
      url: self.BASEURI + `/cgi-bin/devVideoInput.cgi?action=getCaps&channel=${channel_index}`,
      //httpsAgent,
    });

    return parse_output(response.data);
  });
};

module.exports = dahua;