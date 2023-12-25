import WebSocket from 'ws';
import GPIO from 'rpi-gpio'

const isPi = require('detect-rpi');

const PIN_GPIO_4 = 7;
const PING_INTERVAL = 1000*60*3;

let url = '';
if (process.env.FEEDER_SERVER_URL != undefined) {
    url = process.env.FEEDER_SERVER_URL;
} else {
    console.error('Environment variable: FEEDER_SERVER_URL is not set. aborting...');
    process.exit(1);
}

console.log('FEEDER_SERVER_URL:', url);

function startFeeding(){

    if(!isPi()){
        console.log('Running on non-Raspberry Pi environment. Should feed now.');
        return;
    }

    GPIO.write(PIN_GPIO_4, true);

    setTimeout(() => {
        GPIO.write(PIN_GPIO_4, false);
    }, 1000);
}


let connected = false;
let connecting = false;

function connect(){

    console.log('Connecting to server...');

    const ws = new WebSocket(url);

    let pingTimer: undefined | NodeJS.Timeout = undefined;

    ws.on('open', () => {
        console.log('Connected to server');
        connected = true;
        connecting = false;
    
        pingTimer = setInterval(() => {
            if(connected){
                ws.send('ping');
            }
        } ,PING_INTERVAL);

    });
    
    let lastFeed = 0;

    ws.on('message', (message: string) => {
        console.log(`Received message from server: ${message}`);
    
        try{
            const strMessage = message.toString();
            console.log("message:", strMessage);

            if(strMessage === 'feed'){
                console.log('start feeding');
                startFeeding();
            }

        }
        catch(err){
            console.log(err);
        }
    
    });
    
    ws.on('close', () => {
        connected = false;
        connecting = false;
        console.log('Disconnected from server');

        if(pingTimer !== undefined){
            clearInterval(pingTimer);
            pingTimer = undefined;
        }

        setTimeout(() => {
            console.log('Reconnecting...');
            connect();
        }, 1000);
    });

    ws.on('error', console.error);

}



function tryReconnect(){
    if(!connected){
        if(connecting){
            return;
        }
        connecting = true;
        console.log('Reconnecting...');

        try{
            connect();
        }
        catch(err){
            connecting = false;
            console.log('reconnect error:',err);
        }
    }

    setInterval(tryReconnect, 10000);
}

GPIO.setup(PIN_GPIO_4, GPIO.DIR_OUT, connect);
// connect();