/////////////////////// Socket.io ///////////////////////
const socket = io(); // Websocket의 socket이 아니라 Socket.io의 socket이다. index.pug에서 CDN으로 socket.io의 data를 가지고 왔다.

const enterContainer = document.getElementById("enterContainer");
const messageContainer = document.getElementById("messageContainer");
const streamContainer = document.getElementById("streamContainer");
const enter = document.enter;

messageContainer.hidden = true;
streamContainer.hidden = true;
let roomName;

/////////////////////// Enter Room ///////////////////////
const showRoom = async () => {
  enterContainer.hidden = true;
  messageContainer.hidden = false;
  streamContainer.hidden = false;
  const msgForm = document.getElementById("msgForm");
  msgForm.addEventListener("submit", handleSendMessage);
  const leaveBtn = document.getElementById("leaveBtn");
  leaveBtn.addEventListener("click", handleClickLeave);
  await getStream(); // Websocket의 속도가 빠르므로 myStream이 생성되기 전에 event가 발생하게 된다.
  makeConnection();
};

const addMessage = (msg) => {
  const messages = document.getElementById("msgs");
  const message = document.createElement("li");
  message.innerText = msg;
  messages.appendChild(message);
};

const handleSendMessage = (e) => {
  e.preventDefault();
  const input = document.getElementById("msgForm__input");
  const value = input.value;
  input.value = "";
  socket.emit("send_me_message", value, roomName, () => {
    addMessage(`Me: ${value}`);
  });
};

const handleClickLeave = () => {
  socket.emit("leave", roomName, () =>
    location.replace("http://localhost:3000")
  );
};

const handleSubmitEnter = async (e) => {
  e.preventDefault();
  roomName = enter.roomName.value;
  const nickname = enter.nickname.value;
  enter.roomName.value = "";
  enter.nickname.value = "";
  socket.emit("check_user_capacity", roomName, nickname);
  // await showRoom(); // offer를 주고 받는 과정이 peerConnection이 생성되는 것보다 빠르기 때문에
  // socket.emit("enter_room", value1, value2);
};

enter.addEventListener("submit", handleSubmitEnter);

/////////////////////// Get Media ///////////////////////
const myCameras = document.getElementById("myCameras");
const myCamera = document.getElementById("myCamera");
const muteBtn = document.getElementById("muteBtn");
const cameraBtn = document.getElementById("cameraBtn");

let myStream;
let muteState = false;
let cameraState = true;
/** @type {RTCPeerConnection} */
let myPeerC;

const getStream = async (deviceId) => {
  const initialConstraints = {
    audio: true,
    video: { facingMode: "user" },
  };
  const myConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      // constraints
      deviceId ? myConstraints : initialConstraints
    );
    myCamera.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
    // HTMLMediaElement.srcObject: src가 될 객체를 set or return 한다.
  } catch (err) {
    console.log(err);
  }
};
const getCameras = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      myCameras.appendChild(option);
    });
  } catch (err) {
    console.log(err);
  }
};

const handleClickMute = () => {
  if (myStream) {
    myStream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
  }
  if (muteState) {
    muteBtn.innerText = "Mute On";
  } else {
    muteBtn.innerText = "Mute Off";
  }
  muteState = !muteState;
};

const handleClickCamera = () => {
  if (myStream) {
    myStream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
  }
  if (cameraState) {
    cameraBtn.innerText = "Camera On";
  } else {
    cameraBtn.innerText = "Camera Off";
  }
  cameraState = !cameraState;
};

const handleChangeCameras = async () => {
  await getStream(myCameras.value);
};

muteBtn.addEventListener("click", handleClickMute);
cameraBtn.addEventListener("click", handleClickCamera);
myCameras.addEventListener("change", handleChangeCameras);

/////////////////////// Peer Connection ///////////////////////
const makeConnection = () => {
  myPeerC = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
        ],
      },
    ],
  }); // Google에서 제공하는 STUN Server로, 실제 프로젝트에서는 자신만의 STUN Server를 가져야 한다.
  myPeerC.addEventListener("icecandidate", (data) => {
    socket.emit("ice", data.candidate, roomName);
  });
  myPeerC.addEventListener("addstream", (data) => {
    const peerCamera = document.getElementById("peerCamera");
    peerCamera.srcObject = data.stream;
  });
  myPeerC.addEventListener("track", (data) => {
    const peerCamera = document.getElementById("peerCamera");
    peerCamera.srcObject = data.streams[0];
  }); // "addstream" 대신 "track" 이벤트를 지원하는 브라우저를 위해
  myStream.getTracks().forEach((track) => myPeerC.addTrack(track, myStream));
};

