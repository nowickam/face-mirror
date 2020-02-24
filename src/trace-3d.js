const MODEL_URL = "./import/models";
const POINTS_NO = 68;
const DIST = 175;
const FOV = 75;
const CAM_TAN = Math.tan(FOV / 2);
const MAX_LINES = 1000;
const CURVE = 8;
const TIME = 200;
const MIN_OFF = 80;
const MAX_OFF = 20;

const MOUTH1 = 51;
const MOUTH2 = 62;
const MOUTH3 = 66;
const MOUTH4 = 57;

const NOSE1 = 30;
const NOSE2 = 33;

const L_LEYE = 45;
const L_REYE = 39;
const R_LEYE = 42;
const R_REYE = 36;

const LBROW = 26;
const RBROW = 17;

const JAW = 16;


let initZ, initY, initDist;

let initXFace, initYFace;

let root, scene, renderer, geometry, material, camera,startView;
let imageCapture;
let width, height;
let points, lines;
let drawCount, firstLine;

let eyeJawD, tempEyeJawD, noseD, tempNoseD, mouthD, tempMouthD, jawMouthD, tempJawMouthD;
let noseAlpha;

async function modelsInit() {
    await faceapi.loadSsdMobilenetv1Model(MODEL_URL);
    await faceapi.loadFaceLandmarkModel(MODEL_URL);
    await faceapi.loadFaceRecognitionModel(MODEL_URL);
    console.log("Models loaded");
}

function videoInit() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(function (stream) {
            let streamTrack = stream.getVideoTracks()[0];
            imageCapture = new ImageCapture(streamTrack);
            root.style.cursor="move";
            loader.style.display="none";
            animate();
        })
        .catch(function (err) {
            alert("An error occurred! " + err);
        })
        .finally(() => console.log("Video loaded"));
}


function sceneInit() {
    width = window.innerWidth;
    height = window.innerHeight;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 1000);
    camera.position.set(0, 0, DIST);

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(width, height);
    root.appendChild(renderer.domElement);

    points = new Float32Array(POINTS_NO * 3);
    initZ = new Float32Array(POINTS_NO);
    initY = new Float32Array(POINTS_NO);
    initDist = new Float32Array(POINTS_NO);

    drawCount = 0;
    firstLine = true;
    material = new THREE.LineBasicMaterial({ vertexColors: THREE.VertexColors, transparent: true, opacity: 0.5 });

    geometry = new Array(POINTS_NO);
    lines = new Array(POINTS_NO);

    for (let i = 0; i < POINTS_NO; i++) {
        geometry[i] = new THREE.BufferGeometry();
        geometry[i].setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_LINES * 3), 3));
        geometry[i].setAttribute("color", new THREE.BufferAttribute(new Float32Array(MAX_LINES * 3), 3));
        geometry[i].setDrawRange(0, drawCount);
        lines[i] = new THREE.Line(geometry[i], material);
        scene.add(lines[i]);
    }

    //for spinning 3d view
    let controls = new THREE.OrbitControls(camera, renderer.domElement);
    window.addEventListener("resize", onWindowResize);
    console.log("Scene loaded");
}

function pointsDist(p1, p2) {
    let xy = Math.sqrt(Math.pow(points[3 * p1] - points[3 * p2], 2) + Math.pow(points[3 * p1 + 1] - points[3 * p2 + 1], 2));
    let z = points[3 * p1 + 2] - points[3 * p2 + 2];
    return Math.sqrt(Math.pow(xy, 2) + Math.pow(z, 2));
}


