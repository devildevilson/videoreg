const axios = require("axios");
const https = require("https");

const content_type_header = 'Content-Type: application/json-rpc';

function generate_unique_id(max = 100000000) {
  return Math.floor( Math.random() * max );
}

let zabbix = function(options) {
  this.HOST = options.host;
  this.TOKEN = options.token;
  this.PORT = options.port ? options.port : 80;
  this.BASEURI = `http://${this.HOST}:${this.PORT}/api_jsonrpc.php`;
};

zabbix.prototype.login = async function(username, password) {
  const id = generate_unique_id();
  const data = { jsonrpc: "2.0", method: "user.login", params: { username: ""+username, password: ""+password }, id };
  const res = await axios.post(this.BASEURI, data, { headers: { 'Content-Type': 'application/json-rpc' } });
  if (res.data.id !== id) throw `${res.data.id} !== ${id}`;
  if (res.data.error) {
    console.log(res.data.error);
    throw res.data.error;
  }
  console.log(res.data);
};

zabbix.prototype.method = async function(name, p) {
  const id = generate_unique_id();
  const data = { jsonrpc: "2.0", method: name, params: p, id };
  const res = await axios.post(this.BASEURI, data, { headers: { 'Content-Type': 'application/json-rpc', 'Authorization': `Bearer ${this.TOKEN}` } });
  if (res.data.id !== id) throw `${res.data.id} !== ${id}`;
  if (res.data.error) {
    console.log(res.data.error);
    throw res.data.error;
  }
  return res.data.result;
};

// zabbix.prototype.host_get = async function(params) {
//   const id = generate_unique_id();
//   const data = { jsonrpc: "2.0", method: "host.get", params, id };
//   const res = await axios.post(this.BASEURI, data, { headers: { 'Content-Type': 'application/json-rpc', 'Authorization': `Bearer ${this.TOKEN}` } });
//   if (res.data.error) throw res.data.error;
//   return res.data.result;
// };

module.exports = zabbix;