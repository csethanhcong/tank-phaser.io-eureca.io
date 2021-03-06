const BOT_RANDOM = 1;
const BOT_WALL = 2;
const HEALTH = 1;

var myId = 0;
var init = false;
var firstPlayer = false;
var land;

var shadow;
var tank;
var turret;
var enemyBullets;
var player;
var tanksList;
var explosions;
var hpBar;
var enemies = [];
var enemiesTotal;
var enemiesAlive;

var logo;

var item;
var itemCount = 0;

var cursors;

var bullets;
var fireRate = 100;
var nextFire = 0;

var ready = false;
var eurecaServer;
//this function will handle client communication with the server
var eurecaClientSetup = function() {
	//create an instance of eureca.io client
	var eurecaClient = new Eureca.Client();
	
	eurecaClient.ready(function (proxy) {		
		eurecaServer = proxy;
	});
	
	
	//the server use this method to send other client messages to the current client
	eurecaClient.exports.sendMsg = function(nick, message)
	{
		var chatMsg = $('<li><b>'+nick+' </b><span>'+message+'</span></li>');
		$('#msgbox').append(chatMsg);
	}
	
	//send tchat message
	$('#sendBtn').click(function() {
		if (!eurecaServer) return; //client not ready
		var nick = $('#nick').val();
		eurecaServer.sendMsg(nick, $('#msg').val());
	});					

	//methods defined under "exports" namespace become available in the server side
	
	eurecaClient.exports.setId = function(id, first) 
	{
		//create() is moved here to make sure nothing is created before uniq id assignation
		firstPlayer = first;		
		myId = id;
		create();
		eurecaServer.handshake();
		ready = true;
	}	
	
	eurecaClient.exports.kill = function(id)
	{	
		if (tanksList[id]) {
			tanksList[id].kill();
			console.log('killing ', id, tanksList[id]);
		}
	}	
	
	eurecaClient.exports.spawnEnemy = function(id, x, y)
	{
		
		if (id == myId) return; //this is me
		
		console.log('SPAWN');
		var tnk = new Tank(id, game, tank);
		tanksList[id] = tnk;			
		tnk.update();
	}
	
	eurecaClient.exports.updateState = function(id, state)
	{
		if (tanksList[id])  {
			tanksList[id].cursor = state;
			tanksList[id].tank.x = state.x;
			tanksList[id].tank.y = state.y;
			tanksList[id].tank.angle = state.angle;
			tanksList[id].turret.rotation = state.rot;
			tanksList[id].tank.health = state.health;
			tanksList[id].update();
		}
	}

	//Update bots
	eurecaClient.exports.updateBots = function(latestEnemies)
	{		
		// console.log("INDEX " + latestEnemies.index);
		// console.log(latestEnemies);
		if (enemies[latestEnemies.index]){
			if (enemies[latestEnemies.index].tank.x != latestEnemies.x){
				enemies[latestEnemies.index].tank.x = latestEnemies.x;	
			} 
			if (enemies[latestEnemies.index].tank.y != latestEnemies.y){
				enemies[latestEnemies.index].tank.y = latestEnemies.y;	
			}
			if (enemies[latestEnemies.index].tank.health != latestEnemies.health){
				enemies[latestEnemies.index].tank.health = latestEnemies.health;	
			}
			if (enemies[latestEnemies.index].tank.angle != latestEnemies.angle){
				enemies[latestEnemies.index].tank.angle = latestEnemies.angle;	
			}
			if (enemies[latestEnemies.index].tank.rot != latestEnemies.rot){
				enemies[latestEnemies.index].tank.rot = latestEnemies.rot;	
			}
						
			// enemies[latestEnemies.index].update();
		}		
	}	

	eurecaClient.exports.initBots = function(){			
		if (!init){
			enemies = [];

		    enemiesTotal = 5;		    
		    
	    	for (var i = 0; i < enemiesTotal; i++)
	    	{
	        	enemies.push(new EnemyTank(i, game, player.tank, enemyBullets, BOT_RANDOM));                
	    	}	 
		}	   	          
		init = true;
	}

	eurecaClient.exports.updateItems = function(itemState) {
	/*Check if Item not init yet!*/
		if (item){
			item.alive = itemState.alive;
			item.sprite.x = itemState.x;
			item.sprite.y = itemState.y;
			item.update();
		}
	}

	eurecaClient.exports.initItems = function() {
		itemCount++;

		if (itemCount <= 1) {
			item = new Item(game, HEALTH);			
		}
	}
}

