const axios = require("axios");
const dahua = require("./apis/dahua");

(async () => {
  //const ret = await axios.get("http://10.29.32.71/cgi-bin/loadfile.cgi?action=startLoad&channel=1&startTime=2024-8-21%2023:00:01&endTime=2024-8-22%2001:00:01&subtype=0");
  //console.log(ret);

  const dev = new dahua({
    user: "admin",
    pass: "adm12345",
    host: "10.29.32.71",
    port: 80
  });

  const ret = await dev.method("/cgi-bin/loadfile.cgi?action=startLoad&channel=1&startTime=2024-8-21 23:00:01&endTime=2024-8-22 01:00:01&subtype=0");
  console.log(ret);
})();