/////////////////////// Socket Events ///////////////////////
socket.on("check_user_capacity", async (roomName, nickname) => {
  await showRoom(); // offer를 주고 받는 과정이 peerConnection이 생성되는 것보다 빠르기 때문에
  socket.emit("enter_room", roomName, nickname);
});
socket.on("welcome", async (user, roomName, countUsers) => {
  const offer = await myPeerC.createOffer();
  myPeerC.setLocalDescription(offer); // Send offer to peer
  console.log("send offer to peer!");
  socket.emit("offer", offer, roomName);
  const roomTitle = document.getElementById("roomTitle");
  roomTitle.innerText = `${roomName} (${countUsers})`;
  addMessage(`${user} joined :)`);
});

socket.on("offer", async (offer) => {
  myPeerC.setRemoteDescription(offer); // Receive offer from peer
  console.log("received offer from peer!");
  const answer = await myPeerC.createAnswer(offer);
  myPeerC.setLocalDescription(answer);
  console.log("send answer to peer!");
  socket.emit("answer", answer, roomName);
});

socket.on("answer", async (answer) => {
  console.log("received answer from peer!");
  myPeerC.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  myPeerC.addIceCandidate(ice);
});

socket.on("send_others_message", addMessage);

socket.on("goodbye", (user, roomName, countUsers) => {
  const roomTitle = document.getElementById("roomTitle");
  roomTitle.innerText = `${roomName} (${countUsers})`;
  addMessage(`${user} left :(`);
});

socket.on("leave", (nickname) => {
  console.log(`${nickname} leaved the room.`);
});

socket.on("change_rooms_status", (rooms) => {
  const availRooms = document.getElementById("availRooms");
  availRooms.innerHTML = "";
  if (rooms.length === 0) {
    return;
  }
  rooms.forEach((room) => {
    const li = document.createElement("li");
    li.innerText = room;
    availRooms.appendChild(li);
  });
});

/////////////////////// Websocket ///////////////////////
// const socket = new WebSocket(`ws://${window.location.host}`);
// const nickForm = document.getElementById("nickForm");
// const msgForm = document.getElementById("msgForm");
// const msgs = document.getElementById("msgs");
// /*
//     socket은 nodejs 내장 인스턴스이고, 이벤트 기반으로 동작하기 때문에
//     addEventListener를 사용할 수 있지만, wss는 ws 모듈의 인스턴스이므로
//     자체 문법(on)을 따라야 한다.
// */
// socket.addEventListener("open", () => {
//   console.log("Connected to the server ✅");
// });
// socket.addEventListener("close", () => {
//   console.log("Disconnected from the server ✂️");
// });
// socket.addEventListener("error", () => {
//   console.log("Client side failed to connect to server ❌");
// });
// socket.addEventListener("message", (message) => {
//   // console.log("Message Object: ", message);
//   const msg = document.createElement("li");
//   msg.innerText = message.data;
//   msgs.appendChild(msg);
// });
// const makeMessage = (type, payload) => {
//   const msg = { type, payload };
//   return JSON.stringify(msg); // JS가 아닌 API에서는 JS 객체를 이해할 수 없기 때문에 string을 보낸다.
//   /*
//     // JSON.parse() vs JSON.stringify
//     JSON.parse()는 JSON 문자열을 JS 객체로, JSON.stringify는 그 반대로 바꾸는 기능을 수행한다.
//   */
// };

// const handleSubmitNick = (e) => {
//   e.preventDefault();
//   const input = nickForm.querySelector("input[type='text']");
//   socket.send(makeMessage("nickname", input.value));
//   nickInput.value = "";
// };
// const handleSubmitMsg = (e) => {
//   e.preventDefault();
//   const input = msgForm.querySelector("input[type='text']");
//   socket.send(makeMessage("new_message", input.value));
//   msgInput.value = "";
// };

// nickForm.addEventListener("submit", handleSubmitNick);
// msgForm.addEventListener("submit", handleSubmitMsg);
