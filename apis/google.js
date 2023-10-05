require("dotenv").config();
const fs = require("fs").promises;
const fss = require("fs");
//const path = require("path");
const { JWT } = require('google-auth-library');
const { google } = require("googleapis");

//const TOKEN_PATH = path.join(process.cwd(), 'token.json');
//const CREDENTIALS_PATH = path.join(process.cwd(), 'credenticals.json');

const SCOPES = [ "https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive" ];

function api(client) {
  this.client = client;
  this.drive_service = google.drive({version: 'v3', auth: this.client});
  this.sheets_service = google.sheets({version: 'v4', auth: this.client});
}

api.prototype.create_folder = async function(folder_name) {
  const fileMetadata = {
    name: folder_name,
    mimeType: 'application/vnd.google-apps.folder',
  };

  const file = await this.drive_service.files.create({
    resource: fileMetadata,
    fields: 'id',
  });
  return file.data.id;
};

api.prototype.create_spreadsheet = async function(title) {
  const resource = { properties: { title } };

  const spreadsheet = await this.sheets_service.spreadsheets.create({
    resource,
    fields: 'spreadsheetId',
  });

  return spreadsheet.data.spreadsheetId;
};

api.prototype.give_permissions_user = async function(file_id, user_email, role) {
  const body = {
    type: 'user',
    role: role ? role : 'writer', // reader/writer/organzier
    emailAddress: user_email
  };

  const response = await this.drive_service.permissions.create({
    fileId: file_id,
    resource: body
  });

  return response;
};

api.prototype.give_permissions_group = async function(file_id, group_email, role) {
  const body = {
    type: 'group',
    role: role ? role : 'writer', // reader/writer/organzier
    emailAddress: group_email
  };

  const response = await this.drive_service.permissions.create({
    fileId: file_id,
    resource: body
  });

  return response;
};

api.prototype.move_file_to = async function(file_id, folder_id) {
  this.drive_service.files.update({
    fileId: file_id,
    //uploadType: "media",
    fields: 'id, parents',
    addParents: folder_id,
  });

  console.log(`${result.data.updatedCells} cells updated.`);
};

api.prototype.read_values = async function(file_id, range) {
  const res = await this.sheets_service.spreadsheets.values.get({
    spreadsheetId: file_id,
    range,
  });

  const rows = res.data.values;
  return rows ? rows : [];
};

api.prototype.write_values = async function(file_id, range, values) {
  const resource = {
    values,
  };

  const result = await this.sheets_service.spreadsheets.values.update({
    spreadsheetId: file_id,
    range,
    //majorDimension: "ROWS",
    valueInputOption: "RAW",
    resource,
  });

  console.log(`${result.data.updatedCells} cells updated.`);
  return result.data;
};

api.prototype.append_values = async function(file_id, range, values) {
  const resource = {
    values,
  };

  const result = await this.sheets_service.spreadsheets.values.append({
    spreadsheetId: file_id,
    range,
    //majorDimension: "ROWS",
    valueInputOption: "RAW",
    resource,
  });

  console.log('%d cells updated.', result.data.updates.updatedCells);
  return result.data;
};

api.prototype.find_sheets = async function() {
  const result = await this.drive_service.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: 'nextPageToken, files(id, name)',
    spaces: 'drive',
  }).catch(e => { throw e; });

  return result.data;
};

api.prototype.find_folders = async function() {
  const result = await this.drive_service.files.list({
    q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: 'nextPageToken, files(id, name)',
    spaces: 'drive',
  }).catch(e => { throw e; });

  return result.data;
};

function create_api_obj(client) {
  //let api = { client };
  //return api;
  return new api(client);
}

function config(jwt_auth_path) {
  const data = fss.readFileSync(jwt_auth_path, "utf8");
  const keys = JSON.parse(data);

  const client = new JWT({
    email: keys.client_email,
    key: keys.private_key,
    scopes: SCOPES
  });

  return create_api_obj(client);
}

module.exports = { config };