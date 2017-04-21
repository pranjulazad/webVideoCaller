function media() {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    //Video/Audio Box----------------------
    var localVideo = document.getElementById('localVideo');
    var remoteVideo = document.getElementById('remoteVideo');
    var videoCallButton = document.getElementById('videoCallButton');
    var endCallButton = document.getElementById('endCallButton');
    var instClient = document.getElementById('opt');
    //Message box------------------------
    var msg_box = document.getElementById('messages');
    var instTextclient = document.getElementById('messaging-text');
    var send_btn = document.getElementById('send');
    var text_msg = document.getElementById('msg');
    //----------------------------------------

    var your_id = null;
    var rtcConn = null;
    var dataChannel = null;
    var localVideoStream = null;
    var sender_id = null;
    var receiver_id = null;

    var websocket = new WebSocket('ws://172.31.150.82:8000/media');
    var ConCfg = {
        'iceServers':
        [{ 'url': 'stun:stun.services.mozilla.com' },
        { 'url': 'stun:stun.l.google.com:19302' }]
    };

    function initiateWebRTCConnection() {
        rtcConn = new RTCPeerConnection(ConCfg);
        rtcConn.onicecandidate = onIceCandidateHandler;
        rtcConn.onaddstream = onAddStreamHandler;
    }

    function onIceCandidateHandler(evt) {
        var towhom = instClient.options[instClient.selectedIndex].text;
        if (receiver_id === 'Online Friends') {
            return;
        }
        if (!evt && !(evt.candidate)) return;
        websocket.send(JSON.stringify({ type: 'candidate', CANDIDATE: evt.candidate, CALLEE: towhom }));
    }

    function onAddStreamHandler(evt) {
        //console.log("stream");
        videoCallButton.setAttribute("disabled", true);
        endCallButton.removeAttribute("disabled");
        instClient.setAttribute("disabled", true);
        remoteVideo.src = URL.createObjectURL(evt.stream);
    }

    function checkForWebRTC() {
        if (navigator.getUserMedia) {
            videoCallButton.removeAttribute("disabled");
        } else {
            console.log("Your Browser Doesn't Support WebRtc");
        }
    }

    videoCallButton.addEventListener('click', function () {
        receiver_id = instClient.options[instClient.selectedIndex].text;
        if (receiver_id === 'Online Friends') {
            return;
        }
        initiateWebRTCConnection();
        navigator.getUserMedia({ video: true, audio: true }, loadStream, loadFailed);
    })

    function loadStream(stream) {
        localVideoStream = stream;
        localVideo.src = URL.createObjectURL(localVideoStream);
        console.log(localVideo.src +"<-----");
        rtcConn.addStream(localVideoStream);
        createAndSendOffer();
    }

    function loadFailed(err) {
        console.log('error in loading the stream : ' + err);
    }

    endCallButton.addEventListener('click', function () {
        var towhom = instClient.options[instClient.selectedIndex].text;
        websocket.send(JSON.stringify({ type: 'disconnectClient', CALL: towhom }));
        endCall();
    })

    function endCall() {
        rtcConn.close();
        rtcConn = null;
        sender_id = null;
        receiver_id = null;
        videoCallButton.removeAttribute("disabled");
        endCallButton.setAttribute("disabled", true);
        try {
            instClient.removeAttribute("disabled");
        }
        catch (err) {
            console.log("Error : " + err.message);
        }
        if (localVideoStream) {
            localVideoStream.getTracks().forEach(function (track) {
                track.stop();
            });
            localVideo.src = "";
            localVideoStream = null;
        }

        if (remoteVideo) remoteVideo.src = "";
    };

    function answerCall() {
        initiateWebRTCConnection();
        navigator.getUserMedia({ "audio": true, "video": true }, function (stream) {
            localVideoStream = stream;
            localVideo.src = URL.createObjectURL(localVideoStream);
            rtcConn.addStream(localVideoStream);
            createAndSendAnswer();
        }, function (error) { console.log(error); });
    }

    function recvCall(senderName, value) {
        sender_id = senderName;
        for (var i = 0; i < instClient.length; i++) {
            if (parseInt(instClient.options[i].text) === sender_id) {
                instClient.selectedIndex = i;
                break;
            }
        }

        if (!rtcConn) answerCall();

        if (value)
            rtcConn.setRemoteDescription(new RTCSessionDescription(value));

    }

    function setRemoteVideoSDP(value) {
        if (value) {
            rtcConn.setRemoteDescription(new RTCSessionDescription(value));
        }
    }

    function setCandidate(value) {
        if (value) {
            rtcConn.addIceCandidate(new RTCIceCandidate(value));
        }
    }

    function createAndSendOffer() {
        rtcConn.createOffer(
            function (offer) {
                var makeOffer = new RTCSessionDescription(offer);
                rtcConn.setLocalDescription(new RTCSessionDescription(makeOffer),
                    function () {
                        websocket.send(JSON.stringify({ type: 'request', SDP: makeOffer, CALLEE: receiver_id, CALLER: your_id }));
                    },
                    function (error) { console.log(error); }
                );
            },
            function (error) { console.log(error); }
        );
    }

    function createAndSendAnswer() {
        rtcConn.createAnswer(
            function (answer) {
                var ans = new RTCSessionDescription(answer);
                rtcConn.setLocalDescription(ans, function () {
                    websocket.send(JSON.stringify({ type: 'response', SDP: ans, CALLER: sender_id }));
                },
                    function (error) { console.log(error); }
                );
            },
            function (error) { console.log(error); }
        );
    }


    /// ------------------------------WebSockets,to Connect With Servers and recieve Messages -------------------------

    websocket.addEventListener('message', function (evt) {
        var jData = JSON.parse(evt.data);
        var type = jData.type;

        //console.log(value);
        switch (type) {
            case 'insertClient': insertClients(type, jData.value); break;
            case 'removeClient': removeClients(jData.value, jData.client); break;
            case 'yourId': your_id = jData.value; break;
            case 'response': setRemoteVideoSDP(jData.value); break;
            case 'candidate': setCandidate(jData.value); break;
            case 'removeCall': endCall(); break;
            case 'msg': messageRecieved(jData.sender, jData.message); break;
            default: recvCall(parseInt(type), jData.value); break;
        }
    })

    websocket.onerror = function (err) {
        console.log("Got an error", err);
    };

    function removeAllOptions() {
        var i;
        for (i = instClient.options.length - 1; i >= 0; i--) {
            instClient.remove(i);
            instTextclient.remove(i);
        }
    }

    function insertOptions(optionValue) {
        var client = optionValue;
        var option = document.createElement("option");
        option.text = client;
        option.value = client;
        instClient.appendChild(option);
        var option = document.createElement("option");
        option.text = client;
        option.value = client;
        instTextclient.appendChild(option);
    }

    function insertClients(type, value) {
        var n = value.length;

        removeAllOptions();

        if (n < 2) {
            insertOptions('No One Is Online');
            return;
        }

        insertOptions('Online Friends');

        if (type === 'insertClient') {
            for (var i in value) {
                var client = value[i];
                if (client !== your_id) {
                    insertOptions(client);
                }
            }
        }

    }

    function removeClients(value, disconnectedClient) {
        var towhom = parseInt(instClient.options[instClient.selectedIndex].text);

        if (rtcConn && towhom === parseInt(disconnectedClient)) {
            endCall();
        }

        insertClients('insertClient', value);

        for (var i = 0; i < instClient.length; i++) {
            if (parseInt(instClient.options[i].text) === towhom) {
                instClient.selectedIndex = i;
                break;
            }
        }
    }


    checkForWebRTC();


    /*---------------------Below-Text Messages sending-recieving Code but Now Used Websockets To send Messages That YOu write inside 
    TextArea but for future will use dataChanneles using webrtc that I also used above for video/audio chat*/

    send_btn.addEventListener('click', function () {
        var client = instTextclient.options[instTextclient.selectedIndex].text;
        var msg = text_msg.value;
        var ms = null;
        text_msg.value = "";

        if (msg === "") {
            return;
        }

        if (client == "Online Friends") {
            ms = "Your msg To All";
            addDiv(ms, msg);
            websocket.send(JSON.stringify({
                type: "ALL",
                sender: your_id,
                message: msg
            }));
        } else {
            client = parseInt(client);
            ms = "Your msg To " + client;
            addDiv(ms, msg);
            websocket.send(JSON.stringify({
                type: "Individual",
                sender: your_id,
                receiver: client,
                message: msg
            }));
        }

    })

    function messageRecieved(sender, message) {
        if (parseInt(sender) !== your_id) {
            addDiv(sender, message);
        }
    }

    function addDiv(sender, message) {
        var text = document.createTextNode(sender + " : " + message);
        msg_box.appendChild(text);
        msg_box.appendChild(document.createElement("br"));
    }

}