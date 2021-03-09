"use strict";

const Context = require('./webgl/context');
const matcapProcess = require('./jobs/matcap-process');
const Viewer = require('./viewer');

function init () {
    const body = document.body;
    const viewerElement = document.querySelector('.viewer');
    const matcapElement = document.querySelector('.matcap');
    const guiElement = document.querySelector('.gui');
    const viewer = new Viewer(viewerElement);
    const context = new Context(512, 512);

    matcapElement.appendChild(context.working.canvas);

    let texture = null;

    function getTextureForSize(width, height) {
        if (texture === null || texture.width !== width || texture.height !== height) {
            if (texture !== null) {
                texture.dispose();
            }

            texture = context.createTexture(width, height, false);
        }

        return texture;
    }

    const defaults = {
        translationX: 0,
        translationY: 0,
        zoom: 1.0,

        rotation: 0.0,
        curveMultiplier: 1.0,
        curveAdd: 0.0,

        type: 0,
        brightness: 0.0,
        contrast: 0.0,
        saturation: 1.0,
        hueShift: 0.,
        tintAmount: 0,
        tintColor: [1., 1., 1.].map(v => v * 255 | 0),

        iridescenceType: 1,
        iridescenceAmount: 0.0,
        iridescenceScale: 1.,
        iridescencePower1: 2.,
        iridescencePower2: 2.,
        iridescenceLumaFactor1: 0.5,
        iridescenceLumaFactor2: 0.5,

        iridescenceReductionByLuma: 0.75,
        iridescenceGreenOffset: 0.2,
        iridescenceBlueOffset: -0.5,

        circularBlurAngle: 0.0,
        circularBlurLumaBias: 0.0,
        circularBlurParabolaFactor: 4.,
        circularBlurDistanceFactor: 1.0,
        circularBlurDistancePower: 2.,

        hueChangeOnBackground: 0.,
        backgroundRegenerate: false,
        backgroundColor:  [0., 0., 0.].map(v => v * 255 | 0),
        backgroundColorRatio: 0.0,

        fov: 50
    };

    const options = Object.assign({}, defaults);

    let matcapUpdateRequested = false;
    let viewerUpdateRequested = false;
    let previousState = '';

    (function loop() {
        if (matcapUpdateRequested || viewerUpdateRequested) {
            // dat.gui is quite fond of sending unecessary update events, make sure the state changed
            const newState = JSON.stringify(options);

            if (newState !== previousState) {
                previousState = newState;

                if (matcapUpdateRequested) {
                    matcapProcess(context, { input: texture }, { output: { width: 512, height: 512 }}, options);
                    viewer.updateTexture(context.working.canvas);
                }

                if (viewerUpdateRequested) {
                    viewer.updateViewer(options);
                }
            }

            matcapUpdateRequested = false;
            viewerUpdateRequested = false;
        }

        viewer.update();
        requestAnimationFrame(loop);
    })();

    function requestMatcapUpdate(force) {
        if (force) {
            previousState = '';
        }

        matcapUpdateRequested = true;
    }

    function requestViewerUpdate(force) {
        if (force) {
            previousState = '';
        }

        viewerUpdateRequested = true;
    }

    window.addEventListener('resize', () => {
        viewer.resize();
    });

    window.addEventListener('keydown', e => {
        if (document.activeElement.type !== 'text') {
            if (e.which === 72) {
                body.classList.toggle('hide-gui');
            } else if (e.which === 88) {
                const folders = Object.values(gui.__folders);
                const allClosed = folders.reduce((a, folder) => a && folder.closed, true);
                folders.forEach(folder => folder.closed = !allClosed);
                gui.closed = false;
            }

            
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
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.onload = function () {
                    const width = img.naturalWidth;
                    const height = img.naturalHeight;
                    texture = getTextureForSize(width, height);
                    texture.updateFromImageElement(img);

                    requestMatcapUpdate(true);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else if (file.name.match(/\.gltf$/) || file.name.match(/\.glb$/) || file.name.match(/\.prwm$/)) {
            const reader = new FileReader();
            reader.onload = (e) => {
                viewer.updateModel(file.name, e.target.result);
            };
            reader.readAsArrayBuffer(file);
        } else if (file.name.match(/\.obj$/)) {
            const reader = new FileReader();
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

        requestMatcapUpdate(false);
        requestViewerUpdate(false);
    }

    const iridescenceTypesControls = [[], []];

    function updateIridescencControls() {
        iridescenceTypesControls[0].forEach(control => control.__li.style.display = 'none');
        iridescenceTypesControls[1].forEach(control => control.__li.style.display = 'none');
        iridescenceTypesControls[options.iridescenceType].forEach(control => control.__li.style.display = '');
    }

    const gui = new dat.GUI({ width: guiElement.getBoundingClientRect().width, hideable: false, autoPlace: false });
    guiElement.appendChild(gui.domElement);
    let folder = gui.addFolder('Source image modifier');
    folder.add(options, 'translationX', -1.0, 1.0).step(0.001).name('X').onChange(requestMatcapUpdate);
    folder.add(options, 'translationY', -1.0, 1.0).step(0.001).name('Y').onChange(requestMatcapUpdate);
    folder.add(options, 'zoom', 1.0, 10.0).step(0.001).name('Zoom').onChange(requestMatcapUpdate);
    folder.add({ reset: function () {
        resetGroupToDefaults('Source image modifier');
    }}, 'reset').name('Reset');

    folder = gui.addFolder('Curve and rotation');
    folder.add(options, 'rotation', 0.0, 1.0).step(0.001).name('Rotation').onChange(requestMatcapUpdate);
    folder.add(options, 'curveMultiplier', 0.5, 4.0).step(0.001).name('Curve multiplier').onChange(requestMatcapUpdate);
    folder.add(options, 'curveAdd', 0.0, 1.0).step(0.001).name('Curve increase').onChange(requestMatcapUpdate);
    folder.add({ reset: function () {
        resetGroupToDefaults('Curve and rotation');
    }}, 'reset').name('Reset');

    folder = gui.addFolder('Colors');
    folder.add(options, 'type', { Standard: 0, Smooth: 1 }).name('Color model').onChange(requestMatcapUpdate);
    folder.add(options, 'hueShift', -1.0, 1.0).step(0.001).name('Hue shift').onChange(requestMatcapUpdate);
    folder.add(options, 'brightness', -1.0, 1.0).step(0.001).name('Brightness').onChange(requestMatcapUpdate);
    folder.add(options, 'contrast', -1.0, 1.0).step(0.001).name('Contrast').onChange(requestMatcapUpdate);
    folder.add(options, 'saturation', 0.0, 2.0).step(0.001).name('Saturation').onChange(requestMatcapUpdate);
    folder.add(options, 'tintAmount', 0.0, 1.0).step(0.001).name('Tint amount').onChange(requestMatcapUpdate);
    folder.addColor(options, 'tintColor').name('Tint color').onChange(requestMatcapUpdate);
    folder.add({ reset: function () {
        resetGroupToDefaults('Colors');
    }}, 'reset').name('Reset');

    folder = gui.addFolder('Iridescence');
    folder.add(options, 'iridescenceType', { FresnelMix: 0, ChromaticAberration: 1 }).name('Iridescence model').onChange(() => {
        updateIridescencControls();
        requestMatcapUpdate();
    });
    folder.add(options, 'iridescenceAmount', 0.0, 1.0).step(0.001).name('Amount').onChange(requestMatcapUpdate);
    iridescenceTypesControls[0].push(folder.add(options, 'iridescenceScale', 0.0, 2.0).step(0.001).name('Scale').onChange(requestMatcapUpdate));
    iridescenceTypesControls[0].push(folder.add(options, 'iridescencePower1', 0.0, 5.0).step(0.001).name('Power 1').onChange(requestMatcapUpdate));
    iridescenceTypesControls[0].push(folder.add(options, 'iridescencePower2', 0.0, 5.0).step(0.001).name('Power 2').onChange(requestMatcapUpdate));
    iridescenceTypesControls[0].push(folder.add(options, 'iridescenceLumaFactor1', 0.5, 4.0).step(0.001).name('Luma factor 1').onChange(requestMatcapUpdate));
    iridescenceTypesControls[0].push(folder.add(options, 'iridescenceLumaFactor2', 0.5, 2.0).step(0.001).name('Luma factor 2').onChange(requestMatcapUpdate));
    iridescenceTypesControls[1].push(folder.add(options, 'iridescenceReductionByLuma', 0.0, 1.0).step(0.001).name('Reduction by luma').onChange(requestMatcapUpdate));
    iridescenceTypesControls[1].push(folder.add(options, 'iridescenceGreenOffset', -1.0, 1.0).step(0.001).name('Green offset').onChange(requestMatcapUpdate));
    iridescenceTypesControls[1].push(folder.add(options, 'iridescenceBlueOffset', -1.0, 1.0).step(0.001).name('Blue offset').onChange(requestMatcapUpdate));
    folder.add({ reset: function () {
        resetGroupToDefaults('Iridescence');
    }}, 'reset').name('Reset');

    folder = gui.addFolder('Circular blur');
    folder.add(options, 'circularBlurAngle', 0.0, 1.0).step(0.001).name('Blur distance').onChange(requestMatcapUpdate);
    folder.add(options, 'circularBlurParabolaFactor', 1., 50.).step(0.01).name('Parabola factor').onChange(requestMatcapUpdate);
    folder.add(options, 'circularBlurLumaBias', -1.0, 1.0).step(0.001).name('Luma bias').onChange(requestMatcapUpdate);
    folder.add(options, 'circularBlurDistanceFactor', 0.0, 1.0).step(0.001).name('Distance factor').onChange(requestMatcapUpdate);
    folder.add(options, 'circularBlurDistancePower', 0.5, 4.0).step(0.001).name('Distance power').onChange(requestMatcapUpdate);
    folder.add({ reset: function () {
        resetGroupToDefaults('Circular blur');
    }}, 'reset').name('Reset');

    folder = gui.addFolder('Background');
    folder.add(options, 'backgroundRegenerate').name('Generate new BG').onChange(requestMatcapUpdate);
    folder.add(options, 'hueChangeOnBackground', 0.0, 1.0).step(0.001).name('Apply hue and tint on BG').onChange(requestMatcapUpdate);
    folder.addColor(options, 'backgroundColor').name('Opaque color').onChange(requestMatcapUpdate);
    folder.add(options, 'backgroundColorRatio', 0.0, 1.0).step(0.001).name('Opaque color ratio').onChange(requestMatcapUpdate);
    folder.add({ reset: function () {
        resetGroupToDefaults('Background');
    }}, 'reset').name('Reset');

    folder = gui.addFolder('Viewer');
    folder.add(options, 'fov', 30, 90).step(1).name('FOV').onChange(requestViewerUpdate);
    folder.add({ reset: function () {
        resetGroupToDefaults('Viewer');
    }}, 'reset').name('Reset');

    gui.add({
        resetAll: function () {
            resetGroupToDefaults('Source image modifier');
            resetGroupToDefaults('Curve and rotation');
            resetGroupToDefaults('Colors');
            resetGroupToDefaults('Iridescence');
            resetGroupToDefaults('Circular blur');
            resetGroupToDefaults('Background');
            resetGroupToDefaults('Viewer');
        }
    }, 'resetAll').name('Reset all');

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

    function loadMatcapFromImage(img) {
        if (img.complete) {
            texture = getTextureForSize(img.naturalWidth, img.naturalHeight);
            texture.updateFromImageElement(img);
            requestMatcapUpdate(true);
        }
    }

    [...document.querySelectorAll('.js-matcap')].forEach((el, i) => {
        const img = el.querySelector('img');

        if (i === 0) {
            loadMatcapFromImage(img);
        }

        el.addEventListener('click', e => {
            e.preventDefault();
            loadMatcapFromImage(img);
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

    updateIridescencControls();
}

module.exports = init;