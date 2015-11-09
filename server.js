var express = require('express')
  , app = express(app)
  , server = require('http').createServer(app);

// serve static files from the current directory
app.use(express.static(__dirname));

//we'll keep clients data here
var clients = {};
var firstPlayerId;  
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
		firstPlayerId = conn.id;
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
	//Any player handshakes with server is inited
	var currentPlayer = clients[this.connection.id].remote;	
	currentPlayer.initBots();
	currentPlayer.initItems();

	//If it is the second, third, fourth ... players, update items and bots from the first player for it
	if (Object.keys(clients).length != 1){
		var firstPlayer;		
		if (clients[firstPlayerId]){
			firstPlayer = clients[firstPlayerId];					
			if (firstPlayer.lastBots){
				currentPlayer.updateBots(firstPlayer.lastBots);
			}					

			if (firstPlayer.lastItems) {
				currentPlayer.updateItems(firstPlayer.lastItems);
			}
		}				
	}	

	//Spawn all players for this client
	for (var c in clients) {						
		currentPlayer.spawnEnemy(clients[c].id);
		//Update the latest state for all tanks			

		if (clients[c].laststate){			
			currentPlayer.updateState(clients[c].id, clients[c].laststate);
		}
	}	

	//Spawn current players for other clients
	for (var c in clients) {
		if (clients[c].id != this.connection.id){
			var other = clients[c].remote;								
			other.spawnEnemy(clients[this.connection.id].id);				
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
		console.log("Server receive");
		console.log(keys)
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