function jawDepth() {
    let offset, offsetX, offsetY, diff, diffX, diffY, startY;
    //first hardcode the depth
    if (firstLine) {
        offset = MIN_OFF;
        diff = offset / (JAW / 2);
        for (let i = 1; i <= (JAW + 1) / 2; i++) {
            //set z-value
            points[3 * i - 1] = points[3 * ((JAW + 1) - i) + 2] = -offset;
            //set x-value according to the camera fov
            points[3 * i - 3] -= offset * CAM_TAN;
            points[3 * ((JAW + 1) - i)] += offset * CAM_TAN;
            //set initial distance for color change
            initDist[i - 1] = pointsDist(i - 1, i);
            initDist[JAW + 1 - i] = pointsDist(JAW + 1 - i, JAW - i);

            offset = Math.abs(offset - diff);
        }
        //set initial distance for the chin (last point)
        initDist[JAW / 2] = pointsDist(JAW / 2, JAW / 2 - 1);
    }
    //then manipulate the default state depending on eye-jaw distance
    else {
        offsetX = 2 * (eyeJawD - tempEyeJawD);
        offsetY = jawMouthD - tempJawMouthD;
        diffX = offsetX / (JAW / 2);
        diffY = offsetY / (JAW / 2);
        startY = 0;
        for (let i = 0; i <= JAW; i++) {
            //set z-value
            points[3 * i + 2] = initZ[i] - offsetX;

            offsetX -= diffX;

            points[3 * i + 2] -= startY;

            //set x-value according to camera fov
            if (i <= JAW / 2) { startY += diffY; points[3 * i] += points[3 * i + 2] * CAM_TAN; }
            else { startY -= diffY; points[3 * i] -= points[3 * i + 2] * CAM_TAN; }
        }

    }

}

function mouthDepth() {
    if (firstLine) {
        let start = 0;
        let offset = MIN_OFF / 4;
        let diff = offset / 3;
        for (let i = 0; i <= 3; i++) {
            //z-value
            points[3 * (MOUTH1 + i) + 2] = points[3 * (MOUTH1 - i) + 2] = points[3 * (MOUTH4 + i) + 2] = points[3 * (MOUTH4 - i) + 2] = start;
            if (i < 3) points[3 * (MOUTH2 + i) + 2] = points[3 * (MOUTH2 - i) + 2] = points[3 * (MOUTH3 + i) + 2] = points[3 * (MOUTH3 - i) + 2] = start;
            //corresponding x-value
            points[3 * (MOUTH1 + i)] -= start * CAM_TAN;
            points[3 * (MOUTH2 + i)] -= start * CAM_TAN;
            points[3 * (MOUTH3 + i)] += start * CAM_TAN;
            points[3 * (MOUTH4 + i)] += start * CAM_TAN;

            points[3 * (MOUTH1 - i)] += start * CAM_TAN;
            points[3 * (MOUTH2 - i)] += start * CAM_TAN;
            points[3 * (MOUTH3 - i)] -= start * CAM_TAN;
            points[3 * (MOUTH4 - i)] -= start * CAM_TAN;
            //initial dist for color change
            initDist[(MOUTH1 + i)] = pointsDist(MOUTH1 + i, MOUTH1 + i - 1);
            initDist[(MOUTH2 + i)] = pointsDist(MOUTH2 + i, MOUTH2 + i - 1);
            initDist[(MOUTH3 + i)] = pointsDist(MOUTH3 + i, MOUTH3 + i - 1);
            initDist[(MOUTH4 + i)] = pointsDist(MOUTH4 + i, MOUTH4 + i - 1);

            initDist[(MOUTH1 - i)] = pointsDist(MOUTH1 - i, MOUTH1 - i + 1);
            initDist[(MOUTH2 - i)] = pointsDist(MOUTH2 - i, MOUTH2 - i + 1);
            initDist[(MOUTH3 - i)] = pointsDist(MOUTH3 - i, MOUTH3 - i + 1);
            initDist[(MOUTH4 - i)] = pointsDist(MOUTH4 - i, MOUTH4 - i + 1);

            start -= diff;
        }
    }
    else {
        let startX = 0, startY, endY;
        let offsetX = 20 * (mouthD - tempMouthD), offsetY = jawMouthD - tempJawMouthD;
        let diffX = offsetX / 3, diffY = offsetY / 4;
        if (offsetY > 0) { startY = offsetY; endY = diffY }
        else { startY = diffY; endY = offsetY }
        // outer mouth, outer mouth middles, no mouth corners
        for (let i = 0; i < 3; i++) {
            //z
            points[3 * (MOUTH1 + i) + 2] = initZ[MOUTH1 + i] + startX - startY;
            points[3 * (MOUTH1 - i) + 2] = initZ[MOUTH1 - i] - startX - startY;
            points[3 * (MOUTH4 + i) + 2] = initZ[MOUTH4 + i] - startX - endY;
            points[3 * (MOUTH4 - i) + 2] = initZ[MOUTH4 - i] + startX - endY;
            //x
            points[3 * (MOUTH1 + i)] -= Math.abs((points[3 * (MOUTH1 + i) + 2]) * CAM_TAN);
            points[3 * (MOUTH1 - i)] += Math.abs((points[3 * (MOUTH1 - i) + 2]) * CAM_TAN);
            points[3 * (MOUTH4 + i)] += Math.abs((points[3 * (MOUTH4 + i) + 2]) * CAM_TAN);
            points[3 * (MOUTH4 - i)] -= Math.abs((points[3 * (MOUTH4 - i) + 2]) * CAM_TAN);
            startX += diffX;
        }
        //z for corners, otherwise it would cancel out in the loop
        points[3 * (MOUTH1 - 3) + 2] = initZ[MOUTH1 - 3] - startX;
        points[3 * (MOUTH2 - 2) + 2] = initZ[MOUTH2 - 2] - startX;

        points[3 * (MOUTH1 + 3) + 2] = initZ[MOUTH1 + 3] + startX;
        points[3 * (MOUTH2 + 2) + 2] = initZ[MOUTH2 + 2] + startX;

        //x
        points[3 * (MOUTH1 - 3)] += (points[3 * (MOUTH1 - 3) + 2]) * CAM_TAN;
        points[3 * (MOUTH2 - 2)] += (points[3 * (MOUTH1 - 2) + 2]) * CAM_TAN;

        points[3 * (MOUTH1 + 3)] -= (points[3 * (MOUTH1 + 3) + 2]) * CAM_TAN;
        points[3 * (MOUTH2 + 2)] -= (points[3 * (MOUTH1 + 2) + 2]) * CAM_TAN;

        startX -= diffX;
        if (offsetY > 0) { startY -= diffY; endY += diffY }
        else { startY += diffY; endY -= diffY }

        //z for the rest of inner mouth with inner mouth middles, because different number of points
        points[3 * MOUTH2 + 2] = initZ[MOUTH2] + startY;
        points[3 * MOUTH3 + 2] = initZ[MOUTH2] + endY;
        points[3 * (MOUTH2 - 1) + 2] = initZ[MOUTH2 - 1] - startX - startY;
        points[3 * (MOUTH3 + 1) + 2] = initZ[MOUTH2 - 1] - startX - endY;
        points[3 * (MOUTH2 + 1) + 2] = initZ[MOUTH2 + 1] + startX - startY;
        points[3 * (MOUTH3 - 1) + 2] = initZ[MOUTH2 + 1] + startX - endY;

        //x
        points[3 * MOUTH2] += (points[3 * MOUTH2 + 2]) * CAM_TAN;
        points[3 * MOUTH3] += (points[3 * MOUTH3 + 2]) * CAM_TAN;
        points[3 * (MOUTH2 - 1)] += (points[3 * (MOUTH2 - 1) + 2]) * CAM_TAN;
        points[3 * (MOUTH3 + 1)] += (points[3 * (MOUTH3 + 1) + 2]) * CAM_TAN;
        points[3 * (MOUTH2 + 1)] -= (points[3 * (MOUTH2 + 1) + 2]) * CAM_TAN;
        points[3 * (MOUTH3 - 1)] -= (points[3 * (MOUTH3 - 1) + 2]) * CAM_TAN;

    }
}

