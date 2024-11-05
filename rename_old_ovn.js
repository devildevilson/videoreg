require("dotenv").config();
const egsv_api = require("./apis/egsv");
const axios = require("axios");
const ip_regex = /^((25[0-5]|(2[0-4]|1[0-9]|[1-9]|)[0-9])(\.(?!$)|$)){4}$/;
const fs = require("fs");

function pseudo_constructor_camera(){
	let camera = {
		"name": '',
		"url": '',
		"server": '66ea7c42ac02e803307ec47f'
	}
    let ptz = {
        "enable": false,
    }
    let secondary = {
        "url": ''
    }
    let data = {
        "description": ''
    }

/**/
	camera["ptz"] = ptz;
	camera["secondary"] = secondary;
	camera["data"] = data;
	camera["latlng"] = [];

	return camera;
/**/
}

function fill_the_record(name, url, ptz, descr, coord, rec){
	let latlngarr = [];
	let i = 0;
	let j = 0;
	let lon = '';
	let lan = '';
/**/
	rec["name"] = name;
	rec["url"] = url;
	if (ptz === "TRUE"){	
		rec.ptz["enable"] = true;
		rec.ptz["username"] = 'user';
		rec.ptz["password"] = 'ptzman2024';
	}
	rec.secondary["url"] = url.replace("/101", "/102");
	rec.data["description"] = descr;

	latlngarr[j] = '';
	for(i = 0; i < coord.length; i++){
		if (coord[i] !== ','){
			latlngarr[j] = latlngarr[j] + coord[i]	
		}
		else{
			j = j + 1;
			latlngarr[j] = '';
		}
	}
	latlngarr[0] = parseFloat(latlngarr[0]);
	latlngarr[1] = parseFloat(latlngarr[1]);
	rec["latlng"] = latlngarr;
/**/		
}

function extract(line){
    let strarr = [];
    let i = 0;
    let j = 0;
    let buf = '';
/**/
    for (i = 0; i < line.length; i++){
        if (line[i] !== ';'){
			buf = buf + line[i];
        }
        else{
			strarr[j] = buf;
            j = j + 1;
			buf = '';
        }
    }
	strarr[j] = buf;

    return strarr;
/**/
}

function add_to_collection(col, params){
	let camObj = {};
/**/
	camObj = pseudo_constructor_camera();
	fill_the_record(params[0], params[4], params[7], (params[2] + ',' + params[3]), params[6], camObj);
	col.push(camObj);
/**/
	
}

function cameras_from_csv(filename, objArr){
	let i = 0;
	let buf = '';
	let file_buf_str = '';
	let paramArr = '';
/**/
	file_buf_str = fs.readFileSync(filename, { encoding: 'utf-8', flag: 'r' });

	for (i = 0; i < file_buf_str.length; i++){
		if (file_buf_str[i] !== '\n'){
			buf = buf + file_buf_str[i];
		}
		else{
			paramArr = extract(buf);	
			add_to_collection(objArr, paramArr);
			buf = '';
		}
	}
/**/

}

(async () => {
	let egsv = new egsv_api({
   	     host: process.env.EGSV_HOST5,
   	     port: process.env.EGSV_PORT5,
   	     user: process.env.EGSV_USER5,
   	     pass: process.env.EGSV_PASS5,
	});

	let objects = [];
	cameras_from_csv('./import.csv', objects);		
	

	for (let i = 0; i < objects.length; i++){
		const egsvCameraCreate = await egsv.method("camera.create", { camera: objects[i] });
		console.log(egsvCameraCreate);
	}
})();
