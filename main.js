import './style.css';

import data from './BanubaSDK/BanubaSDK.data?url';
import wasm from './BanubaSDK/BanubaSDK.wasm?url';
import simd from './BanubaSDK/BanubaSDK.simd.wasm?url';
import {
  Player,
  Effect,
  MediaStream as BnbMediaStream,
  MediaStreamCapture
} from './BanubaSDK/BanubaSDK.js';

import firebase from 'firebase/app';
import 'firebase/firestore';

const firebaseConfigString = import.meta.env.VITE_FIREBASE_CONFIG;
if (!firebaseConfigString)
  throw new Error(`VITE_FIREBASE_CONFIG env variable is not defined`);

const firebaseConfig = JSON.parse(firebaseConfigString);

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
    }
  ],
  iceCandidatePoolSize: 10
};

// Global State
const pc = new RTCPeerConnection(servers);
let localStreamEditor = null;
let remoteStream = null;

// HTML elements
const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const blurButton = document.getElementById('blurButton');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');

// 0. Setup effects controls
const effectsCatalog = {
  sceneRetouch: new Effect('./BanubaSDK/effects/scene_retouch.zip'),
  backgroundBlur: new Effect('./BanubaSDK/effects/test_BG.zip')
};
const appliedEffects = new Set();

const createEffectApplicator = (effectName) => () => {
  const effect = effectsCatalog[effectName];
  if (!effect) {
    console.warn(
      `Attempted to apply non-existing effect ${effectName}. Available effects: ${Object.keys(
        effectsCatalog
      )}`
    );
    return;
  }

  if (!appliedEffects.has(effectName)) {
    localStreamEditor?.applyEffect?.(effect);
    appliedEffects.add(effectName);
  }
};

blurButton.onclick = createEffectApplicator('sceneRetouch');

// 1. Setup media sources

webcamButton.onclick = async () => {
  localStreamEditor = await Player.create({
    clientToken: import.meta.env.VITE_BANUBA_TOKEN,
    locateFile: {
      'BanubaSDK.data': data,
      'BanubaSDK.wasm': wasm,
      'BanubaSDK.simd.wasm': simd
    }
  });

  const webcamStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  await localStreamEditor.use(new BnbMediaStream(webcamStream));
  await localStreamEditor.play();

  remoteStream = new MediaStream();
  const localStream = new MediaStreamCapture(localStreamEditor);

  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // Pull tracks from remote stream, add to video stream
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
  blurButton.disabled = false;
};

// 2. Create an offer
callButton.onclick = async () => {
  // Reference Firestore collections for signaling
  const callDoc = firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');

  callInput.value = callDoc.id;

  // Get candidates for caller, save to db
  pc.onicecandidate = (event) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  // Create offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type
  };

  await callDoc.set({ offer });

  // Listen for remote answer
  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // When answered, add candidate to peer connection
  answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        console.log('Call is answered');
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  hangupButton.disabled = false;
};

// 3. Answer the call with the unique ID
answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');

  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};