Item = function (game, itemType) {

	var x = game.world.randomX;	
	var y = game.world.randomY;	

	this.game = game;	
	this.tank = tank;
	this.state = {};
	this.itemType = itemType;
	this.alive = true;

	if (this.itemType == HEALTH) {		
		this.hpRegen = 100;
		this.sprite = game.add.sprite(x, y, 'health');
		game.physics.enable(this.sprite, Phaser.Physics.ARCADE);
	}
}

Item.prototype.update = function () {	
	if (firstPlayer){
		this.state.x = this.sprite.x;
		this.state.y = this.sprite.y;
		this.state.alive = this.sprite.alive;

		eurecaServer.handleItemInfo(this.state);
	}

	if (this.sprite.alive == false){
		this.kill();
	}
}

Item.prototype.kill = function () {
	itemCount--;	
	this.sprite.kill();
}

EnemyTank = function (index, game, player, bullets, botType) {

    var x = game.world.randomX;
    var y = game.world.randomY;

    this.game = game;    
    this.state = {};
    this.player = player;
    this.bullets = bullets;
    this.botType = botType;
    this.fireRate = 1000;
    this.nextFire = 0;
    this.alive = true;

    this.shadow = game.add.sprite(x, y, 'enemy', 'shadow');
    this.tank = game.add.sprite(x, y, 'enemy', 'tank1');
    this.turret = game.add.sprite(x, y, 'enemy', 'turret');

    this.shadow.anchor.set(0.5);
    this.tank.anchor.set(0.5);
    this.turret.anchor.set(0.3, 0.5);

    this.tank.name = index.toString();
    game.physics.enable(this.tank, Phaser.Physics.ARCADE);
    this.tank.body.immovable = false;
    this.tank.body.collideWorldBounds = true;
    this.tank.body.bounce.setTo(0.5, 0.5);       

    this.tank.angle = game.rnd.angle();
    this.tank.health = 100;

    this.tank.hpBar = game.add.text(x - 22, y - 42, "HP: " + this.tank.health, { font: "14px Arial Black", fill: "#66CCFF" });   

    if (this.botType == BOT_RANDOM){
    	game.physics.arcade.velocityFromRotation(this.tank.rotation, 100, this.tank.body.velocity);	
    } 
    if (this.botType == BOT_WALL)
    {
    	game.physics.arcade.velocityFromRotation(this.tank.rotation, 100, this.tank.body.velocity);
    }       
};

EnemyTank.prototype.update = function() {	
	if (firstPlayer){
		if (this.tank.x != this.state.x ||
		this.tank.y != this.state.y ||
		this.tank.angle != this.state.angle ||
		this.tank.health != this.state.health ||
		this.tank.rot != this.state.rot)
		{
			this.state.x = this.tank.x;
			this.state.y = this.tank.y;
			this.state.angle = this.tank.angle;
			this.state.health = this.tank.health;
			this.state.rot = this.turret.rotation;
			this.state.index = parseInt(this.tank.name);

			eurecaServer.handleBotsInfo(this.state);
		}	
	}

    this.shadow.x = this.tank.x;
    this.shadow.y = this.tank.y;
    this.shadow.rotation = this.tank.rotation;

    this.turret.x = this.tank.x;
    this.turret.y = this.tank.y;
    this.turret.rotation = this.game.physics.arcade.angleBetween(this.tank, this.player);         

    this.tank.hpBar.x = this.tank.x - 22;
    this.tank.hpBar.y = this.tank.y - 42;
        
    if (this.tank.health == 0){
    	this.kill();
    }
    
	if (this.game.physics.arcade.distanceBetween(this.tank, this.player) < 300)
	{
        if (this.game.time.now > this.nextFire && this.bullets.countDead() > 0)
        {
            this.nextFire = this.game.time.now + this.fireRate;

            var bullet = this.bullets.getFirstDead();

            bullet.reset(this.turret.x, this.turret.y);

            bullet.rotation = this.game.physics.arcade.moveToObject(bullet, this.player, 500);
        }
    }
};


EnemyTank.prototype.kill = function() {
	this.alive = false;
	this.tank.kill();
	this.turret.kill();
	this.shadow.kill();	
	//Add kill hp bar
	this.tank.hpBar.setText("");
}

