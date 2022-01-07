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

let databaseList = {};
class JSONDatabase {
    jsonLocation = "";
    dbName = "";

    constructor(jsonLocation, name) {
        this.jsonLocation = jsonLocation;
        this.dbName = name;
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
            throw "Not implemented";
        default:
            return {
                exist: false
            }
    }
}
