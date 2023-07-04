const axios = require("axios");
const https = require("https");

// как брать тип устройства?

const protocol_port = {
  http: 80,
  https: 443,

};

function str_exists(str) { return str && str !== ""; }

let trassir = function(options) {
  this.TRACE = options.log;
  this.PROTOCOL = str_exists(options.protocol) ? options.protocol : "https";
  this.PORT = str_exists(options.port) ? options.port : (protocol_port[this.PROTOCOL] ? protocol_port[this.PROTOCOL] : 80);
  this.HOST = options.host;
  this.BASEURI = this.PROTOCOL + "://" + options.host + ':' + this.PORT;
  this.USER = options.user;
  this.PASS = options.pass;

  //this.sid = "";
  //this.sid_url = `?sid=${this.sid}`;
  this.ip_devices = null;
  this.channels = null;
  //await this.login(this.USER, this.PASS);
}

// не нужно, пользуемся паролем SDK 
// trassir.prototype.raw_login = async function(username, password) {
//   const url = `${this.BASEURI}/login?username=${username}&password=${password}`;
//   console.log(url);
//   const httpsAgent = new https.Agent({ rejectUnauthorized: false });
//   const response = await axios.get(url, { httpsAgent });
//   //console.log(response);
//   if (response.data.success === 1) {
//     this.sid = response.data.sid;
//     this.sid_url = `?sid=${this.sid}`;
//   }
// };

// trassir.prototype.login = async function() {
//   return this.raw_login(this.USER, this.PASS);
// };

trassir.prototype.objects = async function() {
  //const url = `${this.BASEURI}/objects/${this.sid_url}`;
  const url = `${this.BASEURI}/objects/?password=${this.PASS}`;
  //console.log(url);
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const response = await axios.get(url, { httpsAgent });
  //console.log(response);
  let ret_str = response.data;
  let comment_index = ret_str.indexOf("/*");
  while (comment_index !== -1) {
    const comment_end = ret_str.indexOf("*/");
    ret_str = ret_str.substring(0, comment_index) + ret_str.substring(comment_end+"*/".length);
    //console.log(ret_str);
    comment_index = ret_str.indexOf("/*");
  }
  return JSON.parse(ret_str);
};

trassir.prototype.load_objects = async function() {
  const objects = await this.objects();
  this.channels = [];
  this.ip_devices = [];
  for (const object of objects) {
    if (object["class"] === "Channel") { this.channels.push(object); }
    if (object["class"] === "IP Device") { this.ip_devices.push(object); }

    // нужно ли нам остальное?
  }
};

trassir.prototype.picture = async function(channel_id) {
  const channel_index = parseInt((""+channel_id).trim().substring(0,1));
  if (isNaN(channel_index)) throw `Could not parse channel id ${channel_id}`;
  //`${this.BASEURI}/screenshot/HTwUsj8U?password=${this.PASS}``
  if (!this.channels) { await this.load_objects(); }

  const guid = this.channels[channel_index-1].guid;
  const url = `${this.BASEURI}/screenshot/${guid}?password=${this.PASS}`;
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const response = await axios.get(url, { httpsAgent, responseType: 'arraybuffer' });

  return response.data;
};

trassir.prototype.object_data = async function(channel_id) {
  const channel_index = parseInt((""+channel_id).trim().substring(0,1));
  if (isNaN(channel_index)) throw `Could not parse channel id ${channel_id}`;
  //`${this.BASEURI}/screenshot/HTwUsj8U?password=${this.PASS}``
  if (!this.ip_devices) { await this.load_objects(); }

  const guid = this.ip_devices[channel_index-1].guid;
  const url = `${this.BASEURI}/objects/${guid}?password=${this.PASS}`;
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const response = await axios.get(url, { httpsAgent });

  return response.data;
};

module.exports = trassir;