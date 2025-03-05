const axios = require("axios");
const https = require("https");

async function make_sane_post_request(self, url, data) {
  let resp = {};
  //try {
    resp = await axios.post(url, data, { headers: self.headers }); // , timeout: 300000
  // } catch (e) {
  //   if (e.code === "ERR_BAD_REQUEST") {
  //     //console.log(e);
  //     //return undefined;
  //     throw e;
  //   }
    
  //   await self.auth();

  //   try {
  //     resp = await axios.post(url, data, { headers: self.headers });
  //   } catch (err) {
  //     //console.log(err);
  //     //return undefined;
  //     throw err;
  //   }
  // }

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
  return this;
};

// получить все доступные камеры
egsv.prototype.camera_list = async function() {
  const get_camera_data = {
    can: [ "update", "delete", "archive" ],
    include: [ "server", "account" ],
    filter: {}, //"$or": [ { name: { "$regex": "012053", "$options": "i" } } ]
    sort: {
      name: "asc",
      "data.description": "asc"
    }
  };

  return make_sane_post_request(this, `${this.BASEURI}/v2/camera.list`, get_camera_data);
};

egsv.prototype.camera_list_filter = async function(filter) {
  return make_sane_post_request(this, `${this.BASEURI}/v2/camera.list`, filter);
};

egsv.prototype.create_camera = async function() {
  const camera_data = {
    camera: {
      api_connection: {
        brc: {
          details: {
            max_keep_days: 10
          },
          mid: "600a47a12cec33053cb35d33"
        }
      },
      secondary: {
        url: "rtsp://test1402:Xstyle1402@10.23.8.50:554/cam/realmonitor?channel=1&subtype=0"
      },
      services: {
        faceapi: false,
        guard: false
      },
      archive: {
        enable: true
      },
      ptz: {
        enable: false
      },
      taxonomies: [],
      latlng: [],
      created_at: "2021-01-21T05:14:25.403Z",
      updated_at: "2021-01-22T07:50:14.867Z",
      name: "ptz 202.10",
      url: "rtsp://test1402:Xstyle1402@10.23.8.50:554/cam/realmonitor?channel=1&subtype=0",
      server: "5f9fca6f6996bb04b071c7cb",
      data: {
        description: "",
        model: "other"
      },
      account: "5fe322f0a494fb133fb1ae95",
      id: "600a47a12cec33053cb35d33"
    }
  };

  // что нужно? url, name, description, server, taxonomies (как сделать?)
  return make_sane_post_request(this, `${this.BASEURI}/v2/camera.create`, camera_data);
};

egsv.prototype.update_camera = function(update_data) {
  let update_data1 = update_data;
  //update_data1.id = camera_id;
  const data = { merge: true, camera: update_data1 };
  return make_sane_post_request(this, `${this.BASEURI}/v2/camera.update`, data);
}

egsv.prototype.taxonomy_list = async function() {
  const data = { can: [ "update", "delete" ] };
  return make_sane_post_request(this, `${this.BASEURI}/v2/taxonomy.list`, data);
};

egsv.prototype.create_taxonomy = async function(name, parent_id) {
  const data = { taxonomy: { name: name, parent: parent_id } };
  return make_sane_post_request(this, `${this.BASEURI}/v2/taxonomy.create`, data);
};

egsv.prototype.server_list = async function() {
  const data = { include: [ "version", "info" ] }; //"id", "name", 
  return make_sane_post_request(this, `${this.BASEURI}/v2/server.list`, data);
};

egsv.prototype.sync_server = async function(server_id) {
  const data = { server: { id: server_id }, upload: false, download: true, delete: false };
  return make_sane_post_request(this, `${this.BASEURI}/v2/server.sync`, data);
};

egsv.prototype.create_server = async function(host, port, name, username = "user", password = "q1w2e3r4t5", files_strategy = "default") {
  const data = { 
    server: { 
      edge_proxy: { enable: true },
      protocol: 'http',
      api_connection: {
        driver: 'VitEDGE',
        // egsv2: {
        //   default_account: '650160e47dc13446b1009574', // ??
        //   upload: 'auto',
        //   download: 'auto'
        // },
        vit_edge: {
          username,
          password,
          files_strategy
        },
        //argus: { download: 'auto' }
      },
      host,
      port,
      name, 
    } 
  };
  return make_sane_post_request(this, `${this.BASEURI}/v2/server.create`, data);
};

egsv.prototype.update_server = async function(update_data) {
  let update_data1 = update_data;
  //update_data1.id = server_id;
  const data = { server: update_data1 };
  return make_sane_post_request(this, `${this.BASEURI}/v2/server.update`, data);
};

egsv.prototype.rtms_number_list = async function(data) {
  return make_sane_post_request(this, `${this.BASEURI}/v2/rtms.number.list`, data);
};

egsv.prototype.method = async function(method, data) {
  return make_sane_post_request(this, `${this.BASEURI}/v2/${method}`, data);
};

module.exports = egsv;