Tank = function (index, game, player) {
	this.cursor = {
		left:false,
		right:false,
		up:false,
		fire:false		
	}

	this.input = {
		left:false,
		right:false,
		up:false,
		fire:false
	}

    var x = 0;
    var y = 0;

    this.game = game;
    // this.health = 30;
    this.player = player;
    this.bullets = game.add.group();
    this.bullets.enableBody = true;
    this.bullets.physicsBodyType = Phaser.Physics.ARCADE;
    this.bullets.createMultiple(20, 'bullet', 0, false);
    this.bullets.setAll('anchor.x', 0.5);
    this.bullets.setAll('anchor.y', 0.5);
    this.bullets.setAll('outOfBoundsKill', true);
    this.bullets.setAll('checkWorldBounds', true);	
	
	
	this.currentSpeed =0;
    this.fireRate = 500;
    this.nextFire = 0;
    this.alive = true;

    this.shadow = game.add.sprite(x, y, 'tank', 'shadow');
    this.tank = game.add.sprite(x, y, 'tank', 'tank1');
    this.turret = game.add.sprite(x, y, 'tank', 'turret');
    // this.hpBar = game.add.text(x - 22, y - 42, "HP: " + this.health, { font: "14px Arial Black", fill: "#66CCFF" });

    this.shadow.anchor.set(0.5);
    this.tank.anchor.set(0.5);
    this.turret.anchor.set(0.3, 0.5);

    this.tank.id = index;
    game.physics.enable(this.tank, Phaser.Physics.ARCADE);
    this.tank.body.immovable = false;
    this.tank.body.collideWorldBounds = true;
    this.tank.body.bounce.setTo(0, 0);
    this.tank.health = 100;
    this.tank.hpBar = game.add.text(x - 22, y - 42, "HP: " + this.tank.health, { font: "14px Arial Black", fill: "#66CCFF" });

    this.tank.angle = 0;

    game.physics.arcade.velocityFromRotation(this.tank.rotation, 0, this.tank.body.velocity);

};

Tank.prototype.update = function() {
	
	var inputChanged = (
		this.cursor.left != this.input.left ||
		this.cursor.right != this.input.right ||
		this.cursor.up != this.input.up ||
		this.cursor.fire != this.input.fire ||
		this.input.health != this.tank.health
	);
	
	
	if (inputChanged)
	{
		//Handle input change here
		//send new values to the server		
		if (this.tank.id == myId)
		{
			// send latest valid state to the server
			this.input.x = this.tank.x;
			this.input.y = this.tank.y;
			this.input.angle = this.tank.angle;
			this.input.rot = this.turret.rotation;
			this.input.health = this.tank.health;
			
			eurecaServer.handleKeys(this.input);
			
		}
	}

	//cursor value is now updated by eurecaClient.exports.updateState method
	
	
    if (this.cursor.left)
    {
        this.tank.angle -= 1;
    }
    else if (this.cursor.right)
    {
        this.tank.angle += 1;
    }	
    if (this.cursor.up)
    {
        //  The speed we'll travel at
        this.currentSpeed = 300;
    }
    else
    {
        if (this.currentSpeed > 0)
        {
            this.currentSpeed -= 4;
        }
    }
    if (this.cursor.fire)
    {	
		this.fire({x:this.cursor.tx, y:this.cursor.ty});
    }
	
	
	
    if (this.currentSpeed > 0)
    {
        game.physics.arcade.velocityFromRotation(this.tank.rotation, this.currentSpeed, this.tank.body.velocity);
    }	
	else
	{
		game.physics.arcade.velocityFromRotation(this.tank.rotation, 0, this.tank.body.velocity);
	}

	if (this.tank.health == 0){
		this.kill();
		return;
	}
	
	
    this.shadow.x = this.tank.x;
    this.shadow.y = this.tank.y;
    this.shadow.rotation = this.tank.rotation;

    this.turret.x = this.tank.x;
    this.turret.y = this.tank.y;    

    this.tank.hpBar.x = this.tank.x - 22;
    this.tank.hpBar.y = this.tank.y - 42;
};


Tank.prototype.fire = function(target) {
	if (!this.alive) return;
    if (this.game.time.now > this.nextFire && this.bullets.countDead() > 0)
    {
        this.nextFire = this.game.time.now + this.fireRate;
        var bullet = this.bullets.getFirstDead();
        bullet.reset(this.turret.x, this.turret.y);

		bullet.rotation = this.game.physics.arcade.moveToObject(bullet, target, 500);
    }
}


Tank.prototype.kill = function() {
	this.alive = false;
	this.tank.kill();
	this.turret.kill();
	this.shadow.kill();
	//Add kill hp bar
	this.tank.hpBar.setText("");
}