function noseDepth() {
    if (firstLine) {
        let offset = MAX_OFF / (2 / 3);
        let diff = offset / 3;
        // nose bridge
        for (let i = 0; i <= 3; i++) {
            points[3 * (NOSE1 - i) + 2] = offset;
            //initial dist for color change
            initDist[NOSE1 - i] = pointsDist(NOSE1 - i, NOSE1 - i + 1);
            offset -= diff;
        }

        //angle of the nose for the y-movement to go along the nose 
        noseAlpha = Math.atan((points[3 * (NOSE1 - 1) + 1] - points[3 * NOSE1 + 1]) / diff);

        offset = MAX_OFF;
        diff = (MIN_OFF / 6 + MAX_OFF) / 2;
        // nose bottom
        for (let i = 0; i <= 2; i++) {
            //z-value
            points[3 * (NOSE2 - i) + 2] = points[3 * (NOSE2 + i) + 2] = offset;
            //x-value
            points[3 * (NOSE2 - i)] -= offset * CAM_TAN;
            points[3 * (NOSE2 + i)] += offset * CAM_TAN;
            //initial dist for color change
            initDist[NOSE2 - i] = pointsDist(NOSE2 - i, NOSE2 - i + 1);
            initDist[NOSE2 + i] = pointsDist(NOSE2 + i, NOSE2 + i - 1);

            offset -= diff;
        }
    }
    else {
        let offset = noseD - tempNoseD;
        let diff = offset / 2;
        //nose bottom
        for (let i = 2; i >= 0; i--) {
            //z
            points[3 * (NOSE2 - i) + 2] = initZ[NOSE2 - i] - offset;
            points[3 * (NOSE2 + i) + 2] = initZ[NOSE2 + i] + offset;
            //x
            points[3 * (NOSE2 - i)] += (points[3 * (NOSE2 - i) + 2]) * CAM_TAN;
            points[3 * (NOSE2 + i)] -= (points[3 * (NOSE2 + i) + 2]) * CAM_TAN;
            offset -= diff;
        }
        //nose bridge
        for (let i = 0; i <= 3; i++) {
            //z value corresponding to the angle of the nose
            offset = (Math.abs(initY[NOSE1 - i] - points[3 * (NOSE1 - i) + 1])) / (Math.tan(noseAlpha));
            points[3 * (NOSE1 - i) + 2] = initZ[NOSE1 - i] - offset;
        }
    }
}

