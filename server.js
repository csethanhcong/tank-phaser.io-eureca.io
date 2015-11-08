var express = require('express')
  , app = express(app)
  , server = require('http').createServer(app);

// serve static files from the current directory
app.use(express.static(__dirname));

//we'll keep clients data here
var clients = {};
  
//get EurecaServer class
var EurecaServer = require('eureca.io');

//create an instance of EurecaServer
var eurecaServer = new EurecaServer.Server({allow:['setId', 'spawnEnemy', 'kill', 'updateState', 'initBots', 'updateBots', 'initItems', 'updateItems', 'sendMsg']});

//attach eureca.io to our http server
eurecaServer.attach(server);

//eureca.io provides events to detect clients connect/disconnect

//detect client connection
eurecaServer.onConnect(function (conn) {    
    console.log('New Client id=%s ', conn.id, conn.remoteAddress);
	
	//the getClient method provide a proxy allowing us to call remote client functions
    var remote = eurecaServer.getClient(conn.id);        
	
	//register the client
	clients[conn.id] = {nick:null, id:conn.id, remote:remote}

	//here we call setId (defined in the client side)
	console.log(Object.keys(clients).length);	
	if (Object.keys(clients).length == 1){
		remote.setId(conn.id, true);
	}
	else{
		remote.setId(conn.id, false);	
	}	
});

//detect client disconnection
eurecaServer.onDisconnect(function (conn) {    
    console.log('Client disconnected ', conn.id);
	
	var removeId = clients[conn.id].id;
	
	delete clients[conn.id];
	
	for (var c in clients)
	{
		var remote = clients[c].remote;
		
		//here we call kill() method defined in the client side
		remote.kill(conn.id);
	}	
});

//clients will call this method to send messages
eurecaServer.exports.sendMsg = function (nick, message) {
	for (c in clients) {
		clients[c].remote.sendMsg(nick, message);
	}
}

eurecaServer.exports.handshake = function() {	
	for (var c in clients) {
		var remote = clients[c].remote;		
		remote.initBots();
		remote.initItems();			
		for (var cc in clients) {	
			if (clients[cc].lastItems) {
				remote.updateItems(clients[cc].lastItems);
			}
			//send latest known position
			var x = clients[cc].laststate ? clients[cc].laststate.x:  0;
			var y = clients[cc].laststate ? clients[cc].laststate.y:  0;			

			remote.spawnEnemy(clients[cc].id, x, y);
			//Update the latest state for all tanks
			if (clients[cc].laststate){
				remote.updateState(clients[cc].id, clients[cc].laststate);
			}			

			if (clients[cc].lastBots){
				remote.updateBots(clients[cc].lastBots);
			}					
		}
	}
}


//be exposed to client side
eurecaServer.exports.handleKeys = function (keys) {
	var conn = this.connection;
	var updatedClient = clients[conn.id];
	
	for (var c in clients)
	{
		var remote = clients[c].remote;
		remote.updateState(updatedClient.id, keys);
		
		//keep last known state so we can send it to new connected clients
		clients[c].laststate = keys;
	}
}

//be exposed to client side
eurecaServer.exports.handleBotsInfo = function (latestBots) {
	// console.log("INDEX " + latestBots.index);
	// console.log(latestBots);		
	var conn = this.connection;
	var updatedClient = clients[conn.id];	
	for (var c in clients)
	{
		if (clients[c].id != updatedClient.id){
			var remote = clients[c].remote;
			remote.updateBots(latestBots);
			//keep last known state so we can send it to new connected clients
			clients[c].lastBots = latestBots;
		}				
	}
}

//be exposed to client side
eurecaServer.exports.handleItemInfo = function (latestItems) {
	var conn = this.connection;
	var updatedClient = clients[conn.id];	
	for (var c in clients)
	{
		if (clients[c].id != updatedClient.id){
			var remote = clients[c].remote;
			remote.updateItems(latestItems);
			//keep last known state so we can send it to new connected clients
			clients[c].lastItems = latestItems;
		}				
	}
}

server.listen(8000);