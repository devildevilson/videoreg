require("dotenv").config();
const mjpeg = require("./apis/mjpeg");
const dahua = require("./apis/dahua");
const hikvision = require("./apis/hikvision");
const fs = require("fs");
const exec = require('child_process').exec;
const egsv_api = require("./apis/egsv");

const objs = {
  speeds: {
    "Скоростемер 014060-01_S Обход г. Петропавловск (район Лесхоза)": "10.30.11.178",
    "Скоростемер 014060-02_S ул. Назарбаева - ул. Шажимбаева перекресток": "10.30.11.179",
    "Скоростемер 014061-01_S Челябинск - Новосибирск 615 км (кафе СССР)": "10.30.10.194",
    "Скоростемер 015001-01_S а/д «Челябинск - Новосибирск» (М-51) - 514 км. Вблизи с. Петерфельд": "10.30.12.2",
    "Скоростемер 015002-01_S а/д «Челябинск - Новосибирск» (М-51) - 584 км. поворот на с. Полудина": "10.30.12.10",
    "Скоростемер 015003-01_S а/д «Петропавловск - Ишим» (А-12) - 41 км. Поворот на с. Соколовка": "10.30.12.18",
    "Скоростемер 015004-01_S а/д «Алматы - Екатеринбург» (М-36) - 767 км. поворот на с. Токсанби со стороны г. Костанай": "10.30.12.26",
    "Скоростемер 015005-01_S а/д «Астана - Петропавловск» (А-1) - 347 км. с. Обуховка": "10.30.12.34",
    "Скоростемер 015006-01_S а/д «Кокшетау - Омск» (А-13) – 85 км. с. Чкалова АЗС «Жакупов»": "10.30.12.42",
    "Скоростемер 015007-01_S а/д «Астана - Петропавловск» (А-1) - 392 км. с. Рощинское": "10.30.12.50",
    "Скоростемер 015008-01_S а/д «Жезказган - Петропавловск» (А-16) - 794 км. Развилка на г. Сергеевка (памятник БАРС)": "10.30.12.58",
    "Скоростемер 015009-01_S а/д «Челябинск - Новосибирск» (М-51) - 565 км. с Знаменское": "10.30.12.66",
    "Скоростемер 015010-01_S а/д «Жезказган - Петропавловск» 950 км (вблизи Детского сада Мирас)": "10.30.12.74",
    "Скоростемер 015011-01_S а/д «Мамлютка - Костанай» (А-21) 102 км (заправка Эталон)": "10.30.12.82",
    "Скоростемер 015012-01_S а/д «Кокшетау - Омск» (А-13) 109 км с. Ак-кудук": "10.30.12.90",
    "Скоростемер 015013-01_S а/д «Кокшетау - Рузаевка» (Р-11) 81 км (с. Комаровка)": "10.30.12.98",
    "Скоростемер 015014-01_S а/д «Астана - Петропавловск» (А-11) 425 км (с. Аралагаш)": "10.30.12.106",
    "Скоростемер 015015-01_S а/д «Астраханка - Тайынша – Киалы - Алексеевка» (КСТ-44) 82км. с. Большой изюм": "10.30.12.114",
    "Скоростемер 015016-01_S а/д «Петропавловск - Ишим» (А-12) 41км. (с. Якорь)": "10.30.12.122",
    "Скоростемер 015017-01_S ул. Ж. Жабаева - Г. Мусрепова": "10.30.12.130",
    "Скоростемер 015018-01_S ул. Уалиханова - Айыртауская (Арка)": "10.30.12.138",
    "Скоростемер 015019-01_S ул. К. Сутюшева-Жумабаева": "10.30.12.146",
    "Скоростемер 015020-01_S ул. Рыжова (район школы №12)": "10.30.12.154",
    "Скоростемер 015021-01_S ул. Ж. Жабаева – Партизанская": "10.30.12.162",
    "Скоростемер 015022-01_S ул. Назарбаева (остановка Чкалова на арке)": "10.30.12.170",
    "Скоростемер 015023-01_S Обход г. Петропавловск (район Лесхоза)": "10.30.12.178",
  },
  crosses: {
    "015029_Перекресток_Интернациональная_Астана": {
      "обзорная_камера01": { host: "10.30.13.14", login: "user", password: "stream2024" },
      "обзорная_камера02": { host: "10.30.13.15", login: "user", password: "stream2024" },
      "обзорная_камера03": { host: "10.30.13.16", login: "user", password: "stream2024" },
      "обзорная_камера04": { host: "10.30.13.17", login: "user", password: "stream2024" },
      "фронтальная_камера01": { host: "10.30.13.10", login: "admin", password: "@dmin123" },
      "фронтальная_камера02": { host: "10.30.13.11", login: "admin", password: "@dmin123" },
      "фронтальная_камера03": { host: "10.30.13.12", login: "admin", password: "@dmin123" },
      "фронтальная_камера04": { host: "10.30.13.13", login: "admin", password: "@dmin123" },
    },
    "015030_Перекресток_Интернациональная_Жабаева": {
      "обзорная_камера01": { host: "10.30.13.46", login: "user", password: "stream2024" },
      "обзорная_камера02": { host: "10.30.13.47", login: "user", password: "stream2024" },
      "обзорная_камера03": { host: "10.30.13.48", login: "user", password: "stream2024" },
      "обзорная_камера04": { host: "10.30.13.49", login: "user", password: "stream2024" },
      "фронтальная_камера01": { host: "10.30.13.42", login: "admin", password: "@dmin123" },
      "фронтальная_камера02": { host: "10.30.13.43", login: "admin", password: "@dmin123" },
      "фронтальная_камера03": { host: "10.30.13.44", login: "admin", password: "@dmin123" },
      "фронтальная_камера04": { host: "10.30.13.45", login: "admin", password: "@dmin123" },
    },
    "015031_Перекресток_Абая_Назарбаева": {
      "обзорная_камера01": { host: "10.30.13.78", login: "user", password: "stream2024" },
      "обзорная_камера02": { host: "10.30.13.79", login: "user", password: "stream2024" },
      "обзорная_камера03": { host: "10.30.13.80", login: "user", password: "stream2024" },
      "обзорная_камера04": { host: "10.30.13.81", login: "user", password: "stream2024" },
      "фронтальная_камера01": { host: "10.30.13.74", login: "admin", password: "@dmin123" },
      "фронтальная_камера02": { host: "10.30.13.75", login: "admin", password: "@dmin123" },
      "фронтальная_камера03": { host: "10.30.13.76", login: "admin", password: "@dmin123" },
      "фронтальная_камера04": { host: "10.30.13.77", login: "admin", password: "@dmin123" },
    }
  },
  pedestrians: {
    "015024_улПушкина_район_СКГУ": {
      "фронтальная_камера01": { host: "10.30.12.187", login: "admin", password: "@dmin123" },
      "фронтальная_камера02": { host: "10.30.12.188", login: "admin", password: "@dmin123" },
    },
    "015025_улНазарбаева_ресторан_Созвездие": {
      "фронтальная_камера01": { host: "10.30.12.195", login: "admin", password: "@dmin123" },
      "фронтальная_камера02": { host: "10.30.12.196", login: "admin", password: "@dmin123" },
    },
    "015026_улСутюшева_торговый_дом_Рахмет": {
      "фронтальная_камера01": { host: "10.30.12.203", login: "admin", password: "@dmin123" },
      "фронтальная_камера02": { host: "10.30.12.204", login: "admin", password: "@dmin123" },
    },
  }
};