function eyesDepth() {
    if (firstLine) {
        //z-value
        points[3 * L_LEYE + 2] = points[3 * L_REYE + 2] = points[3 * R_LEYE + 2] = points[3 * R_REYE + 2] = -MIN_OFF / 2;
        points[3 * (L_LEYE + 1) + 2] = points[3 * (L_LEYE + 2) + 2] = points[3 * (L_REYE + 1) + 2] = points[3 * (L_REYE + 2) + 2] =
            points[3 * (R_LEYE + 1) + 2] = points[3 * (R_LEYE + 2) + 2] = points[3 * (R_REYE + 1) + 2] = points[3 * (R_REYE + 2) + 2] = -MIN_OFF / 3;
        //x-value
        points[3 * L_LEYE] -= (-MIN_OFF / 2) * CAM_TAN;
        points[3 * L_REYE] += (-MIN_OFF / 2) * CAM_TAN;
        points[3 * R_LEYE] -= (-MIN_OFF / 2) * CAM_TAN;
        points[3 * R_REYE] += (-MIN_OFF / 2) * CAM_TAN;
        points[3 * (L_LEYE + 1)] -= (-MIN_OFF / 3) * CAM_TAN;
        points[3 * (L_LEYE + 2)] -= (-MIN_OFF / 3) * CAM_TAN;
        points[3 * (L_REYE + 1)] += (-MIN_OFF / 3) * CAM_TAN;
        points[3 * (L_REYE + 2)] += (-MIN_OFF / 3) * CAM_TAN;
        points[3 * (R_LEYE + 1)] -= (-MIN_OFF / 3) * CAM_TAN;
        points[3 * (R_LEYE + 2)] -= (-MIN_OFF / 3) * CAM_TAN;
        points[3 * (R_REYE + 1)] += (-MIN_OFF / 3) * CAM_TAN;
        points[3 * (R_REYE + 2)] += (-MIN_OFF / 3) * CAM_TAN;
        //init dist for color change
        for (let i = 0; i <= 2; i++) {
            initDist[L_LEYE + i] = pointsDist(L_LEYE + i, L_LEYE + i - 1);
            initDist[L_REYE + i] = pointsDist(L_REYE + i, L_REYE + i - 1);
            initDist[R_LEYE + i] = pointsDist(R_LEYE + i, R_LEYE + i + 1);
            initDist[R_REYE + i] = pointsDist(R_REYE + i, R_REYE + i + 1);
        }
    }
    else {
        let offset = (eyeJawD - tempEyeJawD) / 2;
        let diff = offset / 4;

        //z for the right eye
        points[3 * R_REYE + 2] = initZ[R_REYE] - (offset - 3 * diff);
        points[3 * (R_REYE + 1) + 2] = points[3 * (R_REYE + 5) + 2] = initZ[R_REYE + 1] - (offset - 2 * diff);
        points[3 * (R_REYE + 2) + 2] = points[3 * (R_REYE + 4) + 2] = initZ[R_REYE + 2] - (offset - diff);
        points[3 * (R_REYE + 3) + 2] = initZ[R_REYE + 3] - offset;
        //corresponding x
        for (let i = 0; i <= 5; i++) {
            points[3 * (R_REYE + i)] += points[3 * (R_REYE + i) + 2] * CAM_TAN;
        }

        //z for the left eye
        points[3 * R_LEYE + 2] = initZ[R_LEYE] + offset;
        points[3 * (R_LEYE + 1) + 2] = points[3 * (R_LEYE + 5) + 2] = initZ[R_LEYE + 1] + (offset + 2 * diff);
        points[3 * (R_LEYE + 2) + 2] = points[3 * (R_LEYE + 4) + 2] = initZ[R_LEYE + 2] + (offset + 3 * diff);
        points[3 * (R_LEYE + 3) + 2] = initZ[R_LEYE + 3] + (offset + 4 * diff);
        //correspodning x
        for (let i = 0; i <= 5; i++) {
            points[3 * (R_LEYE + i)] -= points[3 * (R_LEYE + i) + 2] * CAM_TAN;
        }
    }
}


