import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
//const numeric = require('numeric');
//import _ from 'numeric';
import { Matrix, EigenvalueDecomposition } from 'ml-matrix';

// Sky shader
const vertexShader = `
varying vec3 vWorldPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
varying vec3 vWorldPosition;
void main() {
  float h = normalize(vWorldPosition).y;
  vec3 topColor = vec3(0.6, 0.7, 0.9);
  vec3 bottomColor = vec3(0.9, 0.9, 1.0);
  gl_FragColor = vec4(mix(bottomColor, topColor, smoothstep(-0.5, 0.5, h)), 1.0);
}
`;

const skyGeo = new THREE.SphereGeometry(1000, 32, 15);
const skyMat = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  side: THREE.BackSide,
});
const sky = new THREE.Mesh(skyGeo, skyMat);
sky.userData = {ignoreIntersect: 1};

// Setup
const scene = new THREE.Scene();
scene.add(sky);
//scene.background = new THREE.Color(0xaaaaff);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const sphereRadius = 0.1; // radius at unit distance

let nodes = new Array();
let edges = new Array();
const red = new THREE.Color().setRGB(1.0, 0.0, 0.0);   // red
const blue = new THREE.Color().setRGB(0.0, 0.0, 1.0); // blue
const defaultColor = new THREE.Color( 0x44ccff );

// Math and Hues
let laplacian;
let hues;
let compiled = false;
const generateLaplacian = () => {
    let L = [...Array(nodes.length)].map(e => Array(nodes.length).fill(0));
    let nodeMap = new Map(nodes.map((v, i) => [v, i]));
    let degs = Array(nodes.length).fill(0);
    for (const edge of edges) {
        const i = nodeMap.get(edge.userData.startNode);
        const j = nodeMap.get(edge.userData.endNode);
        L[i][j] = -1;
        L[j][i] = -1;
        degs[i] += 1;
        degs[j] += 1;
    }
    for (let i = 0; i < nodes.length; i++) {
        L[i][i] = degs[i];
    }
    return L;
}

const transpose = matrix => matrix[0].map((_, col) => matrix.map(row => row[col]))

const getHueMaps = (lap) => {
    /*
    let L = new Matrix(lap);
    let e = new EigenvalueDecomposition(L, { assumeSymmetric : true });
    let real = e.realEigenvalues;
    let vectors = e.eigenvectorMatrix.to2DArray();
    vectors.sort((a, b) => real.indexOf(a) - real.indexOf(b)); // Sort just in case
    console.log(L.to2DArray());
    console.log(real);
    console.log(vectors);
    return vectors.slice(1);
    */

    const evd = numeric.eig(lap);
    const transposed_eigens = transpose(evd.E.x);
    console.log(transposed_eigens);
    return transposed_eigens.slice(1); // Ignore the first eigenvector bc it's just [1, ..., 1]
}

const applyHue = (hue) => {
    for (let i = 0; i < nodes.length; i++) {
        const t = (hue[i] + 1) / 2;
        const color = new THREE.Color();
        color.lerpColors(red, blue, t);
        nodes[i].material.color.copy(color);
        /*
        if (hue[i] > 0) {
            nodes[i].material.color.copy(red);
        } else {
            nodes[i].material.color.copy(blue);
        }
        */
    }
}
const resetHue = () => {
    for (const node of nodes) {
        node.material.color.copy(defaultColor);
    }
}

const flipOffHues = () => {
    console.log('almost');
    if (compiled) {
        console.log('called');
        compiled = false;
        resetHue();
        document.getElementById('slider').remove();
        document.getElementById('resetter').remove();
    }
}

// Controls
let pointerType = 0; // 0: clicker, 1: orbit

// ORBIT
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;  // smooth motion
controls.dampingFactor = 0.05;  // tweak feel
controls.screenSpacePanning = false; // true = pan orthogonally, false = up/down pan vertical

controls.minDistance = 1;      // zoom in limit
controls.maxDistance = 8;    // zoom out limit
controls.maxPolarAngle = Math.PI / 2; // up/down rotation limit

// CLICKING
let getIntersect = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true); // true = recursive
    if (intersects.length > 0) {
        return intersects[0];
    }
}

let handleClick = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true); // true = recursive

    const fixedDistance = 3;
    if (intersects.length > 0) {
        const obj = intersects[0].object;
        if (obj.userData.ignoreIntersect == 1) {
            //raycaster.setFromCamera(mouse, camera);
            const direction = raycaster.ray.direction.clone();
            const origin = raycaster.ray.origin.clone();

            const point = origin.add(direction.multiplyScalar(fixedDistance));

            const radius = 0.1;
            const geometry = new THREE.SphereGeometry(radius, 16, 16);
            const material = new THREE.MeshStandardMaterial({ color: 0x44ccff });
            const sphere = new THREE.Mesh(geometry, material);
            sphere.userData = {ignoreIntersect: 0, type: 'sphere'};
            sphere.position.copy(point);
            nodes.push(sphere);

            scene.add(sphere);
        } else {
            // If no hits...
            if (obj.userData.type == 'sphere') {
                const pos = obj.position;
                obj.geometry.dispose();
                obj.material.dispose();
                scene.remove(obj);
                nodes.splice(nodes.indexOf(obj), 1);
                // Remove edges connected to node
                for (let i = edges.length - 1; i >= 0; i--) {
                    const edge = edges[i];
                    if (edge.userData.startNode.position == pos || edge.userData.endNode.position == pos) {
                        edge.geometry.dispose();
                        edge.material.dispose();
                        scene.remove(edge);
                        edges.splice(i, 1);
                    }
                }
            } else if (obj.userData.type == 'edge') {
                obj.geometry.dispose();
                obj.material.dispose();
                scene.remove(obj);
                edges.splice(edges.indexOf(obj), 1);
            }
        }
    }
};

