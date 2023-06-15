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

make_proto_method(dahua, "get_software_version", '/cgi-bin/magicBox.cgi?action=getSoftwareVersion', single_line_resp);
make_proto_method(dahua, "get_hardware_version", '/cgi-bin/magicBox.cgi?action=getHardwareVersion', single_line_resp);
make_proto_method(dahua, "get_device_type", '/cgi-bin/magicBox.cgi?action=getDeviceType', single_line_resp);
make_proto_method(dahua, "get_serial_no", '/cgi-bin/magicBox.cgi?action=getSerialNo', single_line_resp);
make_proto_method(dahua, "get_machine_name", '/cgi-bin/magicBox.cgi?action=getMachineName', single_line_resp);
make_proto_method(dahua, "get_system_info", '/cgi-bin/magicBox.cgi?action=getSoftwareVersion', single_line_resp);
make_proto_method(dahua, "get_device_class", `/cgi-bin/magicBox.cgi?action=getDeviceClass`, single_line_resp);
make_proto_method(dahua, "get_channel_title", `/cgi-bin/configManager.cgi?action=getConfig&name=ChannelTitle`, single_line_resp);
make_proto_method(dahua, "get_general_config", '/cgi-bin/configManager.cgi?action=getConfig&name=General', single_line_resp);

dahua.prototype.get_user_info = async function(username) {
  const self = this;
  return await make_sane_return(async function() {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await self.digest_auth.request({
      method: "GET",
      url: self.BASEURI + `/cgi-bin/userManager.cgi?action=getUserInfo&name=${username}`,
      //httpsAgent,
    });

    return several_lines_simple_resp(response.data);
  });
};

module.exports = dahua;