function browsDepth() {
    if (firstLine) {
        let offset = MIN_OFF / 2;
        let diff = offset / 5;
        for (let i = 0; i <= 4; i++) {
            //z-value
            points[3 * (LBROW - i) + 2] = points[3 * (RBROW + i) + 2] = -offset;
            //x-value
            points[3 * (LBROW - i)] += offset * CAM_TAN;
            points[3 * (RBROW + i)] -= offset * CAM_TAN;
            //init dist for color change
            initDist[LBROW - i] = pointsDist(LBROW - i, LBROW - i - 1);
            initDist[RBROW + i] = pointsDist(RBROW + i, RBROW + i + 1);
            offset -= diff;
        }
    }
    else {
        let offset = (eyeJawD - tempEyeJawD) / 2;
        let diff = offset / 3;
        for (let i = 0; i < 3; i++) {
            //z for both brows
            points[3 * (RBROW + i) + 2] = initZ[RBROW + i] - offset;
            points[3 * (LBROW - i) + 2] = initZ[LBROW - i] + offset;
            //x
            points[3 * (RBROW + i)] += (points[3 * (RBROW + i) + 2]) * CAM_TAN;
            points[3 * (LBROW - i)] -= (points[3 * (RBROW + i) + 2]) * CAM_TAN;
            offset -= diff;
        }
    }
}

function setDepth() {
    //current x- and y-coordinates of distances between features
    let eyeJawX = points[0] - points[3 * R_REYE];
    let eyeJawY = points[0 + 1] - points[3 * R_REYE + 1];
    let noseX = points[3 * (NOSE1 + 1)] - points[3 * NOSE1];
    let noseY = points[3 * (NOSE1 + 1) + 1] - points[3 * NOSE1 + 1];
    let mouthX = points[3 * (MOUTH1 - 3)] - points[3 * (MOUTH2 - 2)];
    let mouthY = points[3 * (MOUTH1 - 3) + 1] - points[3 * (MOUTH2 - 2) + 1];
    let jawMouthX = points[3 * (MOUTH4)] - points[3 * (JAW / 2)];
    let jawMouthY = points[3 * (MOUTH4) + 1] - points[3 * (JAW / 2) + 1];

    //current distances between features
    if (!firstLine) {
        tempEyeJawD = Math.sqrt(Math.pow(eyeJawX, 2) + Math.pow(eyeJawY, 2));
        tempNoseD = Math.sqrt(Math.pow(noseX, 2) + Math.pow(noseY, 2));
        tempMouthD = Math.sqrt(Math.pow(mouthX, 2) + Math.pow(mouthY, 2));
        tempJawMouthD = Math.sqrt(Math.pow(jawMouthX, 2) + Math.pow(jawMouthY, 2));
    }

    //set the depths of features
    jawDepth();
    mouthDepth();
    noseDepth();
    eyesDepth();
    browsDepth();

    //establish default distances (with x-adjustments when adding depth)
    if (firstLine) {
        eyeJawD = Math.sqrt(Math.pow(eyeJawX, 2) + Math.pow(eyeJawY, 2));
        noseD = Math.sqrt(Math.pow(noseX, 2) + Math.pow(noseY, 2));
        mouthD = Math.sqrt(Math.pow(mouthX, 2) + Math.pow(mouthY, 2));
        jawMouthD = Math.sqrt(Math.pow(jawMouthX, 2) + Math.pow(jawMouthY, 2));
    }
}

