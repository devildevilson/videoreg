const axios_digest = require("@mhoc/axios-digest-auth");
const https = require('https');

const convert = require('xml-js');
//var result = convert.xml2json(xml, {compact: true, spaces: 2});

const timeout = 30000;

function make_sane_xml_value(val) {
  if (val === "true") return true;
  if (val === "false") return false;
  if (/^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$/.test(val)) return parseFloat(val);
  if (/^\d+$/.test(val)) return parseInt(val);
  return val;
}

function make_sane_output_data_rec(data) {
  if (Array.isArray(data)) {
    let sane_data = [];
    for (const value of data) {
      if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) continue;
      // если текста нет, то надо бы просто распарсить это дело рекурсивно
      if (!value._text) { sane_data.push( make_sane_output_data_rec(value) ); continue; }
      sane_data.push( make_sane_xml_value(value._text) );
    }
    return sane_data;
  } else {
    let sane_data = {};
    for (const [ key, value ] of Object.entries(data)) {
      if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) continue;
      if (key === "_attributes") continue;
      // если текста нет, то надо бы просто распарсить это дело рекурсивно
      if (!value._text) { sane_data[key] = make_sane_output_data_rec(value); continue; }
      sane_data[key] = make_sane_xml_value(value._text);
    }
    return sane_data;
  }
}

function make_sane_output_data(data, root_name) {
  if (!data[root_name]) { console.log(data); throw `Bad root name ${root_name} for data`; }

  let inner_data = data[root_name];
  let sane_data = {};
  for (const [ key, value ] of Object.entries(inner_data)) {
    if (typeof value === "object" && Object.keys(value).length === 0) continue;
    if (key === "_attributes") continue;
    // если текста нет, то надо бы просто распарсить это дело рекурсивно
    if (!value._text) { sane_data[key] = make_sane_output_data_rec(value); continue; } //console.log(value); console.log(sane_data[key]);
    sane_data[key] = make_sane_xml_value(value._text);
  }

  return sane_data;
}

// блен возвращает тег со значением как '"tag": { _text: "value" }', когда тут было бы неплохо сократить
function convert_output(data, root_name) {
  return make_sane_output_data(JSON.parse(convert.xml2json(data, {compact: true, spaces: 2})), root_name);
}