const escape_shell = function(cmd) {
  return  cmd.replace(/(["'$`\\])/g,'\\$1');
};

function escape_shell_arg (arg) {
    return `'${arg.replace(/'/g, `'\\''`)}'`;
}

let counter = 0;
(async () => {
  // if (!fs.existsSync("sko_photo")) fs.mkdirSync("sko_photo");
  // {
  //   for (const [key, val] of Object.entries(objs.crosses)) {
  //     const directory = `sko_photo/${key}`;
  //     console.log(key);
  //     if (!fs.existsSync(directory)) fs.mkdirSync(directory);
  //     for (const [name, data] of Object.entries(val)) {
  //       const path = `${directory}/${name}`;
  //       console.log(name);
  //       if (name.includes("фронтальная")) {
  //         //const dev = new hikvision({ host: data.host, user: data.login, pass: data.password, port: 80 });
  //         //const ab = await dev.picture(101);
  //         //fs.writeFileSync(path, ab);
  //         const rtsp_link = `rtsp://${data.login}:${data.password}@${data.host}:554/ISAPI/Streaming/Channels/101`;
  //         const ffmpeg_rtsp_link = `ffmpeg -y -nostdin -i '${rtsp_link}' -frames:v 1 -q:v 2 "${path}.png"`;
  //         console.log(ffmpeg_rtsp_link);
  //         exec(ffmpeg_rtsp_link, (error, stdout, stderr) => {
  //           if (error) { console.log(error); return; }
  //           console.log(stdout);
  //           console.log(stderr);
  //         });
  //       } else {
  //         //const dev = new dahua({ host: data.host, user: data.login, pass: data.password, port: 80 });
  //         //const ab = await dev.picture(101);
  //         //fs.writeFileSync(path, ab);
  //         const rtsp_link = `rtsp://${data.login}:${data.password}@${data.host}:554/cam/realmonitor?channel=1&subtype=0`;
  //         const ffmpeg_rtsp_link = `ffmpeg -y -nostdin -i "${rtsp_link}" -vframes 1 "${path}.png"`;
  //         console.log(ffmpeg_rtsp_link);
  //         exec(ffmpeg_rtsp_link, (error, stdout, stderr) => {
  //           if (error) { console.log(error); return; }
  //           console.log(stdout);
  //           console.log(stderr);
  //         });
  //       }
        
  //       counter += 1;
  //       //break;
  //     }
  //   }
  // }

  const egsv = new egsv_api({
    host: process.env.EGSV_HOST3,
    port: process.env.EGSV_PORT3,
    user: process.env.EGSV_USER3,
    pass: process.env.EGSV_PASS3
  });

  const ignore = {
    "10.30.9.66": true,
    "10.30.8.2": true,
    "10.30.8.82": true,
  };

  const ret = await egsv.method("camera.list", {
    "can": [
      "view",
      "update",
      "delete",
      "rtms",
      "lvs2"
    ],
    "limit": 250,
    "filter": { "_taxonomies": { "$in": [ "63527c2df731249831320261" ] } }
  });

  console.log(ret.cameras.length);
  for (const c of ret.cameras) {
    const u = new URL(c.url);
    if (ignore[u.hostname]) continue;

    try {
      const ret = await mjpeg.parse_body(c.url);
      fs.writeFileSync(`sko_photo/скоростемеры/${c.name}.jpeg`, ret[0][2]);
    } catch(e) {
      console.log(c.name, "skip");
    }
  }
})();
