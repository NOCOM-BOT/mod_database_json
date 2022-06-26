/*
Copyright (c) 2022 BadAimWeeb

This file is licensed under the MIT License.
You should have received the LICENSE file. Alternatively, license text is also
available at https://opensource.org/licenses/MIT

Node module: @nocom_bot/mod_database_json
*/

import { JsonDB } from "node-json-db";
import { join } from "node:path";

let instanceID = "unknown";
let rDataPath, dataPath = new Promise(resolve => rDataPath = resolve);

/** @type {{[id: number]: JSONDatabase}} */
let databaseList = {};
class JSONDatabase {
    jsonLocation = "";
    #database;
    saveClock;
    saving = false;

    constructor(jsonLocation) {
        this.jsonLocation = jsonLocation;
        this.#database = new JsonDB(this.jsonLocation, true, false, "/");
    }

    getData(table, key) {
        return this.#database.getData(`/${table}/${key}`);
    }

    setData(table, key, value) {
        this.#database.push(`/${table}/${key}`, value);
    }

    deleteData(table, key) {
        this.#database.delete(`/${table}/${key}`);
    }

    deleteTable(table) {
        this.#database.delete(`/${table}`);
    }

    disconnect() {
        this.#database.save();
        this.#database = null;
    }
}

process.once("message", (data) => {
    if (data.type === "handshake") {
        instanceID = data.id;

        process.send({
            type: "handshake_success",
            module: "database",
            module_displayname: "JSON database",
            module_namespace: "db_json"
        });

        process.send({
            type: "api_send",
            call_cmd: "get_data_folder",
            call_to: "core",
            data: null,
            nonce: "DBJS0"
        });

        process.on("message", portCallback);
    } else {
        process.exit(1);
    }
});

async function portCallback(data) {
    switch (data.type) {
        case "api_call":
            try {
                let response = await handleAPICall(data.call_cmd, data.data);

                if (response.exist) {
                    process.send({
                        type: "api_sendresponse",
                        response_to: data.call_from,
                        exist: true,
                        error: null,
                        data: response.data,
                        nonce: data.nonce
                    });
                } else {
                    process.send({
                        type: "api_sendresponse",
                        response_to: data.call_from,
                        exist: false,
                        nonce: data.nonce
                    });
                }
            } catch (e) {
                process.send({
                    type: "api_sendresponse",
                    response_to: data.call_from,
                    exist: true,
                    error: String(e),
                    data: null,
                    nonce: data.nonce
                });
            }
            break;
        case "challenge":
            process.send({
                type: "challenge_response",
                challenge: data.challenge
            });
            break;
        case "api_response":
            if (data.nonce === "DBJS0") {
                rDataPath(data.data);
            }
            break;
    }
}

async function handleAPICall(cmd, data) {
    switch (cmd) {
        case "default_cfg":
            return {
                exist: true,
                data: {
                    file: "database_default.json"
                }
            }
        case "list_db":
            return {
                exist: true,
                data: Object.entries(databaseList).map(x => ({
                    databaseID: +x[0]
                }))
            }
        case "connect_db":
            if (databaseList[data.databaseID]) throw "Database ID exists!";
            databaseList[data.databaseID] = new JSONDatabase(join(await dataPath, data.params.file));
            return {
                exist: true,
                data: {
                    success: true,
                    databaseID: data.databaseID
                }
            }
        case "get_data":
            if (!(databaseList[data.databaseID] instanceof JSONDatabase)) throw "Database ID not found.";
            try {
                return {
                    exist: true,
                    data: {
                        success: true,
                        data: databaseList[data.databaseID].getData(data.table, data.key)
                    }
                }
            } catch {
                return {
                    exist: true,
                    data: {
                        success: false,
                        data: null
                    }
                }
            }
        case "set_data":
            if (!(databaseList[data.databaseID] instanceof JSONDatabase)) throw "Database ID not found.";
            try {
                databaseList[data.databaseID].setData(data.table, data.key, data.value);
                return {
                    exist: true,
                    data: {
                        success: true
                    }
                }
            } catch {
                return {
                    exist: true,
                    data: {
                        success: false
                    }
                }
            }
        case "delete_data":
            if (!(databaseList[data.databaseID] instanceof JSONDatabase)) throw "Database ID not found.";
            databaseList[data.databaseID].deleteData(data.table, data.key);
            return {
                exist: true,
                data: {
                    success: true
                }
            }
        case "delete_table":
            if (!(databaseList[data.databaseID] instanceof JSONDatabase)) throw "Database ID not found.";
            databaseList[data.databaseID].deleteTable(data.table);
            return {
                exist: true,
                data: {
                    success: true
                }
            }
        case "disconnect":
            if (!(databaseList[data.databaseID] instanceof JSONDatabase)) throw "Database ID not found.";
            databaseList[data.databaseID].disconnect();
            delete databaseList[data.databaseID];
            return {
                exist: true,
                data: null
            }
        default:
            return {
                exist: false
            }
    }
}