function convert_output_raw(data) {
  return JSON.parse(convert.xml2json(data, {compact: true, spaces: 2}));
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

    if (e.message && e.message === "canceled") {
      return { data: undefined, status: { code: -2, desc: e.message } }
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
  this.TIMEOUT = options.timeout ? options.timeout : timeout;

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
      signal: AbortSignal.timeout(self.TIMEOUT),
      timeout: self.TIMEOUT,
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
      signal: AbortSignal.timeout(self.TIMEOUT),
      timeout: self.TIMEOUT,
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
  const self = this;
  const req_url = `${this.BASEURI}/ISAPI/Streaming/channels/${channel_id}/picture`;
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const response = await this.digest_auth.request({
    method: "GET",
    url: req_url,
    httpsAgent,
    responseType: 'arraybuffer',
    signal: AbortSignal.timeout(self.TIMEOUT),
    timeout: self.TIMEOUT,
  });

  if (typeof response.data === "string" && 
     (response.data.indexOf("The requested URL was not found on this server") !== -1 || 
      response.data.indexOf("404 File Not Found") !== -1)) {
    throw { response: { status: 404, statusText: "File Not Found" } };
  }

  if (response.request.path !== req_url) {
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

hikvision.prototype.channels_params = async function() {
  const path = `/ISAPI/Image/channels`;
  const self = this;
  const ret = await make_sane_return(async function() {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await self.digest_auth.request({
      method: "GET",
      url: self.BASEURI + path,
      httpsAgent,
      signal: AbortSignal.timeout(self.TIMEOUT),
      timeout: self.TIMEOUT,
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

  //console.log(ret.data);
  const data = ret.data ? convert_output(ret.data, "ImageChannellist") : undefined;
  return { data, status: ret.status };
};

hikvision.prototype.video_params = async function() {
  const path = `/ISAPI/System/Video/outputs/channels`;
  const self = this;
  const ret = await make_sane_return(async function() {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await self.digest_auth.request({
      method: "GET",
      url: self.BASEURI + path,
      httpsAgent,
      signal: AbortSignal.timeout(self.TIMEOUT),
      timeout: self.TIMEOUT,
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

  //console.log(ret.data);
  const data = ret.data ? convert_output(ret.data, "VideoOutputChannelList") : undefined;
  return { data, status: ret.status };
};

hikvision.prototype.streaming_params = async function(channel_id) {
  const path = channel_id ? `/ISAPI/Streaming/channels/${channel_id}` : `/ISAPI/Streaming/channels`;
  const self = this;
  const ret = await make_sane_return(async function() {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await self.digest_auth.request({
      method: "GET",
      url: self.BASEURI + path,
      httpsAgent,
      signal: AbortSignal.timeout(self.TIMEOUT),
      timeout: self.TIMEOUT,
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

  //console.log(ret.data);
  const data = ret.data ? convert_output(ret.data, channel_id ? "StreamingChannel" : "StreamingChannelList") : undefined;
  return { data, status: ret.status };
};

hikvision.prototype.set_streaming_params = async function(channel_id, width, height, bit_rate, frame_rate, codec_type) {
  const frame_rate_final = frame_rate * 100;
  const codec_type_final = codec_type ? codec_type : "H.264";
  const channel_id_str = ""+channel_id;
  const sub_id = channel_id_str[channel_id_str.length-1];
  const xml_data = `
    <?xml version="1.0" encoding="UTF-8"?>
    <StreamingChannel version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
      <id>${channel_id}</id>
      <channelName>Input 1 MPEG-4 ASP</channelName>
      <enabled>true</enabled>
      <Transport>
        <rtspPortNo>554</rtspPortNo>
        <maxPacketSize>1446</maxPacketSize>
        <ControlProtocolList>
        <ControlProtocol>
          <streamingTransport>RTSP</streamingTransport>
        </ControlProtocol>
        <ControlProtocol>
          <streamingTransport>HTTP</streamingTransport>
        </ControlProtocol>
        </ControlProtocolList>
      </Transport>
      <Video>
        <enabled>true</enabled>
        <videoInputChannelID>${sub_id}</videoInputChannelID>
        <videoCodecType>${codec_type_final}</videoCodecType>
        <videoScanType>progressive</videoScanType>
        <videoResolutionWidth>${width}</videoResolutionWidth>
        <videoResolutionHeight>${height}</videoResolutionHeight>
        <videoPositionX>0</videoPositionX>
        <videoPositionY>0</videoPositionY>
        <videoQualityControlType>VBR</videoQualityControlType>
        <constantBitRate>${bit_rate}</constantBitRate>
        <maxFrameRate>${frame_rate_final}</maxFrameRate>
        <keyFrameInterval>1000</keyFrameInterval>
        <rotationDegree>0</rotationDegree>
        <mirrorEnabled>false</mirrorEnabled>
        <snapShotImageType>JPEG</snapShotImageType>
        <vbrUpperCap>${bit_rate}</vbrUpperCap>
      </Video>
      <Audio>
        <enabled>false</enabled>
        <audioInputChannelID>2</audioInputChannelID>
        <audioCompressionType>G.726</audioCompressionType>
        <audioBitRate>24</audioBitRate>
        <audioSamplingRate>8</audioSamplingRate>
      </Audio>
    </StreamingChannel>
  `;

  const path = `/ISAPI/Streaming/channels/${channel_id}`;
  const self = this;
  const ret = await make_sane_return(async function() {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await self.digest_auth.request({
      method: "PUT",
      url: self.BASEURI + path,
      httpsAgent,
      signal: AbortSignal.timeout(self.TIMEOUT),
      timeout: self.TIMEOUT,
      headers: { 'Content-Type': 'application/xml; charset="UTF-8"' },
      data: xml_data
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

  //console.log(ret.data);
  const data = ret.data ? convert_output(ret.data, "ResponseStatus") : undefined;
  return { data, status: ret.status };
};

hikvision.prototype.method = async function(path, xml_data) {
  const self = this;
  const ret = await make_sane_return(async function() {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await self.digest_auth.request({
      method: xml_data ? "PUT" : "GET",
      url: self.BASEURI + path,
      httpsAgent,
      signal: AbortSignal.timeout(self.TIMEOUT),
      timeout: self.TIMEOUT,
      headers: xml_data ? { 'Content-Type': 'application/xml; charset="UTF-8"' } : undefined,
      data: xml_data
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

  //const data = ret.data ? convert_output_raw(ret.data) : undefined;
  const data = ret.data;
  return { data, status: ret.status };
};

module.exports = hikvision;