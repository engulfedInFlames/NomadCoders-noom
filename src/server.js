import http from "http";
import express from "express";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";

const PORT = 3005;

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
/*
    // express.static(virtual path, path)
    : browser에서 static file을 사용하고 관리할 수 있게 한다.
*/
app.get("/", (_, res) => res.render("index"));
app.get("/*", (_, res) => res.redirect("/"));

const httpServer = http.createServer(app);
const ioServer = new Server(httpServer, {
  cors: {
    origin: ["https://admin.socket.io"],
    credentials: true,
  },
});

instrument(ioServer, {
  auth: false,
  mode: "development",
});

// import { WebSocketServer } from "ws";
// const wss = new WebSocketServer({ server }); // { server: __name__ }을 ES6 형태로 작성한 것
// const sockets = [];
// wss.on("connection", (socket) => {
//   // 클라이언트의 socket으로 직접 연결해준다. 연결된 브라우저 측 socket의 수 만큼 실행된다.
//   socket["nickname"] = "Anonymous"; // socket은 객체
//   console.log("Connected to the browser ✅");
//   sockets.push(socket); // 클라이언트가 몇 개인지를 나타낸다.
//   socket.on("close", () => {
//     console.log("Disconnected from the browser ✂️");
//   });
//   socket.on("message", (msg) => {
//     // socket.send(message.toString());
//     const message = JSON.parse(msg.toString());
//     // console.log(mgs, message);
//     switch (message.type) {
//       case "new_message":
//         sockets.forEach((aSocket) =>
//           aSocket.send(`${aSocket.nickname}: ${message.payload}`)
//         );
//         break;
//       case "nickname":
//         socket["nickname"] = message.payload;
//         break;
//     }
//   });
// });
// =================================================================>
const publicRooms = () => {
  const {
    sockets: {
      adapter: { sids, rooms },
    },
  } = ioServer;
  const publicRooms = [];
  rooms.forEach((_, key) => {
    if (sids.get(key) === undefined) {
      publicRooms.push(key);
    }
  });
  return publicRooms;
};

const countUsers = (roomName) => {
  return ioServer.sockets.adapter.rooms.get(roomName)?.size;
};

////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////
ioServer.on("connection", (socket) => {
  // 마찬가지로 클라이언트 socket과 연결되어 객체를 받아 온다.
  socket["nickname"] = "Anonymous";

  socket.onAny((event) => {
    console.log(`Socket event("${event}") happened!`);
  });

  socket.on("enter_room", (roomName, nickname) => {
    // 주의할 점은 이 fn이 프론트엔드에서 실행된다는 것!
    socket.join(roomName);
    socket["nickname"] = nickname;
    socket
      .to(roomName)
      .emit("welcome", socket.nickname, roomName, countUsers(roomName)); // except myself
    ioServer.sockets.emit("change_rooms_status", publicRooms());
  });

  socket.on("offer", (offer, roomName) => {
    socket.to(roomName).emit("offer", offer);
  });

  socket.on("disconnecting", () => {
    socket.rooms.forEach((roomName) =>
      socket
        .to(roomName)
        .emit("goodbye", socket.nickname, roomName, countUsers(roomName) - 1)
    );
  });

  socket.on("disconnect", () => {
    ioServer.sockets.emit("change_rooms_status", publicRooms());
  });

  socket.on("send_me_message", (msg, roomName, fn) => {
    socket
      .to(roomName)
      .emit("send_others_message", `${socket.nickname}: ${msg}`);
    fn();
  });
});

const handleListen = () =>
  console.log(`Listening on http://localhost:${PORT} ✅`);
httpServer.listen(PORT, handleListen);
/*
    // app.listen() vs http.createServer()
    app.listen()은 http.createrServer().listen.apply()를 반환한다.
    Socket은 http 인스턴스 자체를 필요로 하므로, http 인스턴스를 반환하는 http.createServer()를 사용해줘야 한다. 
*/