var game = new Phaser.Game(1000, 600, Phaser.AUTO, 'container', { preload: preload, create: eurecaClientSetup, update: update, render: render });

function preload () {

	// load tile-map
	game.load.tilemap('map', 'assets/tank-map.json', null, Phaser.Tilemap.TILED_JSON);
	game.load.image('tiles-1', 'assets/cyberglow.png');
	game.load.image('tiles-2', 'assets/factory.png');
	game.load.image('tiles-3', 'assets/metal.png');
	game.load.image('tiles-4', 'assets/tron.png');
	game.load.image('bg-tiles-1', 'assets/scorched_earth.png');
	game.load.image('bg-tiles-2', 'assets/light_grass.png');

    game.load.atlas('tank', 'assets/tanks.png', 'assets/tanks.json');
    game.load.atlas('enemy', 'assets/enemy-tanks.png', 'assets/tanks.json');
    game.load.image('logo', 'assets/logo.png');
    game.load.image('bullet', 'assets/bullet.png');
    game.load.image('earth', 'assets/light_grass.png');
    game.load.spritesheet('kaboom', 'assets/explosion.png', 64, 64, 23);    
    game.load.image('health', 'assets/item/health.png');

    // load music and sound effects
    game.load.audio('bg-music', 'assets/audio/bg-music-2.wav');
    game.load.audio('explosionSfx', 'assets/audio/explosion.wav');
    game.load.audio('healthSfx', 'assets/audio/health-item-effect.wav');
}

var map;
var layer;
var explosionAnimation;
var bgMusic;
var explosionSfx;
var healthSfx;

function create () {
	game.physics.startSystem(Phaser.Physics.ARCADE);

	// Turn the music
	bgMusic = game.add.audio('bg-music');
	bgMusic.play('', 0, 1, true);
	bgMusic.onLoop.add(loopMusic, this);

	// Add explosion + hit item effect
	explosionSfx = game.add.audio('explosionSfx');	
	healthSfx = game.add.audio('healthSfx');

    //  Resize our game world to be a 1792 x 1000 square
    game.world.setBounds(-1000, -600, 1792, 960);
	game.stage.disableVisibilityChange  = true;
	
	// Load map
	map = game.add.tilemap('map');
	map.addTilesetImage('tiles-1');
	map.addTilesetImage('tiles-2');
	map.addTilesetImage('tiles-3');
	map.addTilesetImage('tiles-4');
	map.addTilesetImage('bg-tiles-1');
	map.addTilesetImage('bg-tiles-2');

	map.setCollision([1,3,4,5]);

	layer = map.createLayer('MainLayer');		
	layer.resizeWorld();	

    //  Our tiled scrolling background
    // land = game.add.tileSprite(0, 0, 1300, 600, 'earth');
    // land.fixedToCamera = true;
    
    tanksList = {};    

	player = new Tank(myId, game, tank);
	tanksList[myId] = player;
	tank = player.tank;
	turret = player.turret;
	tank.x=0;
	tank.y=0;
	bullets = player.bullets;
	shadow = player.shadow;

    //  Explosion pool
    // explosions = game.add.group();

    // for (var i = 0; i < 10; i++)
    // {
        // explosionAnimation = explosions.create(0, 0, 'kaboom', [0], false);
    //     explosionAnimation.anchor.setTo(0.5, 0.5);
        // explosionAnimation.animations.add('kaboom');
    // }
    // explosionAnimation = game.add.sprite(100, 100, 'kaboom');
    // explosionAnimation.animations.add('boom');
    //  The enemies bullet group    

    tank.bringToTop();
    turret.bringToTop();

    //Enemies - bot
    enemyBullets = game.add.group();
    enemyBullets.enableBody = true;
    enemyBullets.physicsBodyType = Phaser.Physics.ARCADE;
    enemyBullets.createMultiple(100, 'bullet');
    
    enemyBullets.setAll('anchor.x', 0.5);
    enemyBullets.setAll('anchor.y', 0.5);
    enemyBullets.setAll('outOfBoundsKill', true);
    enemyBullets.setAll('checkWorldBounds', true); 
		
    logo = game.add.sprite(0, 200, 'logo');
    logo.fixedToCamera = true;

    game.input.onDown.add(removeLogo, this);

    game.camera.follow(tank);
    game.camera.deadzone = new Phaser.Rectangle(150, 150, 500, 300);
    game.camera.focusOnXY(0, 0);

    cursors = game.input.keyboard.createCursorKeys();
	
	setTimeout(removeLogo, 2000);
	
}

