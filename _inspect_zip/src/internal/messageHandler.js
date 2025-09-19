"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const teamsBot_1 = require("../teamsBot");
const initialize_1 = require("./initialize");
const httpTrigger = async function (context, req) {
    let status = 200;
    let return_body = null;
    const res = {
        status: (code) => {
            status = code;
            context.res.status = code;
        },
        send: (body) => {
            return_body = body;
        },
        setHeader: () => { },
        end: () => { },
    };
    await initialize_1.notificationApp.requestHandler(req, res, async (context) => {
        await teamsBot_1.teamsBot.run(context);
        await teamsBot_1.teamsMessageBot.run(context); //disregard the error
    });
    context.res = {
        status,
        body: return_body,
    };
    return return_body;
};
exports.default = httpTrigger;
//# sourceMappingURL=messageHandler.js.map