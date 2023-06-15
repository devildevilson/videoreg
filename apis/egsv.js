const axios = require("axios");
const https = require("https");

async function make_sane_post_request(self, url, data) {
  let resp = {};
  try {
    resp = await axios.post(url, data, { headers: self.headers });
  } catch (e) {
    await self.auth();

    try {
      resp = await axios.post(url, data, { headers: self.headers });
    } catch (err) {
      console.log(err);
      return undefined;
    }
  }

  return resp.data;
}

let egsv = function(options) {
  this.TRACE = options.log;
  this.BASEURI = 'http://'+ options.host + ':' + options.port;
  this.USER = options.user;
  this.PASS = options.pass;
  this.HOST = options.host;
  this.token = "";
  this.headers = {};
};

egsv.prototype.auth = async function() {
  const auth_data = {
    auth: {
      username: this.USER,
      password: this.PASS
    }
  };
  const resp = await axios.post(`${this.BASEURI}/v2/account.login`, auth_data);
  this.token = resp.data.token;
  this.headers = { "Authorization": `Bearer ${this.token}` };
  return this.headers;
};

// получить все доступные камеры
egsv.prototype.camera_list = async function() {
  const get_camera_data = {
    can: [ "update", "delete", "archive" ],
    include: [ "server", "account" ],
    filter: {},
    sort: {
      name: "asc",
      "data.description": "asc"
    }
  };

  return make_sane_post_request(this, `${this.BASEURI}/v2/camera.list`, get_camera_data);
};

module.exports = egsv;