function loopMusic () {
	bgMusic.play('', 0, 1, true);
}

function removeLogo () {
    game.input.onDown.remove(removeLogo, this);
    logo.kill();
}

function update () {
	//do not update if client not ready
	if (!ready) return;	

	if (item){
		item.update();	
	}	

	game.physics.arcade.collide(tank, layer);	
	game.physics.arcade.overlap(enemyBullets, tank, bulletHitPlayer, null, this);
	game.physics.arcade.overlap(enemyBullets, layer, bulletHitBlock, null, this);	
	if (item){		
		game.physics.arcade.overlap(tank, item.sprite, tankHitItem, null, this);
	}	
	
	player.input.left = cursors.left.isDown;
	player.input.right = cursors.right.isDown;
	player.input.up = cursors.up.isDown;
	player.input.fire = game.input.activePointer.isDown;
	player.input.tx = game.input.x+ game.camera.x;
	player.input.ty = game.input.y+ game.camera.y;
		
	turret.rotation = game.physics.arcade.angleToPointer(turret);	
    // land.tilePosition.x = -game.camera.x;
    // land.tilePosition.y = -game.camera.y;
	
    for (var i in tanksList)
    {
		if (!tanksList[i]) continue;		

		var curBullets = tanksList[i].bullets;
		//Check bullet hit world bounds
		curBullets.forEach(function(member) {								
			if(member.x <= 10 || member.y <=10 || member.x >= 1770 || member.y >= 940) {
				bulletHitBlock(member);
			}
		}, this, true);
		//Check bullet hit blocks			
		game.physics.arcade.collide(curBullets, layer, bulletHitBlock, null, this);	

		var curTank = tanksList[i].tank;

		for (var t = 0; t < enemies.length; t++)
    	{
	        if (enemies[t].alive)
	        {	            
	            game.physics.arcade.collide(curTank, enemies[t].tank);
	            game.physics.arcade.overlap(curBullets, enemies[t].tank, bulletHitPlayer, null, this);	            						
				game.physics.arcade.collide(enemies[t].tank, layer);	            
	        }
    	}

		for (var j in tanksList)
		{
			if (!tanksList[j]) continue;
			if (j!=i) 
			{
			
				var targetTank = tanksList[j].tank;
				
				game.physics.arcade.overlap(curBullets, targetTank, bulletHitPlayer, null, this);						
				game.physics.arcade.collide(tanksList[i].tank, tanksList[j].tank);	
			}
			if (tanksList[j].alive)
			{
				tanksList[j].update();
			}			
		}
    }

    //Check player fire and collide vs enemies	
    for (var t = 0; t < enemies.length; t++)
	{
        if (enemies[t].alive)
        {                       
            enemies[t].update();           
        }
	}	
}

function tankHitItem (tank, item) {	
	tank.health = 100;
	tank.hpBar.setText("HP: " + tank.health);

	// Load sound effect
	healthSfx.play();

	item.alive = false;	
}

function bulletHitPlayer (tank, bullet) {	
	tank.health -= 10;
	tank.hpBar.setText("HP: " + tank.health);

	if (tank.health <= 10) {
		tank.hpBar.setStyle({ font: "14px Arial Black", fill: "#FF1A1A" });
	}

    explosionAnimation = game.add.sprite(bullet.x - 32, bullet.y - 32, 'kaboom'); // minus sizeOfBullet/2
    explosionAnimation.animations.add('boom');
    explosionAnimation.animations.play('boom', null, false, true);

    // heartAnimation = game.add.sprite(0, 0, 'heart'); 
    // heartAnimation.animations.add('heart');
    // heartAnimation.animations.play('heart', null, true, true);

    explosionSfx.play();

    bullet.kill();
}

//Hit blocks
function bulletHitBlock (bullet) {    
    explosionAnimation = game.add.sprite(bullet.x - 32, bullet.y - 32, 'kaboom'); // minus sizeOfBullet/2
    explosionAnimation.animations.add('boom');
    explosionAnimation.animations.play('boom', null, false, true);

    explosionSfx.play();

    // heartAnimation = game.add.sprite(0, 0, 'heart'); 
    // heartAnimation.animations.add('heart');
    // heartAnimation.animations.play('heart', null, true, true);

    bullet.kill();
}

function render () {}

