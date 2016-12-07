"use strict";

var admin_user = 'xxxxxxxxx';

//	Optional. You will see this name in eg. 'ps' or 'top' command

process.title = 'node-chat';

//	Port where we'll run the websocket server

var webSocketsServerPort = 3000;

//	websocket, http servers, filesystem and url module

var webSocketServer = require('websocket').server;

var http = require('http');

var fs = require('fs');

var url = require('url');

//	other Global variables

var users_reg = [];

var users_onl = [];

var clients = [];

//	get file with stored messages and continue if data is loaded

fs.readFile('text/comments.txt', 'utf8', function(err, data) {

    if (err) {

        return console.log('fs.readFile error: ' + err);

    }

    var history = JSON.parse(data);

    //	helper function for escaping input strings

    function htmlEntities(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    //	array with some colors

    var colors = ['red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange'];
    // ... in random order
    colors.sort(function(a, b) {
        return Math.random() > 0.5;
    });

    function send_updated_users_onl_array() {

        var json = JSON.stringify({
            type: 'userupdate',
            names: users_onl
        });

        for (var i = 0; i < clients.length; i++) {
            clients[i].sendUTF(json);
        }

    }

    //	HTTP server

    var server = http.createServer(function(request, response) {

        // Not important for us. We're writing WebSocket server, not HTTP server

    });

    server.listen(webSocketsServerPort, function() {

        console.log((new Date()) + " Server is listening on port " + webSocketsServerPort);

    });

    //	WebSocket server

    var wsServer = new webSocketServer({

        // WebSocket server is tied to a HTTP server. WebSocket request is just an enhanced HTTP request. For more info http://tools.ietf.org/html/rfc6455#page-6

        httpServer: server

    });

    // someone tries to connect to the WebSocket server

    wsServer.on('request', function(request) {

        console.log((new Date()) + ' Connection from origin ' + request.origin + '.');

        // is client connecting from my website ?

        if (request.origin !== 'http://david.abotsi.com') {
            return;
        }

        //	user connected

        console.log((new Date()) + ' Connection accepted.');

        var connection = request.accept('echo-protocol', request.origin);

        // need to know client index to remove them on 'close' event

        var index = clients.push(connection) - 1;

        var userName = false;

        var userColor = false;

        // first send back chat history

        if (history.length > 0) {
            connection.sendUTF(JSON.stringify({
                type: 'history',
                data: history
            }));
        }

        // user sent some message

        connection.on('message', function(message) {

            // accept only text message

            if (message.type === 'utf8') {

                // first message sent by user is their name so remember user name

                if (userName === false) {

                    var un = message.utf8Data;

                    //	separate username from password

                    var l = un.split('_')[0];

                    //	get username and password in one string for pushing into array

                    var up = un.slice(parseInt(l.length + 1));

                    //	get password only

                    var p = up.slice(parseInt(l));

                    console.log(up);
                    console.log(p);

                    //	get username only (and clean up entities)

                    userName = htmlEntities(up.replace(p, ''));

                    //	write usernamewithpassword to registered users if not already in array

                    if (users_reg.indexOf(up) === -1) {

                        users_reg.push(up);

                    }

                    console.log(users_reg);

                    //	append index of usernamewithpassword in registered users array to final username

                    userName = userName + '_' + users_reg.indexOf(up);

                    //	create boolean to know it user is admin

                    console.log(admin_user);

                    var bol_adm = (up == admin_user);

                    // get random color and send it back to the user

                    userColor = colors.shift();

                    //	add username to array of users online

                    users_onl.push(userName);

                    // send user final username

                    connection.sendUTF(JSON.stringify({
                        type: 'color',
                        data: userColor,
                        name: userName,
                        adm: bol_adm
                    }));

                    // now send array of connected users

                    send_updated_users_onl_array();

                    // else (following messages) write message to history and broadcast the message

                } else {

                    console.log((new Date()) + ' Received Message from ' + userName + ': ' + message.utf8Data);

                    //	check admin (i know my name has 5 letters)

                    var a = (userName.slice(0, 5) === admin_user.slice(0, 5));

                    // order to save message file

                    if (a && (message.utf8Data === 'order_to_save_message_file')) {

                        console.log(message.utf8Data + ' order to save message file // so i return');

                        fs.writeFile('text/comments.txt', JSON.stringify(history), function(err) {

                            if (err) {

                                return console.log(err);

                            }

                            //console.log(JSON.stringify(history));

                        });

                        return;

                    }

                    // order to save users file

                    if (a && (message.utf8Data === 'order_to_save_users_file')) {

                        console.log(message.utf8Data + ' order to save users file // so i return');

                        fs.writeFile('text/users.txt', JSON.stringify(users_reg), function(err) {

                            if (err) {

                                return console.log(err);

                            }

                            //console.log(JSON.stringify(users_reg));

                        });

                        return;

                    }

                    // write message into history

                    var obj = {
                        time: (new Date()).getTime(),
                        text: htmlEntities(message.utf8Data),
                        author: userName,
                        color: userColor
                    };

                    history.push(obj);

                    //	only 100 messages in history

                    history = history.slice(-100);

                    // now broadcast message to all connected clients

                    var json = JSON.stringify({
                        type: 'message',
                        data: obj
                    });

                    for (var i = 0; i < clients.length; i++) {

                        clients[i].sendUTF(json);

                    }

                }

            }
        });

        // user disconnected

        connection.on('close', function(connection) {

            if (userName !== false && userColor !== false) {

                console.log("old users_onl array: " + users_onl);

                // remove user from the list of connected clients

                if (users_onl.indexOf(userName) !== -1) {

                    users_onl.splice(users_onl.indexOf(userName), 1);

                }

                console.log("updated users_onl array: " + users_onl);

                clients.splice(index, 1);

                // push back user's color to be reused by another user

                colors.push(userColor);

                send_updated_users_onl_array();

            }

        });

    });

    console.log('Webserver wird acao ausgeführt.');

});
