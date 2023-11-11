let workerCanvas = null;
let workerCtx = null;
let colors = randomColorArray();

// Worker message handling
self.onmessage = (e) => {
  //console.log(e.data);
  if (e.data.canvas) {
    workerCanvas = e.data.canvas;
    workerCtx = workerCanvas.getContext("2d");
  }

  const { pos, sidelen, w, h, depth, clear } = e.data;

  workerCanvas.width = w;
  workerCanvas.height = h;

  if (clear) {
    workerCtx.clearRect(0, 0, w, h);
  }

  createSierpinskiTriangle(pos, sidelen, depth);

  postMessage("draw completed");
};

/** Create the sierpinski triangle */
const createSierpinskiTriangle = (pos, sidelen, depth) => {
  // Inner triangle side length is half the outer triangle side length
  const innerTriangleSidelen = sidelen / 2;
  const innerTrianglesPositions = [
    pos,
    [pos[0] + innerTriangleSidelen, pos[1]],
    [
      pos[0] + innerTriangleSidelen / 2,
      pos[1] - Math.sin(Math.PI / 3) * innerTriangleSidelen,
    ],
  ];
  // Base case
  // We only draw one triangle here for each position
  if (depth === 0) {
    innerTrianglesPositions.forEach((trianglePosition, _) => {
      createTriangle(trianglePosition, innerTriangleSidelen, _);
    });
    // Recursive case
  } else {
    innerTrianglesPositions.forEach((trianglePosition) => {
      createSierpinskiTriangle(
        trianglePosition,
        innerTriangleSidelen,
        depth - 1
      );
    });
  }
};

/** Draw a triangle */
function createTriangle(pos, sidelen, idx) {
  //console.log(colors);
  workerCtx.fillStyle = colors[idx];
  workerCtx.beginPath();
  workerCtx.moveTo(...pos); // Start at the left
  workerCtx.lineTo(
    pos[0] + sidelen / 2,
    pos[1] - sidelen * Math.sin(Math.PI / 3)
  );
  workerCtx.lineTo(pos[0] + sidelen, pos[1]);
  workerCtx.lineTo(...pos);
  workerCtx.closePath();
  workerCtx.fill();
}

function randomHslColor() {
  return "hsla(" + Math.random() * 360 + ", 100%, 50%, 1)";
}

function randomColorArray() {
  var colors = [];
  while (colors.length < 10) {
    colors.push(randColor());
  }
  return colors;

  function randColor() {
    return (
      "#" +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")
        .toUpperCase()
    );
  }
}
