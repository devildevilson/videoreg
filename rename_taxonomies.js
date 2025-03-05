require("dotenv").config();
const egsv_api = require("../apis/egsv");
const axios = require("axios");
const ip_regex = /^((25[0-5]|(2[0-4]|1[0-9]|[1-9]|)[0-9])(\.(?!$)|$)){4}$/;
const fs = require("fs");


let egsv = new egsv_api({
	host: process.env.EGSV_HOST6,
	port: process.env.EGSV_PORT6,
	user: process.env.EGSV_USER6,
	pass: process.env.EGSV_PASS6,
});


function extract_data(line){ //:array
	let strArr = [];
	let i = 0;
	let j = 0;
	let buf = '';
/**/
	for (i = 0; i < line.length; i++){
		if (line[i] !== ';'){
			buf = buf + line[i];
		}
		else{
			strArr[j] = buf;
			j = j + 1;
			buf = '';
		}
	}
	strArr[j] = buf;
	
	return strArr;
/**/
}

function parse_csv(filename){//:array of objects
	let tdarray = [];
	let i = 0;
	let fileBuf = '';
	let lineBuf = '';
	let chunk = undefined;
/**/
	fileBuf = fs.readFileSync(filename, { encoding: 'utf-8', flag: 'r' }); //whole file is loaded as string

	for (i = 0; i < fileBuf.length; i++){
		if (fileBuf[i] !== '\n'){
			lineBuf = lineBuf + fileBuf[i];
		}
		else{
			chunk = extract_data(lineBuf);	
			tdarray.push(chunk);
			lineBuf = '';
		}
	}
	return tdarray;
/**/
}

async function parse_taxonomies(strarr){
	let get_egsv_taxonomies = await egsv.method("taxonomy.list");
	let rename_taxonomy = {};
	let taxbufarr = [];
	let taxbufobj = {};
	let strbuf = '';
	let i = 0;
/**/
	for (elemi of get_egsv_taxonomies.taxonomies){
		for (elemj of strarr){
			if ((elemi.name.includes(elemj[0])) && !(elemi.name.includes(elemj[1]))){
				taxbufobj = elemi;
				taxbufobj.name = elemj[2];
				taxbufarr.push(taxbufobj);
				console.log(taxbufobj);
			}
		}
	}
	
	for (elem of taxbufarr){
		rename_taxonomy = await egsv.method("taxonomy.update", { "taxonomy": { "id": elem.id, "name": elem.name }});	
	}
/**/
}


(async () =>{
	await egsv.auth();
	let newNameDataArr = [];	
	let newNamedCameras = [];
	let rename_cameras = {};
	let i = 0;
/**/
	return;
	newNameDataArr = parse_csv('./old_new_name.csv');
	await parse_taxonomies(newNameDataArr);
/**/
})();
