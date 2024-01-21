const http = require('http');
const fs = require('fs');

const { Player } = require('./game/class/player');
const { World } = require('./game/class/world');

const worldData = require('./game/data/basic-world-data');

let player;
let world = new World();
world.loadWorld(worldData);

const server = http.createServer((req, res) => {

  /* ============== ASSEMBLE THE REQUEST BODY AS A STRING =============== */
  let reqBody = '';
  req.on('data', (data) => {
    reqBody += data;
  });

  req.on('end', () => { // After the assembly of the request body is finished
    /* ==================== PARSE THE REQUEST BODY ====================== */
    if (reqBody) {
      req.body = reqBody
        .split("&")
        .map((keyValuePair) => keyValuePair.split("="))
        .map(([key, value]) => [key, value.replace(/\+/g, " ")])
        .map(([key, value]) => [key, decodeURIComponent(value)])
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
    }

    /* ======================== ROUTE HANDLERS ========================== */
    // Phase 1: GET /
    if (req.method === 'GET' && req.url === '/') {
      const htmlPage = fs.readFileSync('./views/new-player.html', 'utf-8');
      const fixedHtmlPage = htmlPage.replace(/#{availableRooms}/g, world.availableRoomsToString())

      res.statusCode = 200;
      res.setHeader('content-Type', 'text/html');
      return res.end(fixedHtmlPage);
    }

    // Phase 2: POST /player
    if (req.method === 'POST' && req.url === '/player') {
      const { name, roomId } = req.body;
      const room = world.rooms[roomId];
      player = new Player(name, room);

      res.statusCode = 302;
      res.setHeader('Location', `/rooms/${roomId}`);
      return res.end();

    }

    // Phase 3: GET /rooms/:roomId
    if (req.method === 'GET' && req.url.startsWith('/rooms')) {
      const reqUrlArr = req.url.split('/');
      if (reqUrlArr.length === 3) {
        const roomId = reqUrlArr[2];
        const htmlPage = fs.readFileSync('./views/room.html', 'utf-8');
        const room = world.rooms[roomId];


        const fixedHtmlPage = htmlPage
          .replace(/#{roomName}/g, room.name)
          .replace(/#{inventory}/g, player.inventoryToString())
          .replace(/#{roomId}/g, roomId)
          .replace(/#{roomItems}/g, room.itemsToString())
          .replace(/#{exits}/g, room.exitsToString());


        // REDIRECTION if wrong roomId
        const playerCurrentRoomId = player.currentRoom.id;
        if (Number(roomId) !== playerCurrentRoomId) {
          return redirect(res, playerCurrentRoomId);
        }

        res.statusCode = 200;
        res.setHeader('content-Type', 'text/html');
        return res.end(fixedHtmlPage);
      }
    }

    // Phase 4: GET /rooms/:roomId/:direction
    if (req.method === 'GET' && req.url.startsWith('/rooms')) {
      const reqUrlArr = req.url.split('/');
      if (reqUrlArr.length === 4) {
        const direction = reqUrlArr.slice(-1)[0][0];
        const possibleDirections = ['n', 's', 'e', 'w'];
        const roomId = reqUrlArr[2];

        const playerCurrentRoomId = player.currentRoom.id;
        if (Number(roomId) === playerCurrentRoomId) {
          const roomInDirection = player.move(direction);
          try {
            return redirect(res, roomInDirection.id);
          } catch (error) {
            return redirect(res, playerCurrentRoomID);
          };
        }
      }
    }

    // Phase 5: POST /items/:itemId/:action
    if (req.method === 'POST' && req.url.startsWith('/items')) {
      const reqUrlArr = req.url.split('/');
      const action = reqUrlArr.slice(-1)[0];
      const itemId = reqUrlArr[2];

      switch (action) {
        case 'take':
          player.takeItem(itemId);
          break;
        case 'eat':
          player.eatItem(itemId);
          break;
        case 'drop':
          player.dropItem(itemId);
          break;
        default:
          ;
      }

      try {
        // redirecting to current Room instead of next Room
        redirect(res, player.currentRoom.id);
      } catch (error) {
        console.log(error);
        // redirect(res, player.currentRoom.id);
      }
    }

    // Phase 6: Redirect if no matching route handlers
      else {
	  const fileContents = fs.readFileSync('./views/error.html', 'utf-8');
	  const roomId = player.currentRoom.id
	  console.log(roomId);
	  return redirect(res, roomId);
    }

  })
});

function redirect(res, roomId) {
  res.statusCode = 302;
  res.setHeader('Location', `/rooms/${roomId}`);
  return res.end();
};

const port = 5000;

server.listen(port, () => console.log('Server is listening on port', port));
