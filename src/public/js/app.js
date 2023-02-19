/////////////////////// Socket.io ///////////////////////
const socket = io(); // Websocket의 socket이 아니라 Socket.io의 socket이다.

const enterContainer = document.getElementById("enterContainer");
const roomContainer = document.getElementById("roomContainer");
const streamContainer = document.getElementById("streamContainer");
const enter = document.enter;

roomContainer.hidden = true;
streamContainer.hidden = true;
let roomName;

////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////
const addMessage = (msg) => {
  const messages = document.getElementById("msgs");
  const message = document.createElement("li");
  message.innerText = msg;
  messages.appendChild(message);
};

const showRoom = async (countUsers) => {
  enterContainer.hidden = true;
  roomContainer.hidden = false;
  streamContainer.hidden = false;
  const h3 = document.getElementById("roomName");
  const msgForm = document.getElementById("msgForm");
  h3.innerText = `${roomName}`;
  msgForm.addEventListener("submit", handleSendMessage);
  await getStream(); // Websocket의 속도가 빠르므로 myStream이 생성되기 전에 event가 발생하게 된다.
  makeConnection();
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

const handleSubmitEnter = async (e) => {
  e.preventDefault();
  const value1 = enter.roomName.value;
  const value2 = enter.nickname.value;
  roomName = value1;
  enter.roomName.value = "";
  enter.nickname.value = "";
  await showRoom();
  socket.emit("enter_room", value1, value2);
};

enter.addEventListener("submit", handleSubmitEnter);

////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////

const myCamera = document.getElementById("myCamera");
const muteBtn = document.getElementById("muteBtn");
const cameraBtn = document.getElementById("cameraBtn");
const myCameras = document.getElementById("myCameras");

let myStream;
let muteState = false;
let cameraState = true;

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

////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////
const makeConnection = () => {
  const myPeerC = new RTCPeerConnection();
  myStream.getTracks().forEach((track) => myPeerC.addTrack(track, myStream));
  // 자신의 MediaObject에 대한 data를 담는다.
};

////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////
socket.on("welcome", async (user, roomName, countUsers) => {
  const offer = await myPeerC.createOffer();
  myPeerC.setLocalDescription(offer); // send offer
  socket.emit("offer", offer, roomName);
  const h3 = document.getElementById("roomName");
  h3.innerText = `${roomName} (${countUsers})`;
  addMessage(`${user} joined :)`);
});

socket.on("offer", (offer) => {
  myPeerC.setRemoteDescription(offer);
});

socket.on("goodbye", (user, roomName, countUsers) => {
  const h3 = document.getElementById("roomName");
  h3.innerText = `${roomName} (${countUsers})`;
  addMessage(`${user} left :(`);
});

socket.on("send_others_message", addMessage);

socket.on("change_rooms_status", (rooms) => {
  const availRooms = document.getElementById("availRooms");
  if (rooms.length === 0) {
    availRooms.innerHTML = "";
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
