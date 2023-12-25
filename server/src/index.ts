import express from "express";
import bodyParser from "body-parser";
import http from "http";
import expressWs from "express-ws";
import * as ws from "ws";

const PORT = process.env.PORT || 8080;
const SECRET = process.env.SECRET;
if(!SECRET){
    console.error("SECRET is not specified in the environment variable. aborting...");
    process.exit(1);
}

const BAN_TIME = 1000 * 60 * 5;


const app = express();
app.use(bodyParser.text({ type: "*/*" }));
const httpServer = http.createServer(app);
const appWs = expressWs(app, httpServer);

const connections:ws[] = [];
const banList:string[] = [];


function banRemoteAddress(remoteAddress:string){

    banList.push(remoteAddress);
    setTimeout(() => {
        banList.splice(banList.indexOf(remoteAddress), 1);
        console.log(remoteAddress, "is removed from ban list");
    }, BAN_TIME);
}

function isBanned(remoteAddress:string){
    return banList.includes(remoteAddress);
}

appWs.app.ws('/', function (ws, req) {

    const remoteAddress = req.socket.remoteAddress as string;

    if(isBanned(remoteAddress)) {
        ws.close();
        console.log(remoteAddress, "is in ban list");
        return;
    }



    if(req.query.secret !== SECRET) {
        console.log("Websocket", remoteAddress, "sent wrong secret:", req.query.secret, req.query);
        banRemoteAddress(remoteAddress);
        ws.close();
        return;
    }

    console.log("Websocket", remoteAddress, "connected");
    connections.push(ws);

    ws.on('close', function (msg) {
        console.log('close');
        connections.splice(connections.indexOf(ws), 1);
    });

    ws.on('message', function (msg) {
        try{
            const strString = msg.toString();
            console.log(remoteAddress, "sent:", strString);
            if(strString === 'ping'){ //active ping other than WebSocket's ping
                ws.send('pong');
            }
        }
        catch(err){
            console.log('handle websocket message error:',err);
        }
    });

    ws.on('error', function (error) {
        console.error('ws error:', error);
    });

});




app.post('/', (req, res) => {
    const body = req.body;
    const secret = req.query.secret;

    const remoteAddress = req.socket.remoteAddress as string;

    console.log("POST / :", remoteAddress, "sent:", body);

    if(isBanned(remoteAddress)) {
        console.log("POST / :", remoteAddress, "is in ban list");
        res.status(401).send();
        return;
    }

    console.log("Secret:", secret);

    if (secret !== SECRET) {
        console.log("POST / :", remoteAddress, "sent wrong secret:", secret);
        banRemoteAddress(remoteAddress);
        res.status(401).send("Unauthorized");
    }
    else if(body === "feed"){
        connections.forEach((conn) => {
            console.log("broadcasting feed to", conn.url);
            conn.send(body);
        });
        res.send("Feeding..."); 
    }
    else{
        console.log("POST / :", remoteAddress, "sent wrong payload:", body);
        banRemoteAddress(remoteAddress);
        res.status(401).send("Unauthorized");
    }

});

httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});

