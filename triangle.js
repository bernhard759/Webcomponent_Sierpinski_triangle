// Create a class for the element
class SierpinskiWidget extends HTMLElement {
  static observedAttributes = [];

  constructor() {
    super();

    // Create a shadow root
    const shadow = this.attachShadow({ mode: "open" });
    const sierpinskiHTML = `
      <div class="canvas-container">
      <canvas id="canvas"></canvas>
      <div class="canvas-controls">
          <span class="plus" title="Zoom in">+</span>
          <span class="center" title="Center">&#9678;</span>
          <span class="minus" title="Zoom out">&minus;</span>
          <span class="larr" title="Move left">&larr;</span>
          <span class="uarr" title="Move up">&uarr;</span>
          <span class="darr" title="Move down">&darr;</span>
          <span class="rarr" title="Move right">&rarr;</span>
          <span class="download" title="Download image">&#10515;</span>
          <span class="fullscreen" title="Fullscreen">&#9974;</span>
      </div>
  </div>`;
    const template = document.createElement("template");
    template.innerHTML = sierpinskiHTML;
    shadow.appendChild(template.content.cloneNode(true));

    // Create some CSS to apply to the shadow dom
    const style = document.createElement("style");
    //console.log(style.isConnected);
    style.textContent = `
      :host {
        display: flex;
        flex-direction: column;
        max-width: 600px;
        margin: 0 auto;
    }
    
    .canvas-container {
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
        
    }
    
    .canvas-container:fullscreen {
        background-color: hsl(0, 0%, 15%);
    }
    
    #canvas {
        width: 100%;
        aspect-ratio: 1;
        max-width: 1000px;
        min-width: 300px;
        border-radius: 0.5em;
        background-color: hsl(0, 0%, 95%);
        overflow: hidden;
    }
    
    #canvas.panning {
        cursor: all-scroll;
    }
    
    .canvas-controls {
        color: rgba(255, 255, 255, 0.85);
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 0.5rem;
        position: absolute;
        padding-block: 4px;
        padding-inline: 8px;
        font-size: 150%;
        bottom: 0;
        right: 0;
        border-top-left-radius: 6px;
        border-bottom-right-radius: 6px;
    }
    
    .canvas-controls * {
        cursor: pointer;
    }
    
    .canvas-controls *:hover {
        color: white;
    }
    
    .canvas-controls {
        background: linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.25));
    }`;

    // Attach the created elements to the shadow dom
    shadow.appendChild(style);
  }

