var express = require('express');
var app = express();
var http = require('http');
var webSocket = require('ws').Server;
var wss = null;

var clients = [];
var count = 0;
var users = [];

var closedClientconnection = null;

app.set('view engine', 'ejs');
app.use(express.static('assets'));

app.get('/media', function (req, res) {
    res.render('front');
})

var port = process.env.PORT || 8000;

var srv = http.createServer(app).listen(port,"0.0.0.0",function(){
    console.log("server is running");
});

wss = new webSocket({ server: srv });

wss.on('connection', function (conn) {
    //console.log('new Client connected');
    var id = count++;
    clients.push(conn);
    conn.name = id;
    users.push(id);
    console.log('new Client connected with id : ' + conn.name);
    conn.send(JSON.stringify({ type: 'yourId', value: conn.name }));

    //conn.send(JSON.stringify({type : 'insertClient' , value : clients}));    

    broadcastMessage('insertClient');

    conn.on('message', function (data) {
        var jdata = JSON.parse(data);
        var type = jdata.type;

        switch (type) {
            case 'request': sendToCallee(jdata.SDP, jdata.CALLEE,jdata.CALLER); break;
            case 'response': sendToCaller(jdata.SDP, jdata.CALLER); break;
            case 'candidate': newCandidate(jdata.CANDIDATE, jdata.CALLEE); break;
            case 'disconnectClient': removeClient(jdata.CALL); break;
            case 'ALL': send_msg_all(jdata.sender,jdata.message); break;
            case 'Individual': send_msg_to(jdata.sender,jdata.message,jdata.receiver); break;
            default: break;
        }
    })

    conn.on('close', function (reasonCode, description) {
        closedClientconnection = parseInt(conn.name);
        clients.splice(clients.indexOf(conn), 1);
        users.splice(users.indexOf(conn.name), 1);
        broadcastMessage('removeClient');
        console.log('client id : ' + conn.name + ' has been disconnected');
    })

})

function newCandidate(candidate,callee){
    if(!callee){
        return;
    }
    clients[users.indexOf(parseInt(callee))].send(JSON.stringify({ type: 'candidate', value: candidate }));
}

function removeClient(call){
    clients[users.indexOf(parseInt(call))].send(JSON.stringify({ type: 'removeCall'}));
}

function sendToCallee(sdp,callee,caller) {
    var index = users.indexOf(parseInt(callee));
    var client = clients[index];
    client.send(JSON.stringify({ type: caller, value: sdp }));
}

function sendToCaller(sdp,caller) {
    clients[users.indexOf(parseInt(caller))].send(JSON.stringify({ type: 'response', value: sdp }));
}

function broadcastMessage(types) {
    for (var i in clients) {
        var client = clients[i];
        client.send(JSON.stringify({ type: types, value: users , client : closedClientconnection}));
    }
    closedClientconnection = null;
}

function send_msg_all(sendBy,msg){
    for (var i in clients) {
        var client = clients[i];
        if(parseInt(sendBy) !== parseInt(users[i]))
            client.send(JSON.stringify({ type: "msg",sender : sendBy,message : msg}));
    }
}

function send_msg_to(sendBy,msg,receiver){
    for (var i in clients) {
        var client = clients[i];
        if(parseInt(sendBy) !== parseInt(users[i]))
            client.send(JSON.stringify({ type: "msg",sender : sendBy,message : msg}));
    }
}