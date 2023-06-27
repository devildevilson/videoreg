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

module.exports = prtg;