  connectedCallback() {
    const shadow = this.shadowRoot;

    let zoomLevel = 0;
    let left, bot, length;
    let zoomFactor = 0.2;
    let zoomRatioX = 1;
    let zoomRatioY = 1;
    let setup = true;

    // Panning
    // mouse drag related variables
    var isDown = false;
    var startX, startY;
    var netPanningX = 0;
    var netPanningY = 0;

    // Canvas
    const canvas = shadow.getElementById("canvas");
    let canvasWidth = canvas.width;
    let canvasHeight = canvas.height;

    // Worker
    const worker = new Worker("worker.js");
    const offscreen = canvas.transferControlToOffscreen();

    // Events
    shadow
      .querySelector(".canvas-controls .plus")
      .addEventListener("click", (e) => {
        zoomTriangle(zoomFactor, 0.5, 0.5, false);
      });
    shadow
      .querySelector(".canvas-controls .center")
      .addEventListener("click", (e) => {
        backToCenter();
      });
    shadow
      .querySelector(".canvas-controls .minus")
      .addEventListener("click", (e) => {
        zoomTriangle(zoomFactor, 0.5, 0.5, true);
      });
    shadow
      .querySelector(".canvas-controls .larr")
      .addEventListener("click", (e) => {
        panCanvasArrows("left");
      });
    shadow
      .querySelector(".canvas-controls .uarr")
      .addEventListener("click", (e) => {
        panCanvasArrows("up");
      });
    shadow
      .querySelector(".canvas-controls .darr")
      .addEventListener("click", (e) => {
        panCanvasArrows("down");
      });
    shadow
      .querySelector(".canvas-controls .rarr")
      .addEventListener("click", (e) => {
        panCanvasArrows("right");
      });
    shadow
      .querySelector(".canvas-controls .download")
      .addEventListener("click", (e) => {
        downloadCanvasContents();
      });
    shadow
      .querySelector(".canvas-controls .fullscreen")
      .addEventListener("click", (e) => {
        toggleFullScreen();
      });

    // RESIZE OBSERVER
    // ###########################################
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        canvasWidth = canvas.offsetWidth;
        canvasHeight = canvasWidth;

        if (setup) {
          length = canvasWidth;
          left = 0;
          bot = canvasHeight;
          setup = false;
        } else {
          length = canvasWidth;
          left = 0;
          bot = canvasHeight;
        }

        worker.postMessage(
          {
            canvas: offscreen,
            pos: [left - netPanningX, bot + netPanningY],
            sidelen: length,
            w: canvasWidth,
            h: canvasHeight,
            depth: 5 + Math.floor(zoomLevel / 10),
            clear: false,
          },
          [offscreen]
        );
        //createSierpinskiTriangle([left - netPanningX, bot + netPanningY], length, 5 + (Math.floor(zoomLevel / 10)));
      });
    });

    observer.observe(canvas);

    // PANNING
    // #################################

    // listen for mouse events
    canvas.onmousedown = function (e) {
      handleMouseDown(e);
    };
    canvas.onmousemove = function (e) {
      handleMouseMove(e);
    };
    canvas.onmouseup = function (e) {
      handleMouseUp(e);
    };
    canvas.onmouseout = function (e) {
      handleMouseOut(e);
    };

    function handleMouseDown(e) {
      e.preventDefault();
      e.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      startX = parseInt(e.clientX - rect.left);
      startY = parseInt(e.clientY - rect.top);

      isDown = true;
    }

    function handleMouseUp(e) {
      e.preventDefault();
      e.stopPropagation();
      canvas.classList.remove("panning");
      isDown = false;
    }

    function handleMouseOut(e) {
      e.preventDefault();
      e.stopPropagation();
      canvas.classList.remove("panning");
      isDown = false;
    }

    function handleMouseMove(e) {
      //console.log(e);
      e.preventDefault();
      e.stopPropagation();

      if (!isDown || !e.ctrlKey) {
        return;
      } else {
        canvas.classList.add("panning");
      }

      panCanvasMouse(e);
    }

    function panCanvasMouse(e) {
      const rect = canvas.getBoundingClientRect();
      // mouse Pos
      const mouseX = parseInt(e.clientX - rect.left);
      const mouseY = parseInt(e.clientY - rect.top);

      // dx & dy are the distance the mouse has moved since
      // the last mousemove event
      const dx = mouseX - startX;
      const dy = mouseY - startY;

      // reset the vars for next mousemove
      startX = mouseX;
      startY = mouseY;

      // accumulate the net panning done
      netPanningX -= dx;
      netPanningY += dy;

      worker.postMessage({
        pos: [left - netPanningX, bot + netPanningY],
        sidelen: length,
        w: canvasWidth,
        h: canvasHeight,
        depth: 5 + Math.floor(zoomLevel / 10),
        clear: true,
      });
    }

    function panCanvasArrows(direction) {
      let width = canvasWidth;
      switch (direction) {
        case "up":
          netPanningY -= 0.1 * width;

          break;
        case "down":
          netPanningY += 0.1 * width;
          break;
        case "right":
          netPanningX -= 0.1 * width;
          break;
        case "left":
          netPanningX += 0.1 * width;
          break;
      }
      worker.postMessage({
        pos: [left - netPanningX, bot + netPanningY],
        sidelen: length,
        w: canvasWidth,
        h: canvasHeight,
        depth: 5 + Math.floor(zoomLevel / 10),
        clear: true,
      });
    }

    // ZOOM
    // #################################

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (!e.ctrlKey) return;
      const { x, y } = getMousePos(canvas, e);
      zoomRatioX = x / canvasWidth;
      zoomRatioY = (canvasHeight - y) / canvasHeight;
      zoomTriangle(zoomFactor, zoomRatioX, zoomRatioY, e.wheelDelta < 0);
    });

    function backToCenter() {
      left = 0;
      bot = canvasHeight;
      length = canvasWidth;
      netPanningX = 0;
      netPanningY = 0;

      worker.postMessage({
        pos: [left, bot],
        sidelen: length,
        w: canvasWidth,
        h: canvasHeight,
        depth: 5 + Math.floor(zoomLevel / 10),
        clear: true,
      });
    }

    function zoomTriangle(zoomFactor, zrX, zrY, zoomOut = false) {
      if (zoomOut) {
        zoomLevel -= 1;
        let delta = zoomFactor * length;
        length -= delta;
        left += delta * zrX;
        bot -= delta * zrY;
      } else {
        zoomLevel += 1;
        let delta = zoomFactor * length;
        length += delta;
        left -= delta * zrX;
        bot += delta * zrY;
      }

      worker.postMessage({
        pos: [left - netPanningX, bot + netPanningY],
        sidelen: length,
        w: canvasWidth,
        h: canvasHeight,
        depth: 5 + Math.floor(zoomLevel / 10),
        clear: true,
      });
      //createSierpinskiTriangle([left - netPanningX, bot + netPanningY], length, 5 + (Math.floor(zoomLevel / 10)));
    }

    // DOWNLOAD

    function downloadCanvasContents() {
      const link = document.createElement("a"); // create link element
      link.download = "sierpinski-triangle.png"; // set download attribute
      link.href = canvas.toDataURL(); // set the link's URL to the data URL to be downloaded
      link.click(); // click the element and download on the user's browser
    }

    // FULLSCREEN

    function toggleFullScreen() {
      if (!document.fullscreenElement) {
        canvas.closest(".canvas-container").requestFullscreen();
      } else if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    }

    // HELPER FUNCTIONS

    function getMousePos(canvas, evt) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top,
      };
    }
  }

  disconnectedCallback() {
    // Maybe remove eventlisteners
  }

  adoptedCallback() {
    // Noting to do here
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // Noting to do here
  }
}

customElements.define("sierpinski-triangle-widget", SierpinskiWidget);