let handleNonControlDrag = (Node1, Node2) => {
    // Add a cylinder
    const A = Node1.position;
    const B = Node2.position;

    // Check to see if a duplicate edge already exists and delete it if so
    for (let i = edges.length - 1; i >= 0; i--) {
        const edge = edges[i];
        if (
            (edge.userData.startNode.position == A && edge.userData.endNode.position == B) ||
            (edge.userData.startNode.position == B && edge.userData.endNode.position == A)
        ) {
            edge.geometry.dispose();
            edge.material.dispose();
            scene.remove(edge);
            edges.splice(i, 1);
            return;
        }
    }

    const radius = 0.03;
    const dir = new THREE.Vector3().subVectors(A, B);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5);

    const geometry = new THREE.CylinderGeometry(radius, radius, len, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x44ccff });
    const cylinder = new THREE.Mesh(geometry, material);
    cylinder.userData = {ignoreIntersect: 0, type: 'edge', startNode: Node1, endNode: Node2};
    edges.push(cylinder);

    // orient cylinder so Y axis matches direction vector
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    cylinder.applyQuaternion(quat);

    cylinder.position.copy(mid);
    scene.add(cylinder);
    //return cylinder;
};

let clickTime = 0;
let isDragging = false;
let dragStart;
renderer.domElement.addEventListener('mousedown', (e) => {
    let intersect = getIntersect(e);
    if (intersect.object.userData.type == 'sphere') {
        // Start drag logic
        dragStart = intersect.object;
        controls.enabled = false;
        isDragging = true;
        flipOffHues();
    }
    clickTime = performance.now();
});
renderer.domElement.addEventListener('mouseup', (e) => {
    const dt = performance.now() - clickTime;
    if (isDragging) {
        flipOffHues();
        if (dt < 200) {
            controls.enabled = true;
            isDragging = false;
            let intersect = getIntersect(e);
            if (intersect.object.userData.type == 'sphere' && intersect.object.position === dragStart.position) {
                handleClick(e);
            }
        } else {
            let intersect = getIntersect(e);
            if (intersect.object.userData.type == 'sphere') {
                //const dragEnd = intersect.object.position.clone();
                const dragEnd = intersect.object;
                handleNonControlDrag(dragStart, dragEnd);
            }
            controls.enabled = true;
            isDragging = false
        }
    } else if (dt < 200 && pointerType == 0) {
        flipOffHues();
        handleClick(e); // treat as click, not drag
    }
});

document.getElementById('compile-button').addEventListener('click', () => {
    if (nodes.length > 1) {
        laplacian = generateLaplacian();
        console.log('laplacian: ' + laplacian);
        compiled = true;
        hues = getHueMaps(laplacian);

        // Build Slider
        const slider = document.createElement('input');
        slider.id = 'slider';
        slider.type = 'range';
        slider.min = 1;
        slider.max = nodes.length - 1;
        slider.step = 1;
        slider.value = 0;
        /*
        slider.style.position = 'absolute';
        slider.style.bottom = '20px';
        slider.style.left = '20px';
        slider.style.zIndex = '1000';
        */

        slider.addEventListener('input', () => {
            const tick = parseInt(slider.value);
            applyHue(hues[tick - 1]);
        });
        document.getElementById('ui-elements').appendChild(slider);
        const resetter = document.createElement('button');
        resetter.id = 'resetter';
        resetter.textContent = 'Reset Color';
        resetter.onclick = () => { resetHue(); };
        document.getElementById('ui-elements').appendChild(resetter);

        applyHue(hues[0]);
    }
});

// optional: limits on angles
controls.maxPolarAngle = Math.PI / 2; // up/down rotation limit

// Light source
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
light.castShadow = true;

light.shadow.mapSize.width = 1024;
light.shadow.mapSize.height = 1024;
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 500;
light.shadow.camera.left = -10;
light.shadow.camera.right = 10;
light.shadow.camera.top = 10;
light.shadow.camera.bottom = -10;

scene.add(light);

// Generate Geom
/*
const geometry = new THREE.SphereGeometry( 1, 32, 16 );
const material = new THREE.MeshBasicMaterial( { color: 0xaaaaff } );
const sphere = new THREE.Mesh( geometry, material );
scene.add( sphere );
*/

camera.position.z = 5;

// Run loop
function animate() {
    controls.update();
    renderer.render( scene, camera );
}
renderer.setAnimationLoop( animate );