function updatePoints(result) {
    let index = 0;

    if(firstLine){
        initXFace=result.landmarks.shift.x;
        initYFace=result.landmarks.shift.y;
    }

    //map positions of landmark points
    result.unshiftedLandmarks.positions.map(
        point => {
            points[index++] = -point.x + initXFace - result.landmarks.shift.x + result.landmarks.imageWidth/2 ;
            points[index++] = -point.y + initYFace - result.landmarks.shift.y + result.landmarks.imageHeight/1.5;
            index++;
        }
    )

    setDepth();

    //pre-make firstLine curve for drawing iteration to start off with CURVE points
    if (firstLine) {
        for (let j = 0; j < POINTS_NO; j++) {
            let start = lines[j].geometry.attributes.position.array;
            initZ[j] = points[3 * j + 2];
            initY[j] = points[3 * j + 1];
            for (let i = 0; i < 3 * CURVE; i += 3) {
                start[i] = points[3 * j];
                start[i + 1] = points[3 * j + 1];
                start[i + 2] = points[3 * j + 2];
            }
        }
    }
    firstLine = false;
}

function drawPaths() {
    for (let i = 0; i < POINTS_NO; i++) {
        let line = lines[i].geometry.attributes.position.array;
        let lineColor = lines[i].geometry.attributes.color.array;

        let index = 3 * drawCount;
        let start = new THREE.Vector3(line[index - 3], line[index - 2], line[index - 1]);
        let end = new THREE.Vector3(points[3 * i], points[3 * i + 1], points[3 * i + 2]);
        //x middle, y quater above, z middle
        let mid = new THREE.Vector3(line[index - 3] + (points[3 * i] - line[index - 3]) / 2,
            points[3 * i + 1] + (points[3 * i + 1] - line[index - 2]) / 4,
            line[index - 1] + ((points[3 * i + 2] - line[index - 1]) / 4));
        //color and curve
        let curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        let curvePoints = curve.getPoints(CURVE - 1);
        //map curve points and colors
        for (let j = 0; j < CURVE; j++) {
            let colorValue = Math.tanh(Math.sqrt(Math.pow(start.x - end.x, 2) + Math.pow(start.y - end.y, 2)) / (1.5*initDist[i]));
            lineColor[index] = colorValue;
            line[index++] = curvePoints[j].x;
            lineColor[index] = 1-colorValue;
            line[index++] = curvePoints[j].y;
            lineColor[index] = 1-colorValue;
            line[index++] = curvePoints[j].z;
        }
        lines[i].geometry.attributes.position.needsUpdate = true;
        lines[i].geometry.attributes.color.needsUpdate = true;
    }
}

function setRange() {
    for (let i = 0; i < POINTS_NO; i++) {
        lines[i].geometry.setDrawRange(0, drawCount);
    }
}


function animate() {
    drawCount = (drawCount + 1) % MAX_LINES;

    if (drawCount % CURVE === 1) {
        imageCapture.takePhoto()
            .then(blob => {
                let img = new Image();
                img.src = URL.createObjectURL(blob);
                faceapi.detectSingleFace(img).withFaceLandmarks()
                    .then(result => {
                        if (result === undefined) {
                            //go back and try to take a picture again
                            drawCount--;
                        }
                        else {
                            updatePoints(result);
                            drawPaths();
                            setRange();


                        }
                        renderer.render(scene, camera);
                        requestAnimationFrame(animate);
                    });

            })
            .catch(error => console.error('takePhoto() error:', error));
    }
    else {
        setRange();
        renderer.render(scene, camera);
        setTimeout(() => {
            requestAnimationFrame(animate);
        }, TIME);

    }
}

function onWindowResize() {
    width = window.innerWidth;
    height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}


 async function start() {
    let button=document.querySelector("#start-button");
    let loader=document.querySelector("#loader")
    button.style.display="none";
    root = document.querySelector("#root");
    //root.style.cursor="wait";
    loader.style.display="flex";
    await modelsInit();
    sceneInit();
    videoInit();
}

//start();
