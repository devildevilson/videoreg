require("dotenv").config();
const axios = require("axios");
const dahua = require("./apis/dahua");
const hikvision = require("./apis/hikvision");
const trassir = require("./apis/trassir");
const egsv_api = require("./apis/egsv");
const prtg_api = require("./apis/prtg");
const subnet = require("./apis/subnet");
const db = require("./apis/db");
const xlsx = require("node-xlsx");
const fs = require("fs");
//const google = require("./apis/google").config("jwt.keys.json");
const crypto = require("crypto");
const zabbix_api = require("./apis/zabbix");
const axios_digest = require("@mhoc/axios-digest-auth");
const http = require('http');
const mjpeg = require("./apis/mjpeg");

const zabbix_aqt = new zabbix_api({ host: "10.4.1.49", token: process.env.ZABBIX_AQT_API_TOKEN });
const zabbix_akm = new zabbix_api({ host: "10.0.67.142", token: process.env.ZABBIX_API_TOKEN });
const zabbix_sko = new zabbix_api({ host: "10.0.67.142", token: process.env.ZABBIX_API_TOKEN });

(async () => {
  const ret = await zabbix_aqt.method("host.get", { groupids: [ 121 ] });
  //console.log(ret);
  for (const cam of ret) {
    const address = cam.host.split(" ")[2];
    //console.log(address);
    //break;
    const dev = new hikvision({ host: address, user: "admin", pass: "adm12345" });
    //const r = await dev.method("/ISAPI/Streaming/channels/101");
    //const r = await dev.method("/ISAPI/System/Video/outputs/channels/101");
    //console.log(r);
    //console.log(r.data);
    //break;
    console.log(cam.name);

    const xml_data = `
<?xml version="1.0" encoding="UTF-8"?>
<StreamingChannel version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
<id>101</id>
<channelName>Camera 01</channelName>
<enabled>true</enabled>
<Video>
<enabled>true</enabled>
<videoInputChannelID>1</videoInputChannelID>
<videoCodecType>H.264</videoCodecType>
<videoScanType>progressive</videoScanType>
<videoResolutionWidth>1920</videoResolutionWidth>
<videoResolutionHeight>1080</videoResolutionHeight>
<videoQualityControlType>CBR</videoQualityControlType>
<constantBitRate>2048</constantBitRate>
<fixedQuality>60</fixedQuality>
<maxFrameRate>2000</maxFrameRate>
<keyFrameInterval>2500</keyFrameInterval>
<snapShotImageType>JPEG</snapShotImageType>
<H264Profile>Main</H264Profile>
<GovLength>50</GovLength>
<PacketType>PS</PacketType>
<PacketType>RTP</PacketType>
<smoothing>50</smoothing>
<H265Profile>Main</H265Profile>
<SmartCodec>
<enabled>false</enabled>
</SmartCodec>
</Video>
<Audio>
<enabled>false</enabled>
<audioInputChannelID>1</audioInputChannelID>
<audioCompressionType>G.711ulaw</audioCompressionType>
</Audio>
</StreamingChannel>
    `.trim();

    const r = await dev.method("/ISAPI/Streaming/channels/101", xml_data);
    console.log(r);
  }
})();