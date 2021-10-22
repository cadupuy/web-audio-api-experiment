import * as THREE from "three";
import { GUI } from "three/examples/jsm/libs/dat.gui.module";
const axios = require("axios");

const gui = new GUI();
const BaseAudioContext = window.AudioContext;
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

// THREEJS
let scene, renderer, camera, clock, width, height, particles, dataURL;

// WEB AUDIO API
let microphone, context, analyser, bufferLength, dataArray, filter;

// VIDEO
let video;

const init = () => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111);
  renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
  document.getElementById("content").appendChild(renderer.domElement);
  clock = new THREE.Clock();
  initCamera();
  onResize();
  initSources();
  draw();
};

const initCamera = () => {
  camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 10000);
  camera.position.set(0, 0, 600);
  camera.lookAt(0, 0, 0);
  scene.add(camera);

  gui.add(camera.position, "z", 0, 1000);
};

const initSources = () => {
  video = document.getElementById("video");
  video.autoplay = true;

  const option = {
    video: true,
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
    },
  };

  context = new BaseAudioContext();

  analyser = context.createAnalyser();
  analyser.smoothingTimeConstant = 0.5;
  analyser.fftSize = 2048;

  bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  filter = context.createBiquadFilter();
  filter.Q.value = 8.3;
  filter.frequency.value = 355;
  filter.gain.value = 1.0;
  filter.type = "bandpass";

  navigator.mediaDevices
    .getUserMedia(option)
    .then((stream) => {
      filter.connect(context.destination);
      microphone = context.createMediaStreamSource(stream);
      microphone.connect(analyser);
      microphone.connect(filter);
      microphone.connect(context.destination);

      video.srcObject = stream;

      video.addEventListener("loadeddata", () => {
        createParticles();
      });
    })
    .catch((error) => {
      console.log(error);
    });
};

const createParticles = () => {
  const geometry = new THREE.Geometry();
  geometry.morphAttributes = {};
  const material = new THREE.PointsMaterial({
    size: 1,
    color: 0x595e7d,
    sizeAttenuation: false,
  });
  const imageData = getImageData(video);

  for (let i = 0; i < imageData.height; i++) {
    for (let k = 0; k < imageData.width; k++) {
      const vertex = new THREE.Vector3(k - imageData.width / 2, -i + imageData.height / 2, 0);
      geometry.vertices.push(vertex);
    }
  }

  particles = new THREE.Points(geometry, material);
  scene.add(particles);

  gui.add(material, "size", 0.7, 2);
  gui.add(material, "sizeAttenuation");
};

const getImageData = (image) => {
  const w = video.videoWidth;
  const h = video.videoHeight;

  canvas.width = w;
  canvas.height = h;

  // Reverse image like a mirror
  ctx.translate(w, 0);
  ctx.scale(-1, 1);

  // Draw to canvas
  ctx.drawImage(image, 0, 0);

  // Get image as array
  return ctx.getImageData(0, 0, w, h);
};

const draw = () => {
  dataURL = canvas.toDataURL();
  clock.getDelta();

  analyser.getByteFrequencyData(dataArray);

  const sum = dataArray.reduce((a, b) => a + b, 0);
  const average = sum / dataArray.length || 0;

  // video
  if (particles) {
    const imageData = getImageData(video);

    for (let i = 0; i < particles.geometry.vertices.length; i++) {
      const particle = particles.geometry.vertices[i];

      let index = i * 4;
      let gray = (imageData.data[index] + imageData.data[index + 1] + imageData.data[index + 2]) / 3;

      let threshold = 400;
      if (gray < threshold) {
        particle.z = gray * (average / 10);
      } else {
        particle.z = 10000;
      }
    }
    particles.geometry.verticesNeedUpdate = true;
  }

  renderer.render(scene, camera);

  requestAnimationFrame(draw);
};

const onResize = () => {
  width = window.innerWidth;
  height = window.innerHeight;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
};

window.addEventListener("resize", onResize);

const button = document.getElementById("button");

button.addEventListener("click", () => screenShot(), false);

async function screenShot() {
  await axios({
    method: "post",
    url: "  http://localhost:3002/screenshot",
    data: {
      dataURL,
    },
  });
}

init();
