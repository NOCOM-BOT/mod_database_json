/*
Copyright (c) 2022 BadAimWeeb

This file is licensed under the MIT License.
You should have received the LICENSE file. Alternatively, license text is also
available at https://opensource.org/licenses/MIT

Node module: @nocom_bot/mod_database_json
*/

import worker, { parentPort } from "node:worker_threads";
import { promises as fsPromises } from "node:fs";

let instanceID = "unknown";
if (worker.isMainThread) {
    console.log("This module must be run using NOCOM_BOT core's module loader.");
    process.exit(1);
}

/** @type {{[id: number]: JSONDatabase}} */
let databaseList = {};
class JSONDatabase {
    jsonLocation = "";
    dbName = "";
    #data = {};
    #lastRefresh = 0;
    saveClock;
    saving = false;

    constructor(jsonLocation, name) {
        this.jsonLocation = jsonLocation;
        this.dbName = name;

        this.saveClock = setInterval(async () => {
            if (!this.saving) {
                this.saving = true;
                await this.save();
                this.saving = false;
            }
        })
    }

    async refresh() {
        if (this.#lastRefresh + 15000 <= Date.now()) {
            let jsonData = JSON.parse(await fsPromises.readFile(this.jsonLocation));
            this.#data = jsonData;
        }
    }

    async save() {
        await fsPromises.writeFile(JSON.stringify(this.#data, null, "\t"));
    }

    async getData(table, key) {
        await this.refresh();
        if (!Object.hasOwn(this.#data, table)) {
            this.#data[table] = {};
        }

        return this.#data[table][key];
    }

    async setData(table, key, value) {
        await this.refresh();
        if (!Object.hasOwn(this.#data, table)) {
            this.#data[table] = {};
        }

        this.#data[table][key] = value;
    }

    async deleteData(table, key) {
        await this.refresh();

        if (!Object.hasOwn(this.#data, table)) {
            this.#data[table] = {};
        }

        delete this.#data[table][key];
    }

    async deleteTable(table) {
        await this.refresh();

        delete this.#data[table];
    }

    disconnect() {
        clearInterval(this.saveClock);
    }
}

parentPort.once("message", (data) => {
    if (data.type === "handshake") {
        instanceID = data.id;

        parentPort.postMessage({
            type: "handshake_success",
            module: "database",
            module_displayname: "JSON database",
            module_namespace: "db_json"
        });

        parentPort.on("message", portCallback);
    } else {
        process.exit(1);
    }
});

async function portCallback(data) {
    if (data.type === "api_call") {
        try {
            let response = await handleAPICall(data.call_cmd, data.data);

            if (response.exist) {
                parentPort.postMessage({
                    type: "api_sendresponse",
                    response_to: data.call_from,
                    exist: true,
                    error: null,
                    data: response.data,
                    nonce: data.nonce
                });
            } else {
                parentPort.postMessage({
                    type: "api_sendresponse",
                    response_to: data.call_from,
                    exist: false,
                    nonce: data.nonce
                });
            }
        } catch (e) {
            parentPort.postMessage({
                type: "api_sendresponse",
                response_to: data.call_from,
                exist: true,
                error: String(e),
                data: null,
                nonce: data.nonce
            });
        }
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
                    databaseID: +x[0],
                    databaseName: x[1].dbName
                }))
            }
        case "connect_db":
            if (databaseList[data.databaseID]) throw "Database ID exists!";
            databaseList[data.databaseID] = new JSONDatabase(data.params.file, data.databaseName);
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
                await databaseList[data.databaseID].setData(data.table, data.key, data.value);
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
            await databaseList[data.databaseID].deleteData(data.table, data.key);
            return {
                exist: true,
                data: {
                    success: true
                }
            }
        case "delete_table":
            if (!(databaseList[data.databaseID] instanceof JSONDatabase)) throw "Database ID not found.";
            await databaseList[data.databaseID].deleteTable(data.table);
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
