"use strict";

// TODO dispose existing texture if not the same size, otherwise reuse it
// TODO flag texture updates and viewer updates separately for even better perfs
// TODO fix var/let/const soup
// TODO investigate using a higher bit per channel 

var Context = require('./webgl/context');
var matcapProcess = require('./jobs/matcap-process');
var Viewer = require('./viewer');

function init () {
    var matcapElement = document.querySelector('.matcap');
    var guiElement = document.querySelector('.gui');

    const viewer = new Viewer();

    var context = new Context(512, 512);

    matcapElement.appendChild(context.working.canvas);

    var texture = null;

    var defaults = {
        translationX: 0,
        translationY: 0,
        zoom: 1.0,
        rotation: 0.0,

        multiplier: 1.0,
        add: 0.0,

        type: 0,
        brightness: 0.0,
        contrast: 0.0,
        saturation: 1.0,

        iridescenceAmount: 0.0,
        iridescenceScale: 1.,
        iridescencePower: 2.,
        iridescencePower2: 2.,
        lumaFactor1: 0.5,
        lumaFactor2: 0.5,

        hueShift: 0.,
        tintAmount: 0,
        tintColor: [1., 1., 1.].map(v => v * 255 | 0),
        hueChangeOnBackground: 0.,

        angle: 0.0,
        parabolaFactor: 4.,
        distanceFactor: 1.0,
        distancePower: 2.,

        backgroundRegenerate: false,
        backgroundColor:  [0., 0., 0.].map(v => v * 255 | 0),
        backgroundColorRatio: 0.0,

        fov: 50
    };

    var options = Object.assign({}, defaults);

    var updateRequested = false;

    let previousState = '';

    (function loop() {
        if (updateRequested) {
            // dat.gui is quite fond of sending unecessary update events, make sure the state changed
            const newState = JSON.stringify(options);

            if (newState !== previousState) {
                previousState = newState;

                matcapProcess(context, { input: texture }, { output: { width: 512, height: 512 }}, options);

                viewer.updateTexture(context.working.canvas);
                viewer.updateViewer(options);
            }

            updateRequested = false;
        }

        viewer.update();

        requestAnimationFrame(loop);
    })();

    function update(force) {
        if (force) {
            previousState = '';
        }

        updateRequested = true;
    }

    var body = document.body;

    window.addEventListener('keydown', e => {
        if (document.activeElement.type !== 'text' && e.which === 72) {
            body.classList.toggle('hide-gui');
        }
    });

    body.addEventListener('dragenter', function (e) {
        e.preventDefault();
    });

    body.addEventListener('dragover', function (e) {
        e.preventDefault();
    });

    body.addEventListener('dragleave', function (e) {

    });

    body.addEventListener('drop', function (e) {
        e.preventDefault();

        if (e.dataTransfer.files.length === 0) {
            return;
        }

        const file = e.dataTransfer.files[0];
        const imageMimeType = ['image/jpeg', 'image/png'];

        if (imageMimeType.includes(file.type)) {
            var reader = new FileReader();
            reader.onload = (e) => {
                var img = document.createElement('img');
                img.onload = function () {
                    var width = img.naturalWidth;
                    var height = img.naturalHeight;
                    texture = context.createTexture(width, height, false);
                    texture.updateFromImageElement(img);

                    update(true);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else if (file.name.match(/\.gltf$/) || file.name.match(/\.glb$/) || file.name.match(/\.prwm$/)) {
            var reader = new FileReader();
            reader.onload = (e) => {
                viewer.updateModel(file.name, e.target.result);
            };
            reader.readAsArrayBuffer(file);
        } else if (file.name.match(/\.obj$/)) {
            var reader = new FileReader();
            reader.onload = (e) => {
                viewer.updateModel(file.name, e.target.result);
            };
            reader.readAsText(file);
        }
    });

    function resetGroupToDefaults(groupName) {
        let root = gui;

        if (root.__folders.hasOwnProperty(groupName)) {
            root = root.__folders[groupName];
        }

        for (let controller of root.__controllers) {
            if (defaults.hasOwnProperty(controller.property)) {
                controller.setValue(defaults[controller.property]);
            }
        }

        update(false);
    }

    var gui = new dat.GUI({ width: guiElement.getBoundingClientRect().width, hideable: false, autoPlace: false });
    guiElement.appendChild(gui.domElement);
    var folder = gui.addFolder('Source image modifier');
    folder.add(options, 'translationX', -1.0, 1.0).step(0.001).name('X').onChange(update);
    folder.add(options, 'translationY', -1.0, 1.0).step(0.001).name('Y').onChange(update);
    folder.add(options, 'zoom', 1.0, 10.0).step(0.001).name('Zoom').onChange(update);
    folder.add({ reset: function () {
        resetGroupToDefaults('Source image modifier');
    }}, 'reset').name('Reset');

    var folder = gui.addFolder('Curve and rotation');
    folder.add(options, 'rotation', 0.0, 1.0).step(0.001).name('Rotation').onChange(update);
    folder.add(options, 'multiplier', 0.5, 4.0).step(0.001).name('Curve multiplier').onChange(update);
    folder.add(options, 'add', 0.0, 1.0).step(0.001).name('Curve increase').onChange(update);
    folder.add({ reset: function () {
        resetGroupToDefaults('Curve and rotation');
    }}, 'reset').name('Reset');

    var folder = gui.addFolder('Colors');
    folder.add(options, 'type', { Standard: 0, Smooth: 1 }).name('Color model').onChange(update);
    folder.add(options, 'hueShift', -1.0, 1.0).step(0.001).name('Hue shift').onChange(update);
    folder.add(options, 'brightness', -1.0, 1.0).step(0.001).name('Brightness').onChange(update);
    folder.add(options, 'contrast', -1.0, 1.0).step(0.001).name('Contrast').onChange(update);
    folder.add(options, 'saturation', 0.0, 2.0).step(0.001).name('Saturation').onChange(update);
    folder.add(options, 'tintAmount', 0.0, 1.0).step(0.001).name('Tint amount').onChange(update);
    folder.addColor(options, 'tintColor').name('Tint color').onChange(update);
    folder.add({ reset: function () {
        resetGroupToDefaults('Colors');
    }}, 'reset').name('Reset');

    var folder = gui.addFolder('Iridescence');
    folder.add(options, 'iridescenceAmount', 0.0, 1.0).step(0.001).name('Amount').onChange(update);
    folder.add(options, 'iridescenceScale', 0.0, 2.0).step(0.001).name('Scale').onChange(update);
    folder.add(options, 'iridescencePower', 0.0, 5.0).step(0.001).name('Power 1').onChange(update);
    folder.add(options, 'iridescencePower2', 0.0, 5.0).step(0.001).name('Power 2').onChange(update);
    folder.add(options, 'lumaFactor1', 0.5, 4.0).step(0.001).name('Luma factor 1').onChange(update);
    folder.add(options, 'lumaFactor2', 0.5, 2.0).step(0.001).name('Luma factor 2').onChange(update);
    folder.add({ reset: function () {
        resetGroupToDefaults('Iridescence');
    }}, 'reset').name('Reset');

    var folder = gui.addFolder('Circular blur');
    folder.add(options, 'angle', 0.0, 1.0).step(0.001).name('Blur distance').onChange(update);
    folder.add(options, 'parabolaFactor', 1., 50.).step(0.01).name('Parabola factor').onChange(update);
    folder.add(options, 'distanceFactor', 0.0, 1.0).step(0.001).name('Distance factor').onChange(update);
    folder.add(options, 'distancePower', 0.5, 4.0).step(0.001).name('Distance power').onChange(update);
    folder.add({ reset: function () {
        resetGroupToDefaults('Circular blur');
    }}, 'reset').name('Reset');

    var folder = gui.addFolder('Background');
    folder.add(options, 'backgroundRegenerate').name('Generate new BG').onChange(update);
    folder.add(options, 'hueChangeOnBackground', 0.0, 1.0).step(0.001).name('Apply hue and tint on BG').onChange(update);
    folder.addColor(options, 'backgroundColor').name('Opaque color').onChange(update);
    folder.add(options, 'backgroundColorRatio', 0.0, 1.0).step(0.001).name('Opaque color ratio').onChange(update);
    folder.add({ reset: function () {
        resetGroupToDefaults('Background');
    }}, 'reset').name('Reset');

    var folder = gui.addFolder('Viewer');
    folder.add(options, 'fov', 30, 90).step(1).name('FOV').onChange(update);
    folder.add({ reset: function () {
        resetGroupToDefaults('Viewer');
    }}, 'reset').name('Reset');

    gui.add({
        download: function () {
            const url = context.working.canvas.toDataURL('image/png');

            const element = document.createElement('a');
            element.innerText = 'Download';
            element.style.position = 'absolute';
            element.style.top = '-100px';
            element.style.left = '0px';

            element.setAttribute('href', url);
            element.setAttribute('download', 'matcap-revised.png');
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        }
    }, 'download').name('Download matcap texture');

    [...document.querySelectorAll('.js-matcap')].forEach((el, i) => {
        const img = el.querySelector('img');

        if (i === 0) {
            if (img.complete) {
                texture = context.createTexture(img.naturalWidth, img.naturalHeight, false);
                texture.updateFromImageElement(img);
                update(true);
            }
        }

        el.addEventListener('click', e => {
            e.preventDefault();
            texture = context.createTexture(img.naturalWidth, img.naturalHeight, false);
            texture.updateFromImageElement(img);
            update(true);
        });
    });

    [...document.querySelectorAll('.js-model')].forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            const model = el.getAttribute('data-model');
            const normal = el.getAttribute('data-normal');
    
            viewer.chooseModel(model, normal);
        });
    });
}

module